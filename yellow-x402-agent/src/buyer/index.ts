/**
 * buyer/index.ts  —  x402 buyer agent backed by Yellow
 *
 * Flow:
 *   1. Connect to ClearNode, authenticate.
 *   2. Hit the paid endpoint with no payment  →  receive 402.
 *   3. Parse the Yellow scheme requirements from the 402 body.
 *   4. Transfer the required amount via ClearNode ledger.
 *   5. Retry the request with the X-PAYMENT header (base64 JSON receipt).
 *   6. Log the final response.
 *
 * Run:  npm run buyer
 */

import 'dotenv/config';
import { YellowClient } from '../lib/yellow-client.js';

// ── config ─────────────────────────────────────────────────
const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:4000';
const PRIV_KEY    = process.env.BUYER_PRIVATE_KEY as `0x${string}`;

if (!PRIV_KEY) {
  console.error('[buyer] BUYER_PRIVATE_KEY is required (.env)');
  process.exit(1);
}

// ── main ───────────────────────────────────────────────────
async function main() {
  const yellow = new YellowClient(PRIV_KEY, {
    appName     : 'x402-buyer',
    clearnetUrl : process.env.CLEARNET_URL,
  });

  console.log('[buyer] connecting to ClearNode …');
  await yellow.connect();
  console.log(`[buyer] authenticated  address=${yellow.address}`);

  // ─ 1. initial request (no payment) ─────────────────────
  console.log(`\n[buyer] ① hitting ${SERVICE_URL}/resource …`);
  let res = await fetch(`${SERVICE_URL}/resource`);
  console.log(`[buyer]   status: ${res.status}`);

  if (res.status !== 402) {
    console.log('[buyer]   unexpected status — body:', await res.text());
    yellow.close();
    return;
  }

  // ─ 2. parse 402 requirements ────────────────────────────
  const body402 = (await res.json()) as { accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    payTo: string;
    asset: string;
  }> };
  const req = body402.accepts[0];
  console.log(`[buyer] ② requirements:`, JSON.stringify(req, null, 2));

  // ─ 3. pay via Yellow transfer ───────────────────────────
  console.log(`\n[buyer] ③ transferring ${req.maxAmountRequired} ${req.asset} → ${req.payTo}`);
  const transactions = await yellow.transfer({
    destination : req.payTo  as `0x${string}`,
    asset       : req.asset,
    amount      : req.maxAmountRequired,
  });

  const tx = transactions[0];
  console.log(`[buyer]   transfer receipt  id=${tx.id}  amount=${tx.amount}  to=${tx.to_account}`);

  // ─ 4. build X-PAYMENT header ────────────────────────────
  const paymentPayload = {
    x402Version: 1,
    scheme     : req.scheme,
    network    : req.network,
    payload    : {
      transactionId : tx.id,
      fromAccount   : tx.from_account,
      toAccount     : tx.to_account,
      asset         : tx.asset,
      amount        : tx.amount,
    },
  };
  const xPayment = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

  // ─ 5. retry with payment ────────────────────────────────
  console.log(`\n[buyer] ④ retrying with X-PAYMENT …`);
  res = await fetch(`${SERVICE_URL}/resource`, {
    headers: { 'X-PAYMENT': xPayment },
  });
  console.log(`[buyer]   status: ${res.status}`);

  const finalBody = await res.json();
  console.log(`[buyer]   response:`, JSON.stringify(finalBody, null, 2));

  yellow.close();
}

main().catch((err) => {
  console.error('[buyer] fatal:', err);
  process.exit(1);
});
