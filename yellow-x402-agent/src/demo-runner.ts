/**
 * demo-runner.ts — Execute the buyer demo flow and capture logs
 * 
 * This module runs the same logic as buyer/index.ts but captures
 * all console output and returns it as structured log entries.
 */

import { YellowClient } from './lib/yellow-client.js';

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:4000';
const ENDPOINTS = ['/resource', '/data', '/quote'];

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
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Unified Balance retrieved',
      data: { balances },
    });

    // Make paid requests
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Making paid requests...',
    });

    for (const endpoint of ENDPOINTS) {
      await doPaidRequest(yellow, endpoint, logs);
    }

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'success',
      message: 'Demo completed successfully! ✅',
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
