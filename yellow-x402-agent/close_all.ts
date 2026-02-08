
import 'dotenv/config';
import { YellowClient } from './src/lib/yellow-client.js';
import { NitroliteClient, WalletStateSigner } from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const PRIV_KEY = process.env.BUYER_PRIVATE_KEY as `0x${string}`;
const CUSTODY_ADDRESS = '0x019B65A265EB3363822f2752141b3dF16131b262';
const ADJUDICATOR_ADDRESS = '0x7c7ccbc98469190849BCC6c926307794fDfB11F2';

async function main() {
  console.log('[cleanup] starting ...');
  
  if (!PRIV_KEY) throw new Error('BUYER_PRIVATE_KEY missing');

  const yellow = new YellowClient(PRIV_KEY, { appName: 'cleanup-script' });
  await yellow.connect();
  console.log(`[cleanup] connected as ${yellow.address}`);

  // Fetch channels
  const { channels } = await yellow.getChannels();
  console.log(`[cleanup] found ${channels.length} channels`);

  if (channels.length === 0) {
    console.log('[cleanup] no channels to close');
    yellow.close();
    return;
  }

  // Nitrolite for on-chain
  const account = privateKeyToAccount(PRIV_KEY);
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

  for (const ch of channels) {
    if (ch.status !== 'open' && ch.status !== 'active') { // Adjust based on actual status string
        // check status field? Nitrolite returns integers or strings?
        // Let's assume we want to close everything returned by getChannels()
    }
    
    console.log(`[cleanup] closing ${ch.channel_id} ...`);
    
    try {
      // 1. RPC Close
      const closeResp = await yellow.closeChannel(ch.channel_id, yellow.address);
      console.log(`[cleanup]   RPC closed. Allocations:`, closeResp.state.allocations);
      
      // 2. On-chain Close
      // We need last valid state. closeResp gives us the final state agreed by server.
      const closeHash = await nitrolite.closeChannel({
        finalState: {
          intent: closeResp.state.intent,
          version: BigInt(closeResp.state.version),
          data: (closeResp.state.state_data || '0x') as `0x${string}`,
          allocations: closeResp.state.allocations.map((a: any) => ({
            destination: a.destination as `0x${string}`,
            token: a.token as `0x${string}`,
            amount: BigInt(a.amount),
          })),
          channelId: closeResp.channel_id as `0x${string}`,
          serverSignature: closeResp.server_signature as `0x${string}`,
        },
        stateData: (closeResp.state.state_data || '0x') as `0x${string}`,
      });
      console.log(`[cleanup]   On-chain close tx: ${closeHash}`);
      await publicClient.waitForTransactionReceipt({ hash: closeHash });
      console.log(`[cleanup]   Confirmed.`);
    } catch (e: any) {
      console.error(`[cleanup]   Failed to close ${ch.channel_id}:`, e.message);
    }
  }

  yellow.close();
  console.log('[cleanup] done');
}

main().catch(console.error);
