
import { createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { YellowClient } from './lib/yellow-client';
import 'dotenv/config';
import WebSocket from 'ws';

// Polyfill WebSocket
// @ts-ignore
global.WebSocket = WebSocket;

// We need to subclass or modify YellowClient to allow passing custom auth params
// Since we can't easily modify the class instance auth params without changing code,
// I'll just instantiate it and modify the private `authPartial` if I can, or 
// better yet, I will verify if I can pass options. 
// The YellowClient hardcodes doAuth() logic. 
// I will copy the minimal auth logic here to test.

import {
  createAuthRequestMessage,
  createECDSAMessageSigner,
  createEIP712AuthMessageSigner,
  createAuthVerifyMessageFromChallenge,
} from '@erc7824/nitrolite';

async function testAuth(label: string, params: any) {
  console.log(`\n--- Testing: ${label} ---`);
  const privateKey = process.env.BUYER_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
     console.error("No BUYER_PRIVATE_KEY");
     return;
  }
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http()
  });

  const sessionPk = generatePrivateKey();
  const sessionAddress = privateKeyToAccount(sessionPk).address;
  const sessionSigner = createECDSAMessageSigner(sessionPk);

  const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');
  
  await new Promise<void>((resolve) => ws.on('open', resolve));
  console.log("WS Connected");

  const authPartial = {
    session_key: sessionAddress,
    expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
    ...params
  };

  const msg = await createAuthRequestMessage({
    address: account.address,
    application: 'x402-debug',
    ...authPartial
  });

  ws.send(msg);

  return new Promise((resolve) => {
    ws.on('message', async (data) => {
      const raw = data.toString();
      const payload = JSON.parse(raw);
      
      if (payload.error) {
          console.error("Auth Error:", JSON.stringify(payload.error));
          ws.close();
          resolve(false);
          return;
      }
      
      const method = payload.res?.[1];
      const body = payload.res?.[2];

      if (method === 'auth_challenge') {
          console.log("Received Challenge");
          const challengeStr = body.challenge_message ?? body.challengeMessage;
          const signer = createEIP712AuthMessageSigner(walletClient, authPartial, { name: 'x402-debug' });
          const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challengeStr);
          ws.send(verifyMsg);
      } else if (method === 'auth_verify') {
          console.log("Auth Success!", body);
          ws.close();
          resolve(true);
      } else if (method === 'error') {
          console.error("RPC Error:", JSON.stringify(body));
          ws.close();
          resolve(false);
      }
    });

    // Timeout
    setTimeout(() => {
        console.log("Timeout");
        ws.close();
        resolve(false);
    }, 5000);
  });
}

async function main() {
    // 1. Original failing case (ytest.usd)
    // await testAuth("ytest.usd default", { 
    //     scope: 'x402.app', 
    //     allowances: [{ asset: 'ytest.usd', amount: '1000000000' }] 
    // });

    // 2. Token Address (also failing)
    // await testAuth("Token Address", {
    //     scope: 'x402.app',
    //     allowances: [{ asset: '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb', amount: '1000000000' }]
    // });

    // 3. ytest.usd with 0 amount
    // await testAuth("ytest.usd amount 0", {
    //     scope: 'x402.app',
    //     allowances: [{ asset: 'ytest.usd', amount: '0' }]
    // });

    // 4. Different scope with Token Address
    await testAuth("test.app with Token Address", {
        scope: 'test.app',
        allowances: [{ asset: '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb', amount: '1000000000' }]
    });

}

main().catch(console.error);
