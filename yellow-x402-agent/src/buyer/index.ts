/**
 * buyer/index.ts  —  x402 buyer agent with full Yellow session lifecycle
 *
 * Demonstrates the state channel pattern end-to-end:
 *   ① Auth           — EIP-712 session with allowances
 *   ② Create channel — session open, ClearNode returns signed initial state
 *   ③ Paid requests  — multiple off-chain transfers (instant, no gas)
 *   ④ Close channel  — session end, ClearNode returns signed final state
 *   ⑤ On-chain       — submit final state to adjudicator (best-effort)
 *
 * Run:  npm run buyer
 */

import 'dotenv/config';
import { YellowClient }                          from '../lib/yellow-client.js';
import { NitroliteClient, WalletStateSigner }   from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia }                              from 'viem/chains';
import { privateKeyToAccount }                  from 'viem/accounts';

// ── config ─────────────────────────────────────────────────
const SERVICE_URL   = process.env.SERVICE_URL            || 'http://localhost:4000';
const PRIV_KEY      = process.env.BUYER_PRIVATE_KEY      as `0x${string}`;
const CHAIN_ID      = Number(process.env.CHAIN_ID        || 11155111);  // Sepolia
// ytest.usd on ClearNode sandbox (all chains share the same address)
const SANDBOX_TOKEN = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS          || SANDBOX_TOKEN;

// Contract addresses (from yellow-app / ClearNode sandbox)
const CUSTODY_ADDRESS    = '0x019B65A265EB3363822f2752141b3dF16131b262';
const ADJUDICATOR_ADDRESS = '0x7c7ccbc98469190849BCC6c926307794fDfB11F2';

if (!PRIV_KEY) {
  console.error('[buyer] BUYER_PRIVATE_KEY is required (.env)');
  process.exit(1);
}

// ── paid endpoints to hit in sequence ──────────────────────
const ENDPOINTS = ['/resource', '/data', '/quote'];

// ── helpers ─────────────────────────────────────────────────
/** Hit a paid endpoint: 402 → transfer → retry with X-PAYMENT. */
async function doPaidRequest(yellow: YellowClient, path: string) {
  console.log(`\n  [buyer] hitting ${SERVICE_URL}${path} …`);

  // initial request — expect 402
  let res = await fetch(`${SERVICE_URL}${path}`);
  console.log(`  [buyer]   status: ${res.status}`);

  if (res.status !== 402) {
    console.log('  [buyer]   unexpected status — body:', await res.text());
    return;
  }

  // parse requirements
  const body402 = (await res.json()) as {
    accepts: Array<{ scheme: string; network: string; maxAmountRequired: string; payTo: string; asset: string }>;
  };
  const req = body402.accepts[0];
  console.log(`  [buyer]   requires: ${req.maxAmountRequired} ${req.asset} → ${req.payTo}`);

  // pay via Yellow (off-chain, instant)
  const transactions = await yellow.transfer({
    destination : req.payTo as `0x${string}`,
    asset       : req.asset,
    amount      : req.maxAmountRequired,
  });
  const tx = transactions[0];
  console.log(`  [buyer]   paid  tx=${tx.id}  amount=${tx.amount}`);

  // build X-PAYMENT header
  const xPayment = Buffer.from(JSON.stringify({
    x402Version   : 1,
    scheme        : req.scheme,
    network       : req.network,
    payload       : {
      transactionId : tx.id,
      fromAccount   : tx.from_account,
      toAccount     : tx.to_account,
      asset         : tx.asset,
      amount        : tx.amount,
    },
  })).toString('base64');

  // retry with payment
  res = await fetch(`${SERVICE_URL}${path}`, { headers: { 'X-PAYMENT': xPayment } });
  console.log(`  [buyer]   status: ${res.status}`);
  console.log(`  [buyer]   response:`, JSON.stringify(await res.json(), null, 2));
}

/**
 * Full channel settlement lifecycle (best-effort, all errors propagate to caller).
 *
 *   ⑤a  on-chain createChannel   — locks the initial state on Sepolia
 *   (wait)                       — ClearNode indexes the on-chain channel
 *   ④   close_channel RPC        — ClearNode signs the final state
 *   ⑤b  on-chain closeChannel    — submits the final state, funds released
 */
async function settleChannel(
  yellow         : YellowClient,
  createResp     : Awaited<ReturnType<YellowClient['createChannel']>> | null,
  channelId      : string,
  alreadyOnChain : boolean,
) {
  const account       = privateKeyToAccount(PRIV_KEY);
  const publicClient  = createPublicClient({ chain: sepolia, transport: http() });
  const walletClient  = createWalletClient({ chain: sepolia, transport: http(), account });

  const nitrolite = new NitroliteClient({
    publicClient,
    walletClient,
    stateSigner       : new WalletStateSigner(walletClient),
    addresses         : {
      custody     : CUSTODY_ADDRESS    as `0x${string}`,
      adjudicator : ADJUDICATOR_ADDRESS as `0x${string}`,
    },
    chainId           : sepolia.id,
    challengeDuration : 3600n,
  });

  // ── ⑤a  on-chain create (skip if channel already on-chain) ──
  if (!alreadyOnChain && createResp) {
    console.log('\n[buyer] ⑤ on-chain settlement …');
    const { txHash: createHash } = await nitrolite.createChannel({
      channel            : createResp.channel as any,
      unsignedInitialState : {
        intent      : createResp.state.intent,
        version     : BigInt(createResp.state.version),
        data        : createResp.state.state_data as `0x${string}`,
        allocations : createResp.state.allocations.map(a => ({
          destination : a.destination as `0x${string}`,
          token       : a.token       as `0x${string}`,
          amount      : BigInt(a.amount),
        })),
      },
      serverSignature : createResp.server_signature as `0x${string}`,
    });
    console.log(`[buyer]   ⑤a on-chain create  txHash=${createHash}`);
    await publicClient.waitForTransactionReceipt({ hash: createHash });
    console.log(`[buyer]   ⑤a create confirmed`);

    // wait for ClearNode to index the on-chain channel
    console.log(`[buyer]   waiting 3 s for ClearNode to index channel …`);
    await new Promise(r => setTimeout(r, 3000));
  } else {
    console.log('\n[buyer] ⑤ channel already on-chain — skipping create …');
  }

  // ── ④  close_channel RPC ─────────────────────────────
  console.log(`[buyer] ④ close_channel RPC …`);
  const closeResp = await yellow.closeChannel(channelId, yellow.address);
  console.log(`[buyer]   channel_id=${closeResp.channel_id}`);
  console.log(`[buyer]   final allocations:`, JSON.stringify(closeResp.state.allocations));
  console.log(`[buyer]   server_signature=${closeResp.server_signature}`);

  // ── ⑤b  on-chain close ───────────────────────────────
  console.log(`[buyer] ⑤ on-chain close …`);
  const closeHash = await nitrolite.closeChannel({
    finalState : {
      intent      : closeResp.state.intent,
      version     : BigInt(closeResp.state.version),
      data        : (closeResp.state.state_data || '0x') as `0x${string}`,
      allocations : closeResp.state.allocations.map(a => ({
        destination : a.destination as `0x${string}`,
        token       : a.token       as `0x${string}`,
        amount      : BigInt(a.amount),
      })),
      channelId       : closeResp.channel_id as `0x${string}`,
      serverSignature : closeResp.server_signature as `0x${string}`,
    },
    stateData : (closeResp.state.state_data || '0x') as `0x${string}`,
  });
  console.log(`[buyer]   ⑤b on-chain close   txHash=${closeHash}`);
  await publicClient.waitForTransactionReceipt({ hash: closeHash });
  console.log(`[buyer]   ⑤b close confirmed — settlement complete`);
}

// ── main ───────────────────────────────────────────────────
async function main() {
  const yellow = new YellowClient(PRIV_KEY, {
    appName     : 'x402-buyer',
    clearnetUrl : process.env.CLEARNET_URL,
  });

  // ① auth ───────────────────────────────────────────────
  console.log('[buyer] ① connecting + authenticating …');
  await yellow.connect();
  console.log(`[buyer]   address=${yellow.address}`);

  // ② create channel (session open) ─────────────────────
  // If a channel is already open (e.g. from a previous run that created on-chain
  // but didn't close), ClearNode returns "already exists: 0x…".  In that case
  // the channel IS on-chain — we skip create + on-chain-create and go straight
  // to close.
  console.log(`\n[buyer] ② opening session (create_channel)  token=${TOKEN_ADDRESS} …`);
  let channelResp: Awaited<ReturnType<YellowClient['createChannel']>> | null = null;
  let channelId  : string | null = null;
  let alreadyOnChain = false;

  try {
    channelResp = await yellow.createChannel({ chain_id: CHAIN_ID, token: TOKEN_ADDRESS });
    channelId   = channelResp.channel_id;
    console.log(`[buyer]   channel_id=${channelId}`);
    console.log(`[buyer]   server_signature=${channelResp.server_signature}`);
    console.log(`[buyer]   allocations:`, JSON.stringify(channelResp.state.allocations));
  } catch (e: any) {
    const m = e.message.match(/(0x[0-9a-fA-F]{64})/);
    if (m && e.message.includes('already exists')) {
      channelId      = m[1];
      alreadyOnChain = true;
      console.log(`[buyer]   reusing existing on-chain channel: ${channelId}`);
    } else {
      throw e;   // unexpected — let the outer catch surface it
    }
  }

  // ③ paid requests (off-chain, instant) ────────────────
  console.log('\n[buyer] ③ making paid requests …');
  for (const path of ENDPOINTS) {
    await doPaidRequest(yellow, path);
  }

  // ④⑤ on-chain settlement ─────────────────────────────
  // Sequence:
  //   new channel  → on-chain create → wait → close RPC → on-chain close
  //   existing     → close RPC → on-chain close            (create already done)
  try {
    await settleChannel(yellow, channelResp, channelId!, alreadyOnChain);
  } catch (e: any) {
    console.log(`\n[buyer]   settlement error: ${e.message}`);
    console.log(`[buyer]   (signed create state from ② can be submitted manually)`);
  }

  yellow.close();
}

main().catch((err) => {
  console.error('[buyer] fatal:', err);
  process.exit(1);
});
