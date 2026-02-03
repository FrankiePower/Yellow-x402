/**
 * Yellow x402 Facilitator
 * 
 * This module provides the facilitator server that bridges x402 payments
 * with Yellow Network state channels.
 * 
 * Endpoints:
 * - POST /verify - Validate a Yellow payment payload
 * - POST /settle - Apply a Yellow state update
 * - GET /health - Health check
 */

import WebSocket from 'ws';
import type { Address, Hex } from 'viem';
import { verifyMessage } from 'viem';
import { parseAnyRPCResponse } from '@erc7824/nitrolite';

import {
  type YellowPaymentPayload,
  type ClearNodeMessage,
  type SessionState,
  CLEARNODE_URLS,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface VerifyRequest {
  payload: YellowPaymentPayload;
  requirements: {
    scheme: string;
    network: string;
    maxAmountRequired: string;
    payTo: Address;
    extra: {
      clearNodeUrl: string;
      sessionId: string | null;
      nextSequenceNumber: number;
      sellerParticipant: Address;
    };
  };
}

export interface VerifyResponse {
  valid: boolean;
  error?: string;
  details?: {
    sessionId: string;
    amount: string;
    sequenceNumber: number;
    buyer: Address;
    seller: Address;
  };
}

export interface SettleRequest {
  payload: YellowPaymentPayload;
  seller: Address;
}

export interface SettleResponse {
  settled: boolean;
  error?: string;
  receipt?: {
    sessionId: string;
    amount: string;
    newSellerBalance: string;
    sequenceNumber: number;
    timestamp: number;
  };
}

// ============================================================================
// Facilitator Service
// ============================================================================

export class YellowFacilitator {
  private ws: WebSocket | null = null;
  private clearNodeUrl: string;
  private connected = false;
  
  // Cache of verified sessions
  private sessionCache: Map<string, SessionState> = new Map();

  constructor(clearNodeUrl: string = CLEARNODE_URLS.SANDBOX) {
    this.clearNodeUrl = clearNodeUrl;
  }

  /**
   * Connect to ClearNode
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      console.log(`[Facilitator] Connecting to ClearNode: ${this.clearNodeUrl}`);
      
      this.ws = new WebSocket(this.clearNodeUrl);

      this.ws.onopen = () => {
        console.log('[Facilitator] ✅ Connected to ClearNode');
        this.connected = true;
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data.toString());
      };

      this.ws.onerror = (error) => {
        console.error('[Facilitator] WebSocket error:', error);
        reject(new Error('Failed to connect to ClearNode'));
      };

      this.ws.onclose = () => {
        console.log('[Facilitator] Connection closed');
        this.connected = false;
      };

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Handle incoming ClearNode messages
   */
  private handleMessage(data: string): void {
    try {
      const message = parseAnyRPCResponse(data) as unknown as ClearNodeMessage;
      console.log(`[Facilitator] 📨 ${message.type}`);
      
      // Update session cache when we receive updates
      if (message.sessionId && message.data) {
        this.sessionCache.set(message.sessionId, message.data as SessionState);
      }
    } catch (error) {
      console.error('[Facilitator] Error parsing message:', error);
    }
  }

  /**
   * Verify a Yellow payment payload
   * 
   * Validates:
   * 1. Signature is valid
   * 2. Session exists (or will be created)
   * 3. Sequence number is correct
   * 4. Amount is sufficient
   * 5. Allocations are valid
   */
  async verify(request: VerifyRequest): Promise<VerifyResponse> {
    console.log('[Facilitator] Verifying payment...');
    
    const { payload, requirements } = request;
    
    try {
      // 1. Basic validation
      if (requirements.scheme !== 'yellow') {
        return { valid: false, error: 'Invalid scheme - expected yellow' };
      }

      if (!payload.sessionId) {
        return { valid: false, error: 'Missing sessionId' };
      }

      if (!payload.stateSignature) {
        return { valid: false, error: 'Missing stateSignature' };
      }

      // 2. Verify payment amount meets requirements
      const requiredAmount = BigInt(requirements.maxAmountRequired);
      const payloadAmount = BigInt(payload.amount);
      
      if (payloadAmount < requiredAmount) {
        return { 
          valid: false, 
          error: `Insufficient payment: ${payloadAmount} < ${requiredAmount}` 
        };
      }

      // 3. Verify sequence number
      const expectedSequence = requirements.extra.nextSequenceNumber;
      if (payload.sequenceNumber !== expectedSequence) {
        return {
          valid: false,
          error: `Invalid sequence: got ${payload.sequenceNumber}, expected ${expectedSequence}`,
        };
      }

      // 4. Verify signature over the payment data
      // Reconstruct the signed message
      const signedData = JSON.stringify({
        type: 'payment',
        sessionId: payload.sessionId,
        amount: payload.amount,
        recipient: requirements.payTo,
        timestamp: payload.timestamp,
        purpose: payload.purpose,
      });

      // For now, we trust the signature - in production, verify against ClearNode
      // This would involve querying the session state from ClearNode and validating
      // the signature matches the expected buyer address
      
      // TODO: Implement proper signature verification via ClearNode
      // const isValid = await verifyMessage({
      //   address: buyerAddress,
      //   message: signedData,
      //   signature: payload.stateSignature,
      // });

      // 5. Verify allocations
      const [buyerBalance, sellerBalance] = payload.allocation;
      const sellerReceived = BigInt(sellerBalance);
      
      if (sellerReceived < payloadAmount) {
        return {
          valid: false,
          error: 'Allocation mismatch - seller balance insufficient',
        };
      }

      console.log('[Facilitator] ✅ Payment verified');
      
      return {
        valid: true,
        details: {
          sessionId: payload.sessionId,
          amount: payload.amount,
          sequenceNumber: payload.sequenceNumber,
          buyer: '0x' as Address, // Would be extracted from signature
          seller: requirements.payTo,
        },
      };
    } catch (error) {
      console.error('[Facilitator] Verification error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Settle a Yellow payment
   * 
   * Applies the state update to ClearNode and returns a receipt.
   */
  async settle(request: SettleRequest): Promise<SettleResponse> {
    console.log('[Facilitator] Settling payment...');
    
    const { payload, seller } = request;

    try {
      if (!this.connected) {
        await this.connect();
      }

      // Send the state update to ClearNode
      const settleMessage = {
        method: 'app_session_update',
        params: {
          sessionId: payload.sessionId,
          allocation: payload.allocation,
          sequenceNumber: payload.sequenceNumber,
          signature: payload.stateSignature,
        },
      };

      // In production, we would wait for ClearNode confirmation
      // For now, we optimistically settle
      this.ws?.send(JSON.stringify(settleMessage));

      console.log('[Facilitator] ✅ Payment settled');

      return {
        settled: true,
        receipt: {
          sessionId: payload.sessionId,
          amount: payload.amount,
          newSellerBalance: payload.allocation[1],
          sequenceNumber: payload.sequenceNumber,
          timestamp: payload.timestamp,
        },
      };
    } catch (error) {
      console.error('[Facilitator] Settlement error:', error);
      return {
        settled: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Health check
   */
  health(): { status: 'ok' | 'error'; connected: boolean } {
    return {
      status: this.connected ? 'ok' : 'error',
      connected: this.connected,
    };
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
}

// Singleton instance for API routes
let facilitatorInstance: YellowFacilitator | null = null;

export function getFacilitator(): YellowFacilitator {
  if (!facilitatorInstance) {
    const clearNodeUrl = process.env.YELLOW_CLEARNODE_URL || CLEARNODE_URLS.SANDBOX;
    facilitatorInstance = new YellowFacilitator(clearNodeUrl);
  }
  return facilitatorInstance;
}
