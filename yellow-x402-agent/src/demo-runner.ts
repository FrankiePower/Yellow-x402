/**
 * demo-runner.ts — Execute the buyer demo flow and capture logs
 * 
 * This module runs the same logic as buyer/index.ts but captures
 * all console output and returns it as structured log entries.
 */

import { YellowClient } from './lib/yellow-client.js';

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:4000';

// Repeat endpoints to support 100 payments
const BASE_ENDPOINTS = ['/resource', '/data', '/quote'];
const ENDPOINTS = Array(34).fill(BASE_ENDPOINTS).flat(); // 34*3 = 102 endpoints

export interface DemoLogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'success';
  message: string;
  data?: any;
}

export interface DemoResult {
  success: boolean;
  logs: DemoLogEntry[];
  error?: string;
}

/** Hit a paid endpoint: 402 → transfer → retry with X-PAYMENT. */
async function doPaidRequest(
  yellow: YellowClient,
  path: string,
  logs: DemoLogEntry[]
): Promise<void> {
  logs.push({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Hitting ${SERVICE_URL}${path}...`,
  });

  // Initial request — expect 402
  let res = await fetch(`${SERVICE_URL}${path}`);
  logs.push({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Status: ${res.status}`,
  });

  if (res.status !== 402) {
    const body = await res.text();
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: `Unexpected status: ${res.status}`,
      data: body,
    });
    return;
  }

  // Parse requirements
  const body402 = (await res.json()) as {
    accepts: Array<{
      scheme: string;
      network: string;
      maxAmountRequired: string;
      payTo: string;
      asset: string;
    }>;
  };
  const req = body402.accepts[0];
  logs.push({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Payment required: ${req.maxAmountRequired} ${req.asset} → ${req.payTo}`,
  });

  // Pay via Yellow (off-chain, instant)
  const transactions = await yellow.transfer({
    destination: req.payTo as `0x${string}`,
    asset: req.asset,
    amount: req.maxAmountRequired,
  });
  const tx = transactions[0];
  logs.push({
    timestamp: new Date().toISOString(),
    level: 'success',
    message: `Payment sent! Transaction ID: ${tx.id}, Amount: ${tx.amount}`,
    data: { transactionId: tx.id, amount: tx.amount, asset: tx.asset },
  });

  // Build X-PAYMENT header
  const xPayment = Buffer.from(
    JSON.stringify({
      x402Version: 1,
      scheme: req.scheme,
      network: req.network,
      payload: {
        transactionId: tx.id,
        fromAccount: tx.from_account,
        toAccount: tx.to_account,
        asset: tx.asset,
        amount: tx.amount,
      },
    })
  ).toString('base64');

  // Retry with payment
  res = await fetch(`${SERVICE_URL}${path}`, {
    headers: { 'X-PAYMENT': xPayment },
  });
  const responseData = await res.json();

  logs.push({
    timestamp: new Date().toISOString(),
    level: res.ok ? 'success' : 'error',
    message: `Response status: ${res.status}`,
    data: responseData,
  });
}

/**
 * Run the full demo flow:
 * 1. Connect to Yellow Network
 * 2. Authenticate
 * 3. Make 3 paid requests
 * 4. Return all logs
 */
export async function runDemo(buyerPrivateKey: string): Promise<DemoResult> {
  const logs: DemoLogEntry[] = [];

  try {
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Starting Yellow Network demo...',
    });

    // Create Yellow client
    const yellow = new YellowClient(buyerPrivateKey as `0x${string}`, {
      appName: 'x402-buyer',
      clearnetUrl: process.env.CLEARNET_URL,
    });

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Connecting to Yellow Network...',
    });

    await yellow.connect();

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'success',
      message: `Connected! Address: ${yellow.address}`,
      data: { address: yellow.address },
    });

    // Get ledger balances
    const { balances } = await yellow.getLedgerBalances();
    const initialBalance = balances.find(b => b.asset === 'ytest.usd');
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Unified Balance retrieved',
      data: { balances },
    });

    // Check if we have enough funds for 100 payments
    // Each payment costs: /resource=10000, /data=5000, /quote=2000 = 17,000 per cycle
    // 100 payments / 3 endpoints = ~34 cycles = 578,000 units minimum
    const requiredBalance = 600000; // 0.6 USDC minimum
    const currentBalance = initialBalance ? parseFloat(initialBalance.amount) : 0;
    
    if (currentBalance < requiredBalance) {
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Insufficient balance: ${currentBalance} units (need ${requiredBalance})`,
        data: { 
          current: currentBalance, 
          required: requiredBalance,
          note: 'Need more Faucet funds or reduce payment count.'
        },
      });
      
      return {
        success: false,
        logs,
        error: `Insufficient balance for 100 payments. Current: ${currentBalance}, Required: ${requiredBalance}`,
      };
    }

    // Create channel and allocate funds from Unified Balance
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Creating payment channel...',
    });

    try {
      const serviceAddress = '0xbF08D2f042C80d59Fa8F2A9e84B1EEFE295FCdDE'; // Service address
      const channel = await yellow.createChannel({
        chain_id: 11155111, // Sepolia
        token: '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb', // ytest.usd token address
      });

      logs.push({
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `Channel created: ${channel.channel_id}`,
        data: { channelId: channel.channel_id },
      });

      // Allocate funds from Unified Balance to Channel
      // Negative allocate_amount moves funds: Unified → Channel
      const allocateAmount = -600000n; // Allocate 0.6 USDC to channel
      
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Allocating ${Math.abs(Number(allocateAmount))} units from Unified Balance to channel...`,
      });

      await yellow.resizeChannel({
        channel_id: channel.channel_id,
        allocate_amount: allocateAmount,
      });

      logs.push({
        timestamp: new Date().toISOString(),
        level: 'success',
        message: 'Channel funded successfully! Ready for 100 payments.',
      });
    } catch (error: any) {
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Channel setup failed: ${error.message}`,
      });
      
      // Fall back to Unified Balance payments
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Falling back to Unified Balance payments...',
      });
    }

    // Make paid requests
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Making 100 paid requests (balance: ${currentBalance} units)...`,
    });

    let successCount = 0;
    let failCount = 0;
    const totalPayments = 100;

    for (let i = 0; i < totalPayments; i++) {
      const endpoint = ENDPOINTS[i % ENDPOINTS.length];
      try {
        await doPaidRequest(yellow, endpoint, logs);
        successCount++;
        
        // Log progress every 10 payments
        if ((i + 1) % 10 === 0) {
          logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Progress: ${i + 1}/${totalPayments} payments completed`,
          });
        }
      } catch (error: any) {
        failCount++;
        logs.push({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Payment ${i + 1} failed: ${error.message}`,
        });
      }
    }

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'success',
      message: `Demo completed! ✅ ${successCount} successful, ${failCount} failed`,
    });

    yellow.close();

    return {
      success: true,
      logs,
    };
  } catch (error: any) {
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: `Demo failed: ${error.message}`,
      data: { error: error.stack },
    });

    return {
      success: false,
      logs,
      error: error.message,
    };
  }
}
