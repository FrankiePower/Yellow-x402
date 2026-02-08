
import { createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { YellowClient } from './lib/yellow-client';
import 'dotenv/config';
import WebSocket from 'ws';

// Polyfill WebSocket
// @ts-ignore
global.WebSocket = WebSocket;

async function main() {
  const account = privateKeyToAccount(generatePrivateKey());
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http()
  });

  // Enable debug logging
  const client = new YellowClient(walletClient);
  // @ts-ignore
  client.debug = true; 

  console.log('Connecting...');
  await client.connect();
  console.log('Connected & Authenticated');

  console.log('Calling getChannels...');
  // checking what comes back
  client.on('message', (data) => console.log('RAW MESSAGE:', data)); // redundant if debug is on

  try {
     const channels = await client.getChannels();
     console.log('getChannels resolved:', channels);
  } catch (e) {
     console.log('getChannels took too long or failed:', e);
  }

  client.close();
}

main().catch(console.error);
