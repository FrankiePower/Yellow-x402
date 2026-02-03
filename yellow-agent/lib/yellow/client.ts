/**
 * Yellow Network Client
 * 
 * A Node.js client for interacting with Yellow Network state channels.
 * Wraps the Nitrolite SDK for server-side agent use.
 */

import WebSocket from 'ws';
import { createWalletClient, http, type Hex, type Address } from 'viem';
import { privateKeyToAccount, signMessage } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import { 
  createAppSessionMessage, 
  parseAnyRPCResponse, 
  RPCProtocolVersion,
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createAuthVerifyMessageFromChallenge,
  createGetConfigMessage,
  type RPCAllowance
} from '@erc7824/nitrolite';

const EIP712AuthTypes = {
  Policy: [
    { name: 'challenge', type: 'string' },
    { name: 'scope', type: 'string' },
    { name: 'wallet', type: 'address' },
    { name: 'session_key', type: 'address' },
    { name: 'expires_at', type: 'uint64' },
    { name: 'allowances', type: 'Allowance[]' },
  ],
  Allowance: [
    { name: 'asset', type: 'string' },
    { name: 'amount', type: 'string' },
  ],
};

const YELLOW_DOMAIN = {
  name: 'Yellow Network',
  version: '1',
  chainId: 84532,
  // Updated to match get_config response for Base Sepolia
  verifyingContract: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2' as const
};

import {
  type YellowClientConfig,
  type SessionState,
  type PaymentProof,
  type ClearNodeMessage,
  type AppDefinition,
  type Allocation,
  CLEARNODE_URLS,
  USDC_BASE_SEPOLIA,
} from './types';

type MessageHandler = (message: ClearNodeMessage) => void;

/**
 * Yellow Network Client for AI Agents
 * 
 * Handles:
 * - WebSocket connection to ClearNode
 * - Session creation and management
 * - Payment signing and sending
 * - State synchronization
 */
export class YellowClient {
  private ws: WebSocket | null = null;
  private config: YellowClientConfig;
  private account: ReturnType<typeof privateKeyToAccount>;
  private signer: any; // Nitrolite signer function
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  
  // Current sessions managed by this client
  private sessions: Map<string, SessionState> = new Map();
  
  // Connection state
  // Connection state
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private connectResolve: (() => void) | null = null;
  private authParams: any = null;

  constructor(config: YellowClientConfig) {
    this.config = {
      clearNodeUrl: config.clearNodeUrl || CLEARNODE_URLS.SANDBOX,
      privateKey: config.privateKey,
      networkId: config.networkId || 'base-sepolia',
    };
    
    this.account = privateKeyToAccount(this.config.privateKey);
    // Signer will be initialized in connect() when we have auth params
    // OR we initialize a default signer that fails if auth params missing
    this.signer = async (payload: any) => {
      // EIP-712 Signing Strategy for AuthVerify
      if (payload[1] === 'auth_verify' && this.authParams) {
        const challenge = payload[2].challenge;
        
        const message = {
          ...this.authParams,
          wallet: this.address,
          challenge
        };

        return await this.account.signTypedData({
          domain: YELLOW_DOMAIN,
          types: EIP712AuthTypes,
          primaryType: 'Policy',
          message
        });
      }
      
      // Fallback for other messages (if any need signing) - e.g. personal_sign or raw
      const msgStr = JSON.stringify(payload);
      return await this.account.signMessage({ message: msgStr });
    };
    
    console.log(`[Yellow] Client initialized for address: ${this.account.address}`);
  }

  /**
   * Get the client's wallet address
   */
  get address(): Address {
    return this.account.address;
  }

  /**
   * Check if connected to ClearNode
   */
  get isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to ClearNode WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        console.log('[Yellow] Already connected');
        resolve();
        return;
      }

      console.log(`[Yellow] Connecting to ${this.config.clearNodeUrl}...`);
      
      this.ws = new WebSocket(this.config.clearNodeUrl);

      this.ws.onopen = async () => {
        console.log('[Yellow] ✅ Connected to ClearNode');
        this.connected = true;
        this.reconnectAttempts = 0;
        
        // Initiate authentication logic
        console.log('[Yellow] Initiating authentication flow...');
        
        // Probe config first to verify domain
        try {
          const configMsg = await createGetConfigMessage(this.signer);
          this.ws?.send(configMsg);
        } catch (e) {
          console.error('[Yellow] Failed to send get_config:', e);
        }

        try {
          // Expires in 24 hours
          const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 86400);
          
          this.authParams = {
            scope: 'yellow',
            session_key: this.address,
            expires_at: expiresAt, // ensure match with EIP712 type
            allowances: []
          };

          const authReq = await createAuthRequestMessage({
            address: this.address,
            application: this.address,
            ...this.authParams
          });
          
          this.ws?.send(authReq);
          // We WAIT for handleAuthChallenge to resolve this promise
          this.connectResolve = resolve as () => void;
          
        } catch (e) {
          console.error('[Yellow] Failed to create auth request:', e);
          reject(e);
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data.toString());
      };

      this.ws.onerror = (error) => {
        console.error('[Yellow] WebSocket error:', error);
        if (!this.connected) {
          reject(new Error('Failed to connect to ClearNode'));
        }
      };

      this.ws.onclose = () => {
        console.log('[Yellow] Connection closed');
        this.connected = false;
        this.attemptReconnect();
      };

      setTimeout(() => {
        if (!this.connected && this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Handle authentication challenge from ClearNode
   */
  private async handleAuthChallenge(msg: any): Promise<void> {
    try {
      console.log('[Yellow] Received auth challenge');
      
      const challenge = msg.params.challengeMessage || msg.params.challenge || msg.params.challenge_message;
      
      if (!challenge) {
        console.error('[Yellow] Challenge message missing params:', Object.keys(msg.params));
        return;
      }

      console.log('[Yellow] Signing challenge:', challenge);
      
      // Use createAuthVerifyMessageFromChallenge for cleaner UUID signing
      // This helper takes the signer and the UUID string
      const verifyMsg = await createAuthVerifyMessageFromChallenge(
        this.signer,
        challenge
      );
      
      this.ws?.send(verifyMsg);
      console.log('[Yellow] Sent auth verification');

      // We wait for 'auth_verify' message with success: true in handleMessage to resolve connection
      
    } catch (error) {
      console.error('[Yellow] Auth challenge failed:', error);
    }
  }

  /**
   * Disconnect from ClearNode
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Yellow] Max reconnect attempts reached');
      return;
    }

    const delay = Math.pow(2, this.reconnectAttempts) * 1000;
    this.reconnectAttempts++;
    
    console.log(`[Yellow] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
    setTimeout(() => this.connect(), delay);
  }

  /**
   * Create a message signer compatible with Nitrolite SDK
   */
  private async messageSigner(message: string | unknown): Promise<Hex> {
    const messageString = typeof message === 'string' 
      ? message 
      : JSON.stringify(message);
    return await this.account.signMessage({ message: messageString });
  }

  /**
   * Open a new payment session with another participant
   */
  async openSession(
    partnerAddress: Address,
    initialAmount: bigint,
    asset: Address = USDC_BASE_SEPOLIA
  ): Promise<string> {
    if (!this.isConnected) {
      await this.connect();
    }

    console.log(`[Yellow] Opening session with ${partnerAddress}...`);

    // Define the payment application
    const appDefinition: AppDefinition = {
      application: 'payment-app', 
      protocol: RPCProtocolVersion.NitroRPC_0_2 as any, // Cast to any to avoid strict enum match issues with AppDefinition which expects string
      participants: [this.address, partnerAddress],
      weights: [50, 50],
      quorum: 100,
      challenge: 0,
      nonce: Date.now(),
    };

    // Initial allocations - buyer funds the session
    const allocations: Allocation[] = [
      { participant: this.address, asset: asset.toLowerCase(), amount: initialAmount.toString() },
      { participant: partnerAddress, asset: asset.toLowerCase(), amount: '0' },
    ];

    // Create signed session message
    const sessionMessage = await createAppSessionMessage(
      this.signer,
      { definition: appDefinition, allocations }
    );

    // Send to ClearNode and wait for response
    const response = await this.sendAndWait(sessionMessage, 'session_created');
    
    if (response.sessionId) {
      // Store session state
      this.sessions.set(response.sessionId, {
        sessionId: response.sessionId,
        participants: [this.address, partnerAddress],
        allocations,
        sequenceNumber: 0,
        status: 'active',
      });
      
      console.log(`[Yellow] ✅ Session created: ${response.sessionId}`);
      return response.sessionId;
    }

    throw new Error('Failed to create session');
  }

  /**
   * Send a payment within an existing session
   */
  async pay(
    sessionId: string,
    amount: bigint,
    purpose?: string
  ): Promise<PaymentProof> {
    if (!this.isConnected) {
      await this.connect();
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    console.log(`[Yellow] Sending payment of ${amount} in session ${sessionId}...`);

    // Calculate new allocations
    const buyerCurrentBalance = BigInt(session.allocations[0].amount);
    const sellerCurrentBalance = BigInt(session.allocations[1].amount);
    
    if (amount > buyerCurrentBalance) {
      throw new Error('Insufficient balance in session');
    }

    const newBuyerBalance = buyerCurrentBalance - amount;
    const newSellerBalance = sellerCurrentBalance + amount;
    const newSequence = session.sequenceNumber + 1;
    const timestamp = Math.floor(Date.now() / 1000);

    // Create payment data
    const paymentData = {
      type: 'payment' as const,
      sessionId,
      amount: amount.toString(),
      recipient: session.participants[1],
      timestamp,
      purpose: purpose || `payment-${newSequence}`,
    };

    // Sign the payment
    const signature = await this.signer(paymentData);

    const signedPayment = {
      ...paymentData,
      signature,
      sender: this.address,
    };

    // Send to ClearNode
    this.ws?.send(JSON.stringify(signedPayment));

    // Update local session state
    session.allocations[0].amount = newBuyerBalance.toString();
    session.allocations[1].amount = newSellerBalance.toString();
    session.sequenceNumber = newSequence;

    console.log(`[Yellow] 💸 Payment sent! New balances: buyer=${newBuyerBalance}, seller=${newSellerBalance}`);

    // Return proof for x402
    return {
      sessionId,
      amount: amount.toString(),
      allocation: [newBuyerBalance.toString(), newSellerBalance.toString()],
      sequenceNumber: newSequence,
      timestamp,
      stateSignature: signature,
      purpose: paymentData.purpose,
    };
  }

  /**
   * Close a session (mutual close)
   */
  async closeSession(sessionId: string): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    console.log(`[Yellow] Closing session ${sessionId}...`);

    const closeMessage = {
      method: 'app_session_close',
      params: {
        sessionId,
        finalAllocation: session.allocations.map(a => a.amount),
      },
    };

    this.ws?.send(JSON.stringify(closeMessage));
    session.status = 'closing';

    console.log(`[Yellow] ✅ Session close initiated`);
  }

  /**
   * Get current session state
   */
  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all active sessions
   */
  listSessions(): SessionState[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  /**
   * Register a handler for incoming messages
   */
  onMessage(type: string, handler: MessageHandler): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      console.log(`[Yellow] Raw message: ${data}`);
      const message = parseAnyRPCResponse(data);
      console.log(`[Yellow] Parsed message:`, JSON.stringify(message, null, 2));

      // Cast to any for dynamic property access
      const msg = message as any;

      // Handle pending requests (using method as key)
      // Note: for RPC responses, the method in response matches the request method usually
      // OR we match by requestId if possible. 
      // For now, let's try to match by method name if requestId matching isn't robust yet (since we don't track requestIds).
      if (msg.method && this.pendingRequests.has(msg.method)) {
        const pending = this.pendingRequests.get(msg.method)!;
        this.pendingRequests.delete(msg.method);
        pending.resolve(msg);
      }
      
      // Also check for "error" method which might be a rejection for a pending request
      if (msg.method === 'error') {
         // If we have any pending request, we might want to fail it? 
         // For now just log it. 
      }

      // Update session state based on message method
      switch (msg.method) {
        case 'session_created': // Nitrolite might call this create_app_session or similar?
        case 'create_app_session':
          console.log(`[Yellow] Session confirmed: ${msg.sessionId || (msg.params && msg.params.sessionId)}`);
          break;
          
        case 'session_updated':
        case 'app_session_update':
          // ... implementation ...
          break;
          
        case 'payment': // Custom application message?
          // ... implementation ...
          break;
          
        case 'auth_challenge':
          this.handleAuthChallenge(msg);
          break;

        case 'auth_verify':
          if (msg.params?.success) {
            console.log('[Yellow] ✅ Authentication successful!');
            if (this.connectResolve) {
              this.connectResolve();
              this.connectResolve = null;
            }
          } else {
            console.error('[Yellow] Authentication failed:', msg);
          }
          break;

        case 'get_config':
          console.log('[Yellow] Received Config:', JSON.stringify(msg, null, 2));
          // We could update YELLOW_DOMAIN here if needed
          break;

        case 'error':
          console.error(`[Yellow] ❌ Error: ${msg.params?.error || JSON.stringify(msg)}`);
          break;
      }

      // Call registered handler
      const handler = this.messageHandlers.get(msg.method);
      if (handler) {
        handler(msg);
      }
    } catch (error) {
      console.error('[Yellow] Error parsing message:', error);
    }
  }

  /**
   * Send a message and wait for a specific response type
   */
  private sendAndWait(
    message: string,
    expectedType: string,
    timeout = 30000
  ): Promise<ClearNodeMessage> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(expectedType, { resolve: resolve as (value: unknown) => void, reject });
      
      this.ws?.send(message);

      setTimeout(() => {
        if (this.pendingRequests.has(expectedType)) {
          this.pendingRequests.delete(expectedType);
          reject(new Error(`Timeout waiting for ${expectedType}`));
        }
      }, timeout);
    });
  }
}

/**
 * Create a Yellow client from environment variables
 */
export function createYellowClient(): YellowClient {
  const privateKey = process.env.PRIVATE_KEY as Hex;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  const clearNodeUrl = process.env.YELLOW_CLEARNODE_URL || CLEARNODE_URLS.SANDBOX;
  const networkId = process.env.NETWORK_ID || 'base-sepolia';

  return new YellowClient({
    privateKey,
    clearNodeUrl,
    networkId,
  });
}
