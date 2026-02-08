/**
 * demo-runner-stream.ts — Execute demo with real-time log streaming
 */

import { YellowClient } from './lib/yellow-client.js';
import type { DemoLogEntry } from './demo-runner.js';

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:4000';
const BASE_ENDPOINTS = ['/resource', '/data', '/quote'];
const ENDPOINTS = Array(34).fill(BASE_ENDPOINTS).flat();

type LogCallback = (log: DemoLogEntry) => void;

async function doPaidRequest(
  yellow: YellowClient,
  path: string,
  onLog: LogCallback
): Promise<void> {
  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Hitting ${SERVICE_URL}${path}...`,
  });

  let res = await fetch(`${SERVICE_URL}${path}`);
  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Status: ${res.status}`,
  });

  if (res.status !== 402) {
    const body = await res.text();
    onLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: `Unexpected status: ${res.status}`,
      data: body,
    });
    return;
  }

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
  
  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Payment required: ${req.maxAmountRequired} ${req.asset}`,
  });

  const transactions = await yellow.transfer({
    destination: req.payTo as `0x${string}`,
    asset: req.asset,
    amount: req.maxAmountRequired,
  });
  const tx = transactions[0];
  
  onLog({
    timestamp: new Date().toISOString(),
    level: 'success',
    message: `Payment sent! TX ${tx.id}`,
    data: { transactionId: tx.id, amount: tx.amount },
  });

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

  res = await fetch(`${SERVICE_URL}${path}`, {
    headers: { 'X-PAYMENT': xPayment },
  });
  const responseData = await res.json();

  onLog({
    timestamp: new Date().toISOString(),
    level: res.ok ? 'success' : 'error',
    message: `Response: ${res.status}`,
    data: responseData,
  });
}

export async function runDemoWithStreaming(
  buyerPrivateKey: string,
  onLog: LogCallback
): Promise<void> {
  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Starting Yellow Network demo...',
  });

  const yellow = new YellowClient(buyerPrivateKey as `0x${string}`, {
    appName: 'x402-buyer',
    clearnetUrl: process.env.CLEARNET_URL,
  });

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
  });

  const { balances } = await yellow.getLedgerBalances();
  const initialBalance = balances.find(b => b.asset === 'ytest.usd');
  const currentBalance = initialBalance ? parseFloat(initialBalance.amount) : 0;

  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Balance: ${currentBalance} units`,
    data: { balances },
  });

  const totalPayments = 100;

  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Starting 100 payments with optimized channel flow...`,
  });

  // Step 1: Do ONE 402 handshake to establish payment channel
  onLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Establishing payment channel with first request...`,
  });

  let paymentChannel: { payTo: string; asset: string } | null = null;
  
  // First request establishes the channel
  const firstEndpoint = ENDPOINTS[0];
  let res = await fetch(`${SERVICE_URL}${firstEndpoint}`);
  
  if (res.status === 402) {
    const body402 = await res.json() as { accepts: Array<{ payTo: string; asset: string; maxAmountRequired: string }> };
    const req = body402.accepts[0];
    paymentChannel = { payTo: req.payTo, asset: req.asset };
    
    onLog({
      timestamp: new Date().toISOString(),
      level: 'success',
      message: `Payment channel established! Destination: ${req.payTo}`,
      data: { payTo: req.payTo, asset: req.asset },
    });
  }

  if (!paymentChannel) {
    throw new Error('Failed to establish payment channel');
  }

  // Step 2: Stream all 100 payments through the established channel
  let successCount = 0;
  let failCount = 0;

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
        
        if ((i + 1) % 10 === 0) {
          onLog({
            timestamp: new Date().toISOString(),
            level: 'success',
            message: `✅ ${i + 1}/${totalPayments} payments completed`,
          });
        }
      } else {
        failCount++;
        onLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Payment ${i + 1} failed: ${res.status}`,
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
    message: `Demo complete! ✅ ${successCount} successful, ${failCount} failed`,
  });

  yellow.close();
}
