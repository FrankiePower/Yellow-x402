/**
 * service/index.ts  —  x402 paid endpoints backed by Yellow
 *
 * Flow:
 *   1. Connects to ClearNode, authenticates, listens for incoming
 *      transfer notifications (push method "tr").
 *   2. Any paid route — no X-PAYMENT → 402 with Yellow scheme requirements.
 *   3. Any paid route — with X-PAYMENT → extract transactionId,
 *      confirm it arrived via notification cache, serve the resource.
 *
 * Adding a new paid route:
 *   app.get('/whatever', async (req, res) => {
 *     const tx = await requirePayment(req, res, { price: '500', description: '…' });
 *     if (!tx) return;   // 402 / 400 already sent
 *     res.json({ … });
 *   });
 *
 * Run:  npm run service
 */

import 'dotenv/config';
import express, { Request, Response }  from 'express';
import cors                            from 'cors';
import { YellowClient, TransferTx }    from '../lib/yellow-client.js';
import { runDemo }                     from '../demo-runner.js';

// ── config ─────────────────────────────────────────────────
const PORT       = Number(process.env.SERVICE_PORT || 4000);
const PRICE      = process.env.PRICE              || '10000'; // 0.01 USDC
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

// ── requirePayment ─────────────────────────────────────────
// Call at the top of any paid route handler.
// Returns the confirmed TransferTx on success.
// Returns null if a 402/400 response was already sent — caller just returns.
interface PaymentOptions {
  price?       : string;   // override default PRICE for this route
  description? : string;   // shown in the 402 body
}

async function requirePayment(
  req: Request,
  res: Response,
  opts: PaymentOptions = {},
): Promise<TransferTx | null> {
  const price       = opts.price       ?? PRICE;
  const description = opts.description ?? 'Paid resource';
  const raw         = req.headers['x-payment'] as string | undefined;

  // ── no header → 402 ──────────────────────────────────
  if (!raw) {
    res.status(402).json({
      accepts: [{
        scheme            : 'yellow',
        network           : 'eip155:11155111',
        maxAmountRequired : price,
        resource          : req.path,           // auto from route
        description,
        payTo             : yellow.address,
        asset             : ASSET,
        extra: {
          clearnetUrl: process.env.CLEARNET_URL || 'wss://clearnet-sandbox.yellow.com/ws',
          appName    : 'x402-resource-service',
        },
      }],
    });
    return null;
  }

  // ── decode X-PAYMENT ────────────────────────────────────
  let payment: { scheme: string; payload: { transactionId: number } };
  try {
    payment = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Malformed X-PAYMENT header' });
    return null;
  }

  if (payment.scheme !== 'yellow') {
    res.status(400).json({ error: `Unsupported scheme: ${payment.scheme}` });
    return null;
  }

  const { transactionId } = payment.payload;

  // ── confirm payment ─────────────────────────────────────
  // The "tr" notification from ClearNode might arrive a few ms
  // after the buyer received its transfer receipt.  Poll briefly.
  let tx = confirmed.get(transactionId);
  if (!tx) {
    console.log(`[service] tx ${transactionId} not found immediately, polling...`);
    for (let i = 0; i < 100; i++) {                     // up to 10 s (100 * 100ms)
      await new Promise(r => setTimeout(r, 100));
      tx = confirmed.get(transactionId);
      if (tx) {
        console.log(`[service] tx ${transactionId} found after ${i * 100}ms`);
        break;
      }
    }
  }

  if (!tx) {
    console.warn(`[service] tx ${transactionId} not in cache after 3 s`);
    res.status(402).json({ error: 'Payment not confirmed — transaction not received' });
    return null;
  }

  // Sanity: asset + amount + destination
  if (tx.asset !== ASSET) {
    res.status(402).json({ error: `Wrong asset: expected ${ASSET}, got ${tx.asset}` });
    return null;
  }
  if (BigInt(tx.amount) < BigInt(price)) {
    res.status(402).json({ error: `Insufficient amount: need ${price}, got ${tx.amount}` });
    return null;
  }
  if (tx.to_account.toLowerCase() !== yellow.address.toLowerCase()) {
    res.status(402).json({ error: 'Payment destination mismatch' });
    return null;
  }

  console.log(`[service] payment confirmed  tx=${transactionId}  → ${req.path}`);
  return tx;
}

// ── Express app ────────────────────────────────────────────
const app = express();
app.use(cors());  // Enable CORS for frontend requests
app.use(express.json());

// Health (free)
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── paid routes ─────────────────────────────────────────────
app.get('/resource', async (req, res) => {
  const tx = await requirePayment(req, res, {
    description: 'Access to the premium resource',
  });
  if (!tx) return;   // 402 or 400 already sent

  res.json({
    message       : 'Payment confirmed. Here is your premium resource.',
    data          : { quote: 'The only winning move is not to play.' },
    transactionId : tx.id,
    paidAmount    : tx.amount,
    asset         : tx.asset,
    timestamp     : new Date().toISOString(),
  });
});

app.get('/data', async (req, res) => {
  const tx = await requirePayment(req, res, {
    price       : '5000', // 0.005 USDC
    description : 'Access to analytics data',
  });
  if (!tx) return;

  res.json({
    message       : 'Payment confirmed. Here is your analytics data.',
    data          : { users: 1024, revenue: '$12,400', growth: '+23%' },
    transactionId : tx.id,
    paidAmount    : tx.amount,
    asset         : tx.asset,
    timestamp     : new Date().toISOString(),
  });
});

app.get('/quote', async (req, res) => {
  const tx = await requirePayment(req, res, {
    price       : '2000', // 0.002 USDC
    description : 'Live market quote',
  });
  if (!tx) return;

  res.json({
    message       : 'Payment confirmed. Here is your market quote.',
    data          : { symbol: 'ETH/USD', price: 3847.52, bid: 3846.10, ask: 3848.95 },
    transactionId : tx.id,
    paidAmount    : tx.amount,
    asset         : tx.asset,
    timestamp     : new Date().toISOString(),
  });
});

// ── demo runner ────────────────────────────────────────────
app.get('/run-demo', async (req, res) => {
  const buyerPrivateKey = process.env.BUYER_PRIVATE_KEY;
  
  if (!buyerPrivateKey) {
    return res.status(500).json({
      success: false,
      error: 'BUYER_PRIVATE_KEY not configured on server',
    });
  }

  try {
    const result = await runDemo(buyerPrivateKey);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      logs: [],
    });
  }
});

// ── /run-demo-stream (SSE real-time streaming) ──────────────────
app.get('/run-demo-stream', async (req, res) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Flush headers immediately to establish SSE connection
  res.flushHeaders();

  // Helper to write and flush
  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Force flush by writing empty string (Node.js trick)
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  };

  send({ type: 'connected' });

  const buyerPrivateKey = process.env.BUYER_PRIVATE_KEY;
  if (!buyerPrivateKey) {
    send({ type: 'error', error: 'BUYER_PRIVATE_KEY not configured' });
    res.end();
    return;
  }

  try {
    const { runDemoWithStreaming } = await import('../demo-runner-stream.js');

    await runDemoWithStreaming(buyerPrivateKey, (log) => {
      send({ type: 'log', log });
    });

    send({ type: 'complete' });
    res.end();
  } catch (error: any) {
    send({ type: 'error', error: error.message });
    res.end();
  }
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
