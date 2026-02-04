/**
 * service/index.ts  —  x402 paid resource endpoint backed by Yellow
 *
 * Flow:
 *   1. Connects to ClearNode, authenticates, listens for incoming
 *      transfer notifications (push method "tr").
 *   2. GET /resource  — no X-PAYMENT → 402 with Yellow scheme requirements.
 *   3. GET /resource  — with X-PAYMENT → extract transactionId,
 *      confirm it arrived via notification cache, return the resource.
 *
 * Run:  npm run service
 */

import 'dotenv/config';
import express                          from 'express';
import { YellowClient, TransferTx }    from '../lib/yellow-client.js';

// ── config ─────────────────────────────────────────────────
const PORT       = Number(process.env.SERVICE_PORT || 4000);
const PRICE      = process.env.PRICE              || '1000000';
const ASSET      = 'ytest.usd';
const PRIV_KEY   = process.env.SERVICE_PRIVATE_KEY as `0x${string}`;

if (!PRIV_KEY) {
  console.error('[service] SERVICE_PRIVATE_KEY is required (.env)');
  process.exit(1);
}

// ── Yellow client (singleton, shared across requests) ─────
const yellow = new YellowClient(PRIV_KEY, {
  appName     : 'x402-resource-service',
  clearnetUrl : process.env.CLEARNET_URL,
});

// ── transfer notification cache ────────────────────────────
// key = transaction id  →  value = full tx object
const confirmed = new Map<number, TransferTx>();

function cacheIncoming(txs: TransferTx[]) {
  for (const tx of txs) {
    confirmed.set(tx.id, tx);
    console.log(`[service] cached transfer  id=${tx.id}  amount=${tx.amount}  from=${tx.from_account}`);
  }
}

// ── Express app ────────────────────────────────────────────
const app = express();
app.use(express.json());

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── paid resource ──────────────────────────────────────────
app.get('/resource', async (req, res) => {
  const raw = req.headers['x-payment'] as string | undefined;

  // ── no header → 402 ──────────────────────────────────
  if (!raw) {
    return res.status(402).json({
      accepts: [{
        scheme            : 'yellow',
        network           : 'eip155:11155111',
        maxAmountRequired : PRICE,
        resource          : '/resource',
        description       : 'Access to the premium resource',
        payTo             : yellow.address,      // service wallet
        asset             : ASSET,
        extra: {
          clearnetUrl: process.env.CLEARNET_URL || 'wss://clearnet-sandbox.yellow.com/ws',
          appName    : 'x402-resource-service',
        },
      }],
    });
  }

  // ── decode X-PAYMENT ────────────────────────────────────
  let payment: { scheme: string; payload: { transactionId: number; amount: string; asset: string } };
  try {
    payment = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Malformed X-PAYMENT header' });
  }

  if (payment.scheme !== 'yellow') {
    return res.status(400).json({ error: `Unsupported scheme: ${payment.scheme}` });
  }

  const { transactionId } = payment.payload;

  // ── confirm payment ─────────────────────────────────────
  // The "tr" notification from ClearNode might arrive a few ms
  // after the buyer received its transfer receipt.  Poll briefly.
  let tx = confirmed.get(transactionId);
  if (!tx) {
    for (let i = 0; i < 30; i++) {                     // up to 3 s
      await new Promise(r => setTimeout(r, 100));
      tx = confirmed.get(transactionId);
      if (tx) break;
    }
  }

  if (!tx) {
    console.warn(`[service] tx ${transactionId} not in cache after 3 s`);
    return res.status(402).json({ error: 'Payment not confirmed — transaction not received' });
  }

  // Sanity: asset + amount + destination
  if (tx.asset !== ASSET) {
    return res.status(402).json({ error: `Wrong asset: expected ${ASSET}, got ${tx.asset}` });
  }
  if (BigInt(tx.amount) < BigInt(PRICE)) {
    return res.status(402).json({ error: `Insufficient amount: need ${PRICE}, got ${tx.amount}` });
  }
  if (tx.to_account.toLowerCase() !== yellow.address.toLowerCase()) {
    return res.status(402).json({ error: 'Payment destination mismatch' });
  }

  // ── serve ───────────────────────────────────────────────
  console.log(`[service] payment confirmed  tx=${transactionId}  → serving resource`);
  return res.json({
    message       : 'Payment confirmed. Here is your premium resource.',
    data          : { quote: 'The only winning move is not to play.' },
    transactionId,
    paidAmount    : tx.amount,
    asset         : tx.asset,
    timestamp     : new Date().toISOString(),
  });
});

// ── startup ────────────────────────────────────────────────
async function main() {
  console.log('[service] connecting to ClearNode …');
  await yellow.connect();
  console.log(`[service] authenticated  address=${yellow.address}`);

  // "tr" = RPCMethod.TransferNotification (confirmed from SDK enum)
  yellow.on('tr', (payload: any) => {
    const txs: TransferTx[] = payload?.transactions
      ?? (Array.isArray(payload) ? payload : [payload]);
    cacheIncoming(txs);
  });

  app.listen(PORT, () => {
    console.log(`[service] HTTP on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[service] fatal:', err);
  process.exit(1);
});
