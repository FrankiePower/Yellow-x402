# Yellow Nitrolite Integration Analysis

## Reference Project: Movie Streaming dApp (StreamFlow)

### Overview
The reference project is a decentralized movie streaming platform that allows users to pay for content by the second. It achieved success by leveraging **Nitrolite (Yellow Network)** to solve the problem of high gas fees and latency in continuous micropayments.

### How It Won First Place
The project stood out because it perfectly demonstrated the core value proposition of Yellow Network: **State Channels for Real-Time Settlement**.

1.  **Real-Time Billing**: Instead of paying upfront or per movie, users pay *per second* (0.0001 ETH/sec). This is impossible on L1/L2 due to gas costs and latency, but trivial with State Channels.
2.  **Instant Finality**: Payments are settled off-chain instantly, providing a seamless "Web2-like" experience.
3.  **Fallback Mechanism**: Requires a robust user experience; the app automatically falls back to standard Layer 1 transactions if the Nitrolite client fails or isn't configured, ensuring reliability.
4.  **Zero-Cost Streaming**: Users only pay gas for opening and closing the channel. The thousands of micro-transactions in between are free.

### Technical Implementation

#### 1. Core Components
-   **NitroliteClient**: The heart of the integration, initialized with a provider and signer.
-   **Sessions**: Usage is encapsulated in "sessions" (State Channels) between the User and the Creator.

#### 2. Workflow
1.  **Initialize**: `initializeNitrolite(provider, signer)` sets up the connection to the Yellow Network ClearNode.
2.  **Open Channel**: `createChannelSession(...)` establishes the off-chain link.
3.  **Stream Payments**: `processPayment(...)` is called repeatedly (or at intervals) as the user consumes content. These are off-chain and instant.
4.  **Settle**: `closeSession(...)` submits the final state to the blockchain (Adjudicator contract) to transfer the aggregated funds.

#### 3. Critical Code Fragments
**Initialization:**
```javascript
import { initializeNitrolite } from '../services/nitrolite';
// Initialize with injected wallet provider
const client = await initializeNitrolite(provider, signer);
```

**Payment Loop (Off-chain):**
```javascript
// This happens instantly without gas
await processPayment(client, session, calculateCurrentAmount(), creatorAddress);
```

**Settlement (On-chain):**
```javascript
// One transaction to finalize all previous micro-payments
await closeSession(client, session);
```

### Key Takeaways for Our Hack
-   **Focus on Flow**: The "Open -> Micro-transact -> Close" loop is the winning pattern.
-   **UX is King**: Handle errors gracefully. If Nitrolite is down, the app should still work (even if expensive).
-   **Show the Speed**: The UI should visually demonstrate the "real-time" nature (e.g., a ticking cost counter).

## Reference Project: Perp Markets (Polymarket Perpetual Trading)

### Overview
This project builds a real-time perpetual trading interface on top of Polymarket's prediction markets. Unlike the StreamFlow project which directly integrated the SDK, Perpmarkets demonstrates an **architectural alignment** with Yellow Network's principles.

### Integration Approach: "Pattern Mirroring"
Instead of a direct SDK integration in the provided codebase, Perpmarkets adopts the **Nitrolite Architecture Pattern** for handling high-frequency real-time data.

1.  **WebSocket-First Design**:
    -   The project uses a `WebSocketService` (`src/lib/websocket.ts`) that explicitly mimics the `nitrolite-example` pattern.
    -   It handles connection states (`Connecting`, `Connected`, `Disconnected`) exactly how a State Channel client must manage its connection to a broker/adjudicator.

2.  **State Management**:
    -   The `Balance` component (`src/components/Balance.tsx`) references `nitrolite BalanceDisplay component pattern`.
    -   This prepares the UI to handle rapid, off-chain balance updates—a requirement for both high-frequency trading and state channels.

3.  **Settlement Strategy (Planned)**:
    -   The documentation outlines a "Settlement logic" phase, where the high-frequency trades (handled via the WebSocket/State Channel pattern) would be finalized on-chain.
    -   This is the ideal use case for Yellow: matching orders off-chain at lightspeed and settling the net result on-chain.

### Why This Matters
For our hackathon entry, Perpmarkets shows us **how to structure the frontend** for a State Channel app:
-   **Decouple UI from Chain**: The UI shouldn't wait for a transaction hash. It should react to WebSocket messages immediately.
-   ** robust Connection Handling**: State channels require a persistent connection. The `WebSocketService` implementation provides a robust template for this.

some quick start examples:
Quick Start Guide

Build your first Yellow App in 5 minutes! This guide walks you through creating a simple payment application using state channels.
What You'll Build

A basic payment app where users can:

    Deposit funds into a state channel
    Send instant payments to another user
    Withdraw remaining funds

No blockchain knowledge required - we'll handle the complexity for you!
Prerequisites

    Node.js 16+ installed on your computer
    A wallet (MetaMask recommended)
    Basic JavaScript/TypeScript knowledge

Step 1: Installation

Create a new project and install the Yellow SDK:

    npm
    yarn
    pnpm

mkdir my-yellow-app
cd my-yellow-app
npm init -y
npm install @erc7824/nitrolite

Step 2: Connect to ClearNode

Create a file app.js and connect to the Yellow Network.
Clearnode Endpoints

    Production: wss://clearnet.yellow.com/ws
    Sandbox: wss://clearnet-sandbox.yellow.com/ws (recommended for testing)

app.js

import { createAppSessionMessage, parseRPCResponse } from '@erc7824/nitrolite';

// Connect to Yellow Network (using sandbox for testing)
const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');

ws.onopen = () => {
  console.log('✅ Connected to Yellow Network!');
};

ws.onmessage = (event) => {
  const message = parseRPCResponse(event.data);
  console.log('📨 Received:', message);
};

ws.onerror = (error) => {
  console.error('Connection error:', error);
};

console.log('Connecting to Yellow Network...');

Step 3: Create Application Session

Set up your wallet for signing messages:

// Set up message signer for your wallet
async function setupMessageSigner() {
  if (!window.ethereum) {
    throw new Error('Please install MetaMask');
  }

  // Request wallet connection
  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts'
  });
  
  const userAddress = accounts[0];
  
  // Create message signer function
  const messageSigner = async (message) => {
    return await window.ethereum.request({
      method: 'personal_sign',
      params: [message, userAddress]
    });
  };

  console.log('✅ Wallet connected:', userAddress);
  return { userAddress, messageSigner };
}

Step 4: Create Application Session

Create a session for your payment app:

async function createPaymentSession(messageSigner, userAddress, partnerAddress) {
  // Define your payment application
  const appDefinition = {
    protocol: 'payment-app-v1',
    participants: [userAddress, partnerAddress],
    weights: [50, 50], // Equal participation
    quorum: 100, // Both participants must agree
    challenge: 0,
    nonce: Date.now()
  };

  // Initial balances (1 USDC = 1,000,000 units with 6 decimals)
  const allocations = [
    { participant: userAddress, asset: 'usdc', amount: '800000' }, // 0.8 USDC
    { participant: partnerAddress, asset: 'usdc', amount: '200000' } // 0.2 USDC
  ];

  // Create signed session message
  const sessionMessage = await createAppSessionMessage(
    messageSigner,
    [{ definition: appDefinition, allocations }]
  );

  // Send to ClearNode
  ws.send(sessionMessage);
  console.log('✅ Payment session created!');
  
  return { appDefinition, allocations };
}

Step 5: Send Instant Payments

async function sendPayment(ws, messageSigner, amount, recipient) {
  // Create payment message
  const paymentData = {
    type: 'payment',
    amount: amount.toString(),
    recipient,
    timestamp: Date.now()
  };

  // Sign the payment
  const signature = await messageSigner(JSON.stringify(paymentData));
  
  const signedPayment = {
    ...paymentData,
    signature,
    sender: await getCurrentUserAddress()
  };

  // Send instantly through ClearNode
  ws.send(JSON.stringify(signedPayment));
  console.log('💸 Payment sent instantly!');
}

// Usage
await sendPayment(ws, messageSigner, 100000n, partnerAddress); // Send 0.1 USDC

Step 6: Handle Incoming Messages

// Enhanced message handling
ws.onmessage = (event) => {
  const message = parseRPCResponse(event.data);
  
  switch (message.type) {
    case 'session_created':
      console.log('✅ Session confirmed:', message.sessionId);
      break;
      
    case 'payment':
      console.log('💰 Payment received:', message.amount);
      // Update your app's UI
      updateBalance(message.amount, message.sender);
      break;
      
    case 'session_message':
      console.log('📨 App message:', message.data);
      handleAppMessage(message);
      break;
      
    case 'error':
      console.error('❌ Error:', message.error);
      break;
  }
};

function updateBalance(amount, sender) {
  console.log(`Received ${amount} from ${sender}`);
  // Update your application state
}

Complete Example

Here's a complete working example you can copy and run:
SimplePaymentApp.js

import { createAppSessionMessage, parseRPCResponse } from '@erc7824/nitrolite';

class SimplePaymentApp {
  constructor() {
    this.ws = null;
    this.messageSigner = null;
    this.userAddress = null;
    this.sessionId = null;
  }

  async init() {
    // Step 1: Set up wallet
    const { userAddress, messageSigner } = await this.setupWallet();
    this.userAddress = userAddress;
    this.messageSigner = messageSigner;
    
    // Step 2: Connect to ClearNode (sandbox for testing)
    this.ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');
    
    this.ws.onopen = () => {
      console.log('🟢 Connected to Yellow Network!');
    };
    
    this.ws.onmessage = (event) => {
      this.handleMessage(parseRPCResponse(event.data));
    };
    
    return userAddress;
  }

  async setupWallet() {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    
    const userAddress = accounts[0];
    const messageSigner = async (message) => {
      return await window.ethereum.request({
        method: 'personal_sign',
        params: [message, userAddress]
      });
    };

    return { userAddress, messageSigner };
  }

  async createSession(partnerAddress) {
    const appDefinition = {
      protocol: 'payment-app-v1',
      participants: [this.userAddress, partnerAddress],
      weights: [50, 50],
      quorum: 100,
      challenge: 0,
      nonce: Date.now()
    };

    const allocations = [
      { participant: this.userAddress, asset: 'usdc', amount: '800000' },
      { participant: partnerAddress, asset: 'usdc', amount: '200000' }
    ];

    const sessionMessage = await createAppSessionMessage(
      this.messageSigner,
      [{ definition: appDefinition, allocations }]
    );

    this.ws.send(sessionMessage);
    console.log('✅ Payment session created!');
  }

  async sendPayment(amount, recipient) {
    const paymentData = {
      type: 'payment',
      amount: amount.toString(),
      recipient,
      timestamp: Date.now()
    };

    const signature = await this.messageSigner(JSON.stringify(paymentData));
    
    this.ws.send(JSON.stringify({
      ...paymentData,
      signature,
      sender: this.userAddress
    }));
    
    console.log(`💸 Sent ${amount} instantly!`);
  }

  handleMessage(message) {
    switch (message.type) {
      case 'session_created':
        this.sessionId = message.sessionId;
        console.log('✅ Session ready:', this.sessionId);
        break;
      case 'payment':
        console.log('💰 Payment received:', message.amount);
        break;
    }
  }
}

// Usage
const app = new SimplePaymentApp();
await app.init();
await app.createSession('0xPartnerAddress');
await app.sendPayment('100000', '0xPartnerAddress'); // Send 0.1 USDC

What's Next?

Congratulations! You've built your first Yellow App. Here's what to explore next:

    Advanced Topics: Learn about architecture, multi-party applications, and production deployment
    API Reference: Explore all available SDK methods and options

Need Help?

    Documentation: Continue reading the guides for in-depth explanations
    Community: Join our developer community for support
    Examples: Check out our GitHub repository for sample applications

You're now ready to build fast, scalable apps with Yellow SDK!

start guide 2:
Quickstart Guide

This guide provides a step-by-step walkthrough of integrating with the Yellow Network using the Nitrolite SDK. We will build a script to connect to the network, authenticate, manage state channels, and transfer funds.
Prerequisites

    Node.js (v18 or higher)
    npm

Setup

    Install Dependencies

    npm install

    Environment Variables

    Create a .env file in your project root:

    # .env
    PRIVATE_KEY=your_sepolia_private_key_here
    ALCHEMY_RPC_URL=your_alchemy_rpc_url_here

1. Getting Funds

Before we write code, you need test tokens (ytest.usd). In the Sandbox, these tokens land in your Unified Balance (Off-Chain), which sits in the Yellow Network's clearing layer.

Request tokens via the Faucet:

curl -XPOST https://clearnet-sandbox.yellow.com/faucet/requestTokens \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"<your_wallet_address>"}'

2. Initialization

First, we setup the NitroliteClient with Viem. This client handles all communication with the Yellow Network nodes and smart contracts.

import { NitroliteClient, WalletStateSigner, createECDSAMessageSigner } from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import WebSocket from 'ws';
import 'dotenv/config';

// Setup Viem Clients
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.ALCHEMY_RPC_URL) });
const walletClient = createWalletClient({ chain: sepolia, transport: http(), account });

// Initialize Nitrolite Client
const client = new NitroliteClient({
    publicClient,
    walletClient,
    stateSigner: new WalletStateSigner(walletClient),
    addresses: {
        custody: '0x019B65A265EB3363822f2752141b3dF16131b262',
        adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
    },
    chainId: sepolia.id,
    challengeDuration: 3600n,
});

// Connect to Sandbox Node
const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');

3. Authentication

Authentication involves generating a temporary Session Key and verifying your identity using your main wallet (EIP-712).

// Generate temporary session key
const sessionPrivateKey = generatePrivateKey();
const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);
const sessionAccount = privateKeyToAccount(sessionPrivateKey);

// Send auth request
const authRequestMsg = await createAuthRequestMessage({
    address: account.address,
    application: 'Test app',
    session_key: sessionAccount.address,
    allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
    expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
    scope: 'test.app',
});
ws.send(authRequestMsg);

// Handle Challenge (in ws.onmessage)
if (type === 'auth_challenge') {
    const challenge = response.res[2].challenge_message;
    // Sign with MAIN wallet
    const signer = createEIP712AuthMessageSigner(walletClient, authParams, { name: 'Test app' });
    const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
    ws.send(verifyMsg);
}

4. Channel Lifecycle
Creating a Channel

If no channel exists, we request the Node to open one.

const createChannelMsg = await createCreateChannelMessage(
    sessionSigner, // Sign with session key
    {
        chain_id: 11155111, // Sepolia
        token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // ytest.usd
    }
);
ws.send(createChannelMsg);

// Listen for 'create_channel' response, then submit to chain
const createResult = await client.createChannel({
    channel,
    unsignedInitialState,
    serverSignature,
});

Funding (Resizing)

To fund the channel, we perform a "Resize". Since your funds are in your Unified Balance (from the Faucet), we use allocate_amount to move them into the Channel.

    Important: Do NOT use resize_amount unless you have deposited funds directly into the L1 Custody Contract.

const resizeMsg = await createResizeChannelMessage(
    sessionSigner,
    {
        channel_id: channelId,
        allocate_amount: 20n, // Moves 20 units from Unified Balance -> Channel
        funds_destination: account.address,
    }
);
ws.send(resizeMsg);

// Submit resize proof to chain
await client.resizeChannel({ resizeState, proofStates });

Closing & Withdrawing

Finally, we cooperatively close the channel. This settles the balance on the L1 Custody Contract, allowing you to withdraw.

// Close Channel
const closeMsg = await createCloseChannelMessage(sessionSigner, channelId, account.address);
ws.send(closeMsg);

// Submit close to chain
await client.closeChannel({ finalState, stateData });

// Withdraw from Custody Contract to Wallet
const withdrawalTx = await client.withdrawal(tokenAddress, withdrawableBalance);
console.log('Funds withdrawn:', withdrawalTx);

Troubleshooting

Here are common issues and solutions:

    InsufficientBalance:
        Cause: Trying to use resize_amount (L1 funds) without depositing first.
        Fix: Use allocate_amount to fund from your Off-chain Unified Balance (Faucet).

    DepositAlreadyFulfilled:
        Cause: Double-submitting a funding request or channel creation.
        Fix: Check if the channel is already open or funded before sending requests.

    InvalidState:
        Cause: Resizing a closed channel or version mismatch.
        Fix: Ensure you are using the latest channel state from the Node.

    operation denied: non-zero allocation:
        Cause: Too many "stale" channels open.
        Fix: Run the cleanup script npx tsx close_all.ts.

    Timeout waiting for User to fund Custody:
        Cause: Re-running scripts without closing channels accumulates balance requirements.
        Fix: Run close_all.ts to reset.

Cleanup Script

If you get stuck, use this script to close all open channels:

npx tsx close_all.ts

Complete Code
index.ts
Click to view full index.ts
close_all.ts
Click to view full close_all.ts

import {
    NitroliteClient,
    WalletStateSigner,
    createECDSAMessageSigner,
    createEIP712AuthMessageSigner,
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createCloseChannelMessage,
} from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import WebSocket from 'ws';
import 'dotenv/config';
import * as readline from 'readline';

// Helper to prompt for input
const askQuestion = (query: string): Promise<string> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
};

// Configuration
const WS_URL = 'wss://clearnet-sandbox.yellow.com/ws';

async function main() {
    console.log('Starting cleanup script...');

    // Setup Viem Clients
    let PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;

    if (!PRIVATE_KEY) {
        console.log('PRIVATE_KEY not found in .env');
        const inputKey = await askQuestion('Please enter your Private Key: ');
        if (!inputKey) {
            throw new Error('Private Key is required');
        }
        PRIVATE_KEY = inputKey.startsWith('0x') ? inputKey as `0x${string}` : `0x${inputKey}` as `0x${string}`;
    }

    const account = privateKeyToAccount(PRIVATE_KEY);

    const ALCHEMY_RPC_URL = process.env.ALCHEMY_RPC_URL;
    const FALLBACK_RPC_URL = 'https://1rpc.io/sepolia'; // Public fallback
    const RPC_URL = ALCHEMY_RPC_URL || FALLBACK_RPC_URL;
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(RPC_URL),
    });
    const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(RPC_URL),
    });

    // Initialize Nitrolite Client
    const client = new NitroliteClient({
        publicClient,
        walletClient,
        addresses: {
            custody: '0x019B65A265EB3363822f2752141b3dF16131b262',
            adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
        },
        challengeDuration: 3600n,
        chainId: sepolia.id,
        stateSigner: new WalletStateSigner(walletClient),
    });

    // Connect to WebSocket
    const ws = new WebSocket(WS_URL);
    const sessionPrivateKey = generatePrivateKey();
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);

    await new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve());
        ws.on('error', (err) => reject(err));
    });
    console.log('✓ Connected to WebSocket');

    // Authenticate
    const authParams = {
        session_key: sessionAccount.address,
        allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
        expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
        scope: 'test.app',
    };

    const authRequestMsg = await createAuthRequestMessage({
        address: account.address,
        application: 'Test app',
        ...authParams
    });
    ws.send(authRequestMsg);

    ws.on('message', async (data) => {
        const response = JSON.parse(data.toString());

        if (response.res) {
            const type = response.res[1];

            if (type === 'auth_challenge') {
                const challenge = response.res[2].challenge_message;
                const signer = createEIP712AuthMessageSigner(walletClient, authParams, { name: 'Test app' });
                const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
                ws.send(verifyMsg);
            }

            if (type === 'auth_verify') {
                console.log('✓ Authenticated');

                // Fetch open channels from L1 Contract
                console.log('Fetching open channels from L1...');
                try {
                    const openChannelsL1 = await client.getOpenChannels();
                    console.log(`Found ${openChannelsL1.length} open channels on L1.`);

                    if (openChannelsL1.length === 0) {
                        console.log('No open channels on L1 to close.');
                        process.exit(0);
                    }

                    // Iterate and close
                    for (const channelId of openChannelsL1) {
                        console.log(`Attempting to close channel ${channelId}...`);

                        // Send close request to Node
                        const closeMsg = await createCloseChannelMessage(
                            sessionSigner,
                            channelId,
                            account.address
                        );
                        ws.send(closeMsg);

                        // Small delay to avoid rate limits
                        await new Promise(r => setTimeout(r, 500));
                    }

                } catch (e) {
                    console.error('Error fetching L1 channels:', e);
                    process.exit(1);
                }
            }

            if (type === 'close_channel') {
                const { channel_id, state, server_signature } = response.res[2];
                console.log(`✓ Node signed close for ${channel_id}`);

                const finalState = {
                    intent: state.intent,
                    version: BigInt(state.version),
                    data: state.state_data,
                    allocations: state.allocations.map((a: any) => ({
                        destination: a.destination,
                        token: a.token,
                        amount: BigInt(a.amount),
                    })),
                    channelId: channel_id,
                    serverSignature: server_signature,
                };

                try {
                    console.log(`  Submitting close to L1 for ${channel_id}...`);
                    const txHash = await client.closeChannel({
                        finalState,
                        stateData: finalState.data
                    });
                    console.log(`✓ Closed on-chain: ${txHash}`);
                } catch (e) {
                    // If it fails (e.g. already closed or race condition), just log and continue
                    console.error(`Failed to close ${channel_id} on-chain:`, e);
                }
            }

            if (response.error) {
                console.error('WS Error:', response.error);
            }
        }
    });
}

main();

Edit this page