/**
 * Yellow Network Client Types
 * 
 * TypeScript types for the Yellow/Nitrolite SDK integration.
 */

import type { Hex, Address } from 'viem';

// ============================================================================
// Session Types
// ============================================================================

export interface AppDefinition {
  application: string;
  protocol: string; // We'll cast to enum in implementation
  participants: Address[];
  weights: number[];
  quorum: number;
  challenge: number;
  nonce: number;
}

export interface Allocation {
  participant: Address;
  asset: string;
  amount: string;
}

export interface SessionConfig {
  definition: AppDefinition;
  allocations: Allocation[];
}

export interface SessionState {
  sessionId: string;
  participants: Address[];
  allocations: Allocation[];
  sequenceNumber: number;
  status: 'pending' | 'active' | 'closing' | 'closed';
}

// ============================================================================
// Payment Types
// ============================================================================

export interface PaymentData {
  type: 'payment';
  amount: string;
  recipient: Address;
  timestamp: number;
  purpose?: string;
}

export interface SignedPayment extends PaymentData {
  signature: Hex;
  sender: Address;
}

export interface PaymentProof {
  sessionId: string;
  amount: string;
  allocation: [string, string];
  sequenceNumber: number;
  timestamp: number;
  stateSignature: Hex;
  purpose?: string;
}

// ============================================================================
// Message Types
// ============================================================================

export type ClearNodeMessageType = 
  | 'session_created'
  | 'session_updated'
  | 'session_closed'
  | 'payment'
  | 'session_message'
  | 'error';

export interface ClearNodeMessage {
  type: ClearNodeMessageType;
  sessionId?: string;
  amount?: string;
  sender?: Address;
  data?: unknown;
  error?: string;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface YellowClientConfig {
  /** ClearNode WebSocket URL */
  clearNodeUrl: string;
  /** Private key for signing (hex with 0x prefix) */
  privateKey: Hex;
  /** Network ID (e.g., 'base-sepolia') */
  networkId?: string;
}

// ============================================================================
// x402 Integration Types
// ============================================================================

export interface YellowPaymentRequirementsExtra {
  clearNodeUrl: string;
  custodyContract: Address;
  adjudicatorContract: Address;
  sessionId: string | null;
  nextSequenceNumber: number;
  sessionExpiry: number;
  sellerParticipant: Address;
}

export interface YellowPaymentPayload {
  sessionId: string;
  amount: string;
  allocation: [string, string];
  sequenceNumber: number;
  timestamp: number;
  stateSignature: Hex;
  purpose?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const YELLOW_CONTRACTS = {
  CUSTODY: '0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6' as Address,
  ADJUDICATOR: '0xcbbc03a873c11beeFA8D99477E830be48d8Ae6D7' as Address,
  BALANCE_CHECKER: '0x2352c63A83f9Fd126af8676146721Fa00924d7e4' as Address,
} as const;

export const CLEARNODE_URLS = {
  SANDBOX: 'wss://clearnet-sandbox.yellow.com/ws',
  PRODUCTION: 'wss://clearnet.yellow.com/ws',
} as const;

// USDC on Base (mainnet)
export const USDC_BASE = '0x833589fCD6eDB6E08f4c7C32D4f71b54bdA02913' as Address;
// USDC on Base Sepolia (testnet) - need to verify
export const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address;
