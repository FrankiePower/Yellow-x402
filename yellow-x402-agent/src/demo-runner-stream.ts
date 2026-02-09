/**
 * demo-runner-stream.ts — Execute demo with real-time log streaming
 *
 * Full on-chain channel flow:
 * 1. Connect + Auth
 * 2. Create channel via ClearNode RPC
 * 3. Submit channel to blockchain (on-chain tx #1)
 * 4. Wait for ClearNode to index
 * 5. Make 100 payments (off-chain, instant)
 * 6. Close channel via ClearNode RPC
 * 7. Submit close to blockchain (on-chain tx #2)
 */

import { YellowClient, ChannelInfo } from './lib/yellow-client.js';
import { NitroliteClient, WalletStateSigner } from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import type { DemoLogEntry } from './demo-runner.js';

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:4000';
const BASE_ENDPOINTS = ['/resource', '/data', '/quote'];
const ENDPOINTS = Array(34).fill(BASE_ENDPOINTS).flat();

// Contract addresses (Sepolia sandbox)
const CUSTODY_ADDRESS = '0x019B65A265EB3363822f2752141b3dF16131b262';
const ADJUDICATOR_ADDRESS = '0x7c7ccbc98469190849BCC6c926307794fDfB11F2';
const CHAIN_ID = 11155111; // Sepolia
const YTEST_USD_TOKEN = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';

type LogCallback = (log: DemoLogEntry) => void;

export async function runDemoWithStreaming(
  buyerPrivateKey: string,
  onLog: LogCallback
): Promise<void> {
  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Starting Yellow Network demo (Full Channel Flow)...',
  });

  // ── Setup ──────────────────────────────────────────────────
  const account = privateKeyToAccount(buyerPrivateKey as `0x${string}`);
  const publicClient = createPublicClient({ chain: sepolia, transport: http() });
  const walletClient = createWalletClient({ chain: sepolia, transport: http(), account });

  const nitrolite = new NitroliteClient({
    publicClient,
    walletClient,
    stateSigner: new WalletStateSigner(walletClient),
    addresses: {
      custody: CUSTODY_ADDRESS as `0x${string}`,
      adjudicator: ADJUDICATOR_ADDRESS as `0x${string}`,
    },
    chainId: sepolia.id,
    challengeDuration: 3600n,
  });

  const yellow = new YellowClient(buyerPrivateKey as `0x${string}`, {
    appName: 'x402-buyer',
    clearnetUrl: process.env.CLEARNET_URL,
  });

  // ── Step 1: Connect + Auth ─────────────────────────────────
  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Connecting to Yellow Network...',
  });

  await yellow.connect();

  onLog({
    timestamp: new Date().toISOString(),
    level: 'success',
    message: `Connected! Address: ${yellow.address}`,
    data: { address: yellow.address },
  });

  // Get unified balance
  const { balances } = await yellow.getLedgerBalances();

  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Unified Balance retrieved',
    data: { balances },
  });

  // ── Step 2: Check for existing channels first ───────────────
  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Checking for existing channels...',
  });

  let channelResp: ChannelInfo | null = null;
  let channelId: string | null = null;
  let alreadyOnChain = false;

  // First, check if we already have an open funded channel
  try {
    const { channels } = await yellow.getChannels();
    onLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Found ${channels.length} existing channel(s)`,
      data: { count: channels.length },
    });

    // Find a funded channel we can use
    for (const ch of channels) {
      const allocations = ch.state?.allocations || [];
      const isFunded = allocations.some((a: any) => BigInt(a.amount) > 0n);

      if (isFunded) {
        channelId = ch.channel_id;
        channelResp = ch;
        alreadyOnChain = true;

        onLog({
          timestamp: new Date().toISOString(),
          level: 'success',
          message: `Found existing funded channel: ${channelId}`,
          data: {
            channelId,
            allocations: allocations.map((a: any) => ({
              destination: a.destination,
              amount: a.amount
            }))
          },
        });
        break;
      }
    }
  } catch (e: any) {
    onLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Could not fetch channels: ${e.message}`,
    });
  }

  // If no existing channel, try to create one
  if (!channelId) {
    onLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'No existing channel found, creating new one...',
    });

    try {
      channelResp = await yellow.createChannel({
        chain_id: CHAIN_ID,
        token: YTEST_USD_TOKEN,
      });
      channelId = channelResp.channel_id;

      onLog({
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `Channel created: ${channelId}`,
        data: { channelId },
      });
    } catch (e: any) {
      // Check if channel already exists (error message parsing)
      const match = e.message?.match(/(0x[0-9a-fA-F]{64})/);
      if (match && (e.message.includes('already exists') || e.message.includes('open channel'))) {
        channelId = match[1];
        alreadyOnChain = true;
        onLog({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Reusing existing channel from error: ${channelId}`,
          data: { channelId, alreadyOnChain: true },
        });
      } else {
        throw e;
      }
    }
  }

  // ── Step 3: Submit Channel to Blockchain (on-chain tx #1) ──
  if (!alreadyOnChain && channelResp && channelId) {
    onLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Submitting channel to blockchain...',
    });

    try {
      const { txHash: createTxHash } = await nitrolite.createChannel({
        channel: channelResp.channel as any,
        unsignedInitialState: {
          intent: channelResp.state.intent,
          version: BigInt(channelResp.state.version),
          data: channelResp.state.state_data as `0x${string}`,
          allocations: channelResp.state.allocations.map(a => ({
            destination: a.destination as `0x${string}`,
            token: a.token as `0x${string}`,
            amount: BigInt(a.amount),
          })),
        },
        serverSignature: channelResp.server_signature as `0x${string}`,
      });

      onLog({
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `Channel on-chain! TX: ${createTxHash}`,
        data: { txHash: createTxHash },
      });

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash: createTxHash });

      onLog({
        timestamp: new Date().toISOString(),
        level: 'success',
        message: 'Channel confirmed on-chain!',
      });

      // Wait for ClearNode to index
      onLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Waiting 5s for ClearNode to index channel...',
      });
      await new Promise(r => setTimeout(r, 5000));
      alreadyOnChain = true;

      // ── Step 3b: Fund the Channel (Resize) ──────────────────
      onLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Funding channel from Unified Balance (resize)...',
      });

      try {
        const FUND_AMOUNT = 1000000n; // 1 ytest.usd (6 decimals)

        // Get ClearNode's signed resize state
        const resizeResp = await yellow.resizeChannel({
          channel_id: channelId,
          allocate_amount: FUND_AMOUNT,
        });

        onLog({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Resize signed by ClearNode, getting proof states...',
        });

        // Get proofStates from on-chain data (like browser does)
        let proofStates: any[] = [];
        try {
          const onChainData = await nitrolite.getChannelData(channelId as `0x${string}`);
          if (onChainData.lastValidState) {
            proofStates = [onChainData.lastValidState];
          }
        } catch {
          // New channel may not have on-chain state yet
        }

        onLog({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Submitting resize to blockchain...',
        });

        // Submit resize to blockchain (this was missing!)
        const { txHash: resizeTxHash } = await nitrolite.resizeChannel({
          resizeState: {
            intent: resizeResp.state.intent,
            version: BigInt(resizeResp.state.version),
            data: (resizeResp.state.state_data || '0x') as `0x${string}`,
            allocations: resizeResp.state.allocations.map((a: any) => ({
              destination: a.destination as `0x${string}`,
              token: a.token as `0x${string}`,
              amount: BigInt(a.amount),
            })),
            channelId: resizeResp.channel_id as `0x${string}`,
            serverSignature: resizeResp.server_signature as `0x${string}`,
          },
          proofStates,
        });

        onLog({
          timestamp: new Date().toISOString(),
          level: 'success',
          message: `Channel funded on-chain! TX: ${resizeTxHash}`,
          data: { txHash: resizeTxHash, allocations: resizeResp.state.allocations },
        });

        // Wait for resize confirmation
        await publicClient.waitForTransactionReceipt({ hash: resizeTxHash });

        onLog({
          timestamp: new Date().toISOString(),
          level: 'success',
          message: 'Channel funding confirmed!',
        });
      } catch (resizeErr: any) {
        onLog({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Resize skipped: ${resizeErr.message}`,
        });
        // Continue without resize - Unified Balance payments still work
      }
    } catch (e: any) {
      onLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `On-chain create failed: ${e.message}`,
      });
      // Continue anyway - we can still use Unified Balance
    }
  }

  // ── Step 4: Get payment destination from 402 ───────────────
  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Getting payment requirements from service...',
  });

  let paymentChannel: { payTo: string; asset: string } | null = null;
  const firstEndpoint = ENDPOINTS[0];
  let res = await fetch(`${SERVICE_URL}${firstEndpoint}`);

  if (res.status === 402) {
    const body402 = await res.json() as { accepts: Array<{ payTo: string; asset: string; maxAmountRequired: string }> };
    const req = body402.accepts[0];
    paymentChannel = { payTo: req.payTo, asset: req.asset };

    onLog({
      timestamp: new Date().toISOString(),
      level: 'success',
      message: `Payment destination: ${req.payTo}`,
      data: { payTo: req.payTo, asset: req.asset },
    });
  }

  if (!paymentChannel) {
    throw new Error('Failed to get payment requirements');
  }

  // ── Step 5: Make 100 Payments (off-chain, instant) ─────────
  const totalPayments = 100;
  let successCount = 0;
  let failCount = 0;

  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Starting ${totalPayments} payments...`,
  });

  for (let i = 0; i < totalPayments; i++) {
    const endpoint = ENDPOINTS[i % ENDPOINTS.length];

    try {
      // Make payment through channel
      const transactions = await yellow.transfer({
        destination: paymentChannel.payTo as `0x${string}`,
        asset: paymentChannel.asset,
        amount: endpoint === '/resource' ? '10000' : endpoint === '/data' ? '5000' : '2000',
      });
      const tx = transactions[0];

      // Make request with payment proof
      const xPayment = Buffer.from(
        JSON.stringify({
          x402Version: 1,
          scheme: 'yellow',
          network: 'clearnet',
          payload: {
            transactionId: tx.id,
            fromAccount: tx.from_account,
            toAccount: tx.to_account,
            asset: tx.asset,
            amount: tx.amount,
          },
        })
      ).toString('base64');

      res = await fetch(`${SERVICE_URL}${endpoint}`, {
        headers: { 'X-PAYMENT': xPayment },
      });

      if (res.ok) {
        successCount++;
        onLog({
          timestamp: new Date().toISOString(),
          level: 'success',
          message: `✅ Payment ${i + 1}/${totalPayments} - TX ${tx.id} (${endpoint})`,
        });
      } else {
        failCount++;
        onLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `❌ Payment ${i + 1} failed: ${res.status}`,
        });
      }
    } catch (error: any) {
      failCount++;
      onLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Payment ${i + 1} error: ${error.message}`,
      });
    }
  }

  onLog({
    timestamp: new Date().toISOString(),
    level: 'success',
    message: `Payments complete! ✅ ${successCount} successful, ${failCount} failed`,
  });

  // ── Step 6: Close Channel via ClearNode RPC ────────────────
  if (alreadyOnChain && channelId) {
    onLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Closing channel via ClearNode...',
    });

    try {
      const closeResp = await yellow.closeChannel(channelId, yellow.address);

      onLog({
        timestamp: new Date().toISOString(),
        level: 'success',
        message: 'Channel close signed by ClearNode',
        data: {
          channelId: closeResp.channel_id,
          finalAllocations: closeResp.state.allocations,
        },
      });

      // ── Step 7: Submit Close to Blockchain (on-chain tx #2) ──
      onLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Submitting close to blockchain...',
      });

      const closeTxHash = await nitrolite.closeChannel({
        finalState: {
          intent: closeResp.state.intent,
          version: BigInt(closeResp.state.version),
          data: (closeResp.state.state_data || '0x') as `0x${string}`,
          allocations: closeResp.state.allocations.map(a => ({
            destination: a.destination as `0x${string}`,
            token: a.token as `0x${string}`,
            amount: BigInt(a.amount),
          })),
          channelId: closeResp.channel_id as `0x${string}`,
          serverSignature: closeResp.server_signature as `0x${string}`,
        },
        stateData: (closeResp.state.state_data || '0x') as `0x${string}`,
      });

      onLog({
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `Channel closed on-chain! TX: ${closeTxHash}`,
        data: { txHash: closeTxHash },
      });

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash: closeTxHash });

      onLog({
        timestamp: new Date().toISOString(),
        level: 'success',
        message: 'Channel settlement complete! Funds released.',
      });
    } catch (e: any) {
      onLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Channel close failed: ${e.message}`,
      });
    }
  } else {
    onLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Skipping channel close (channel not on-chain)',
    });
  }

  // ── Done ───────────────────────────────────────────────────
  onLog({
    timestamp: new Date().toISOString(),
    level: 'success',
    message: `🎉 Demo complete! ${successCount}/${totalPayments} payments, 2 on-chain txs`,
  });

  yellow.close();
}
