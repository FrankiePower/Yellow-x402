/**
 * Yellow Network Action Provider for AgentKit
 * 
 * Provides actions for AI agents to interact with Yellow Network:
 * - Open state channel sessions
 * - Make micropayments
 * - Pay for x402-gated resources
 * - Close sessions
 */

import { ActionProvider, Network, WalletProvider, type Action } from '@coinbase/agentkit';
import { z } from 'zod';
import type { Hex, Address } from 'viem';

import { YellowClient } from '../yellow';
import type { PaymentProof } from '../yellow/types';

// ============================================================================
// Input Schemas
// ============================================================================

const OpenSessionSchema = z.object({
  partnerAddress: z.string().describe('The Ethereum address of the session partner'),
  initialAmount: z.string().describe('Initial USDC amount to fund the session (in atomic units, 1 USDC = 1000000)'),
}).describe('Opens a new Yellow Network state channel session');

const PaySchema = z.object({
  sessionId: z.string().describe('The session ID to make payment in'),
  amount: z.string().describe('Amount to pay (in atomic units)'),
  purpose: z.string().optional().describe('Optional purpose/reference for the payment'),
}).describe('Sends a micropayment within a Yellow session');

const Payx402Schema = z.object({
  url: z.string().describe('The x402-gated resource URL'),
  sessionId: z.string().optional().describe('Optional existing session ID'),
  maxAmount: z.string().optional().describe('Maximum amount willing to pay (in atomic units)'),
}).describe('Pays for an x402-gated resource using Yellow Network');

const CloseSessionSchema = z.object({
  sessionId: z.string().describe('The session ID to close'),
}).describe('Closes a Yellow Network session');

const GetSessionSchema = z.object({
  sessionId: z.string().describe('The session ID to get info for'),
}).describe('Gets information about a Yellow session');

const ListSessionsSchema = z.object({}).describe('Lists all active Yellow sessions');

// ============================================================================
// Action Provider
// ============================================================================

/**
 * Yellow Network Action Provider
 * 
 * Enables AI agents to use Yellow state channels for micropayments.
 */
export class YellowActionProvider implements ActionProvider {
  private client: YellowClient | null = null;
  private walletProvider: WalletProvider | null = null;

  constructor() {
    // Client will be initialized when wallet is available
  }

  /**
   * Get the action provider name
   */
  getName(): string {
    return 'yellow';
  }

  /**
   * Get available actions
   */
  getActions(walletProvider: WalletProvider): Action[] {
    this.walletProvider = walletProvider;
    
    return [
      {
        name: 'yellow_open_session',
        description: 'Open a new Yellow Network state channel session with another participant',
        schema: OpenSessionSchema,
        handler: this.openSession.bind(this),
      },
      {
        name: 'yellow_pay',
        description: 'Send a micropayment within an existing Yellow session',
        schema: PaySchema,
        handler: this.pay.bind(this),
      },
      {
        name: 'yellow_pay_x402',
        description: 'Pay for an x402-gated resource using Yellow Network micropayments',
        schema: Payx402Schema,
        handler: this.payX402.bind(this),
      },
      {
        name: 'yellow_close_session',
        description: 'Close a Yellow Network session and settle on-chain',
        schema: CloseSessionSchema,
        handler: this.closeSession.bind(this),
      },
      {
        name: 'yellow_get_session',
        description: 'Get information about a Yellow session',
        schema: GetSessionSchema,
        handler: this.getSession.bind(this),
      },
      {
        name: 'yellow_list_sessions',
        description: 'List all active Yellow sessions',
        schema: ListSessionsSchema,
        handler: this.listSessions.bind(this),
      },
    ];
  }

  /**
   * Check if action provider supports the network
   */
  supportsNetwork(network: Network): boolean {
    // Yellow Network is on Base but we allow testing on any EVM
    // In production, restrict to base and base-sepolia
    const supportedNetworks = ['base', 'base-sepolia', 'base-mainnet', 'ethereum-sepolia'];
    const networkId = network.networkId || '';
    
    // Also support if it's an EVM chain
    if (network.protocolFamily === 'evm') {
      return true;
    }
    
    return supportedNetworks.includes(networkId);
  }

  /**
   * Initialize the Yellow client lazily
   */
  private async getClient(): Promise<YellowClient> {
    if (!this.client) {
      const privateKey = process.env.PRIVATE_KEY as Hex;
      if (!privateKey) {
        throw new Error('PRIVATE_KEY is required for Yellow Network');
      }

      this.client = new YellowClient({
        privateKey,
        clearNodeUrl: process.env.YELLOW_CLEARNODE_URL,
        networkId: process.env.NETWORK_ID,
      });

      await this.client.connect();
    }

    return this.client;
  }

  /**
   * Open a new session
   */
  private async openSession(args: z.infer<typeof OpenSessionSchema>): Promise<string> {
    const client = await this.getClient();
    
    const sessionId = await client.openSession(
      args.partnerAddress as Address,
      BigInt(args.initialAmount)
    );

    return `✅ Yellow session opened!\n\nSession ID: ${sessionId}\nPartner: ${args.partnerAddress}\nInitial funding: ${args.initialAmount} units\n\nYou can now make micropayments using yellow_pay with this session ID.`;
  }

  /**
   * Make a payment
   */
  private async pay(args: z.infer<typeof PaySchema>): Promise<string> {
    const client = await this.getClient();
    
    const proof = await client.pay(
      args.sessionId,
      BigInt(args.amount),
      args.purpose
    );

    return `💸 Payment sent!\n\nSession: ${args.sessionId}\nAmount: ${args.amount} units\nNew sequence: ${proof.sequenceNumber}\nNew balances: [${proof.allocation[0]}, ${proof.allocation[1]}]`;
  }

  /**
   * Pay for an x402-gated resource
   */
  private async payX402(args: z.infer<typeof Payx402Schema>): Promise<string> {
    const client = await this.getClient();

    // Step 1: Make initial request to get 402 requirements
    const initialResponse = await fetch(args.url);
    
    if (initialResponse.status !== 402) {
      // Resource is not payment-gated
      const body = await initialResponse.text();
      return `Resource is not payment-gated (status: ${initialResponse.status})\n\nResponse:\n${body}`;
    }

    // Step 2: Parse payment requirements from header
    const paymentRequired = initialResponse.headers.get('X-PAYMENT-REQUIRED');
    if (!paymentRequired) {
      throw new Error('Missing X-PAYMENT-REQUIRED header');
    }

    const requirements = JSON.parse(Buffer.from(paymentRequired, 'base64').toString());
    
    if (requirements.scheme !== 'yellow') {
      throw new Error(`Unsupported payment scheme: ${requirements.scheme}. This action only supports 'yellow' scheme.`);
    }

    // Step 3: Check max amount
    const requiredAmount = BigInt(requirements.maxAmountRequired);
    if (args.maxAmount && requiredAmount > BigInt(args.maxAmount)) {
      throw new Error(`Required payment (${requiredAmount}) exceeds max amount (${args.maxAmount})`);
    }

    // Step 4: Make payment through Yellow
    let sessionId = args.sessionId || requirements.extra?.sessionId;
    
    if (!sessionId) {
      // Need to open a new session
      const initialFunding = requiredAmount * BigInt(10); // Fund 10x the required amount
      sessionId = await client.openSession(
        requirements.payTo,
        initialFunding
      );
    }

    const proof = await client.pay(sessionId, requiredAmount, `x402:${args.url}`);

    // Step 5: Retry with payment proof
    const paymentPayload = {
      x402Version: 1,
      scheme: 'yellow',
      network: requirements.network,
      payload: proof,
    };

    const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

    const response = await fetch(args.url, {
      headers: {
        'X-PAYMENT': paymentHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Payment failed: ${response.status} ${response.statusText}`);
    }

    const body = await response.text();

    return `✅ x402 Payment successful!\n\nURL: ${args.url}\nAmount paid: ${requiredAmount} units\nSession: ${sessionId}\n\nResponse:\n${body}`;
  }

  /**
   * Close a session
   */
  private async closeSession(args: z.infer<typeof CloseSessionSchema>): Promise<string> {
    const client = await this.getClient();
    await client.closeSession(args.sessionId);

    return `✅ Session close initiated!\n\nSession ID: ${args.sessionId}\n\nThe session will be settled on-chain. Final balances will be distributed to participants.`;
  }

  /**
   * Get session info
   */
  private async getSession(args: z.infer<typeof GetSessionSchema>): Promise<string> {
    const client = await this.getClient();
    const session = client.getSession(args.sessionId);

    if (!session) {
      return `Session not found: ${args.sessionId}`;
    }

    return `📊 Session Info\n\nSession ID: ${session.sessionId}\nStatus: ${session.status}\nParticipants: ${session.participants.join(', ')}\nSequence: ${session.sequenceNumber}\nAllocations:\n${session.allocations.map(a => `  - ${a.participant}: ${a.amount} ${a.asset}`).join('\n')}`;
  }

  /**
   * List active sessions
   */
  private async listSessions(): Promise<string> {
    const client = await this.getClient();
    const sessions = client.listSessions();

    if (sessions.length === 0) {
      return 'No active Yellow sessions. Use yellow_open_session to create one.';
    }

    const sessionList = sessions.map(s => 
      `- ${s.sessionId} (status: ${s.status}, seq: ${s.sequenceNumber})`
    ).join('\n');

    return `📋 Active Yellow Sessions (${sessions.length}):\n\n${sessionList}`;
  }
}

/**
 * Create Yellow action provider
 */
export function yellowActionProvider(): YellowActionProvider {
  return new YellowActionProvider();
}
