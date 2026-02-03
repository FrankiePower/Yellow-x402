# Yellow x402 Scheme Specification

Status: Design Document
Scheme ID: `v1-eip155-yellow`
Scheme name: `yellow`
Namespace: `eip155`

This scheme enables x402 payments via Yellow Network state channels on Base.

## 1) Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                    YELLOW x402 PAYMENT FLOW                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   Buyer Agent                              Seller Agent                │
│   ┌──────────┐                            ┌──────────┐                 │
│   │ AgentKit │                            │ AgentKit │                 │
│   │ + Yellow │                            │ + x402   │                 │
│   │   Client │                            │ Middleware│                │
│   └────┬─────┘                            └────┬─────┘                 │
│        │                                       │                       │
│        │ 1. GET /api/resource                  │                       │
│        │──────────────────────────────────────►│                       │
│        │                                       │                       │
│        │ 2. 402 + Yellow scheme requirements   │                       │
│        │◄──────────────────────────────────────│                       │
│        │                                       │                       │
│        │ 3. Create/use Yellow session          │                       │
│        │────────────┐                          │                       │
│        │            ▼                          │                       │
│        │   ┌────────────────┐                  │                       │
│        │   │   ClearNode    │                  │                       │
│        │   │   (Yellow)     │                  │                       │
│        │   └───────┬────────┘                  │                       │
│        │           │ Session confirmation      │                       │
│        │◄──────────┘                           │                       │
│        │                                       │                       │
│        │ 4. GET + X-PAYMENT (Yellow state sig) │                       │
│        │──────────────────────────────────────►│                       │
│        │                                       │                       │
│        │                    5. Facilitator ────┼─────────────┐         │
│        │                       verifies via    │             ▼         │
│        │                       ClearNode       │    ┌────────────────┐ │
│        │                                       │    │ Yellow         │ │
│        │                                       │    │ Facilitator    │ │
│        │                                       │    └────────┬───────┘ │
│        │                                       │             │         │
│        │                    6. Settle state ───┼─────────────┘         │
│        │                       update          │                       │
│        │                                       │                       │
│        │ 7. 200 + Resource                     │                       │
│        │◄──────────────────────────────────────│                       │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## 2) x402 v1 Envelope Types for Yellow

### 2.1 PaymentRequirements (402 Response)

```json
{
  "scheme": "yellow",
  "network": "eip155:8453",
  "maxAmountRequired": "1000000",
  "resource": "/api/inference",
  "description": "AI inference via Yellow state channel",
  "mimeType": "application/json",
  "payTo": "0x<sellerAddress>",
  "maxTimeoutSeconds": 900,
  "asset": "0x833589fCD6eDB6E08f4c7C32D4f71b54bdA02913",
  "extra": {
    "clearNodeUrl": "wss://clearnet-sandbox.yellow.com/ws",
    "custodyContract": "0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6",
    "adjudicatorContract": "0xcbbc03a873c11beeFA8D99477E830be48d8Ae6D7",
    "sessionId": "0x<bytes32 or null if new session needed>",
    "nextSequenceNumber": 1,
    "sessionExpiry": 1710000000,
    "sellerParticipant": "0x<sellerAddress>"
  }
}
```

### 2.2 PaymentPayload (X-PAYMENT Header)

```json
{
  "x402Version": 1,
  "scheme": "yellow",
  "network": "eip155:8453",
  "payload": {
    "sessionId": "0x<bytes32>",
    "amount": "1000000",
    "allocation": ["<buyerNewBalance>", "<sellerNewBalance>"],
    "sequenceNumber": 7,
    "timestamp": 1710000000,
    "stateSignature": "0x<signature>",
    "purpose": "inference:request-123"
  }
}
```

## 3) Yellow-Specific Fields

### 3.1 extra (in PaymentRequirements)

| Field | Type | Description |
|-------|------|-------------|
| `clearNodeUrl` | string | ClearNode WebSocket endpoint |
| `custodyContract` | address | Yellow custody contract on Base |
| `adjudicatorContract` | address | Yellow adjudicator contract |
| `sessionId` | bytes32 or null | Existing session ID, or null if buyer needs to create new session |
| `nextSequenceNumber` | uint256 | Expected sequence for the next state update |
| `sessionExpiry` | uint256 | Session expiry timestamp |
| `sellerParticipant` | address | Seller's address (participant in session) |

### 3.2 payload (in PaymentPayload)

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | bytes32 | The Yellow app session ID |
| `amount` | uint256 string | Amount being paid (in USDC atomic units) |
| `allocation` | [string, string] | New allocation [buyer, seller] after this payment |
| `sequenceNumber` | uint256 | Sequence number for this state update |
| `timestamp` | uint256 | UNIX timestamp of this update |
| `stateSignature` | bytes | Buyer's signature over the state update |
| `purpose` | string | Optional metadata (e.g., request ID) |

## 4) Validation Rules (Facilitator)

The Yellow Facilitator must:

1. **Verify session exists** via ClearNode
2. **Validate sequence number** equals current + 1
3. **Verify signature** over the state update
4. **Check allocation** is valid (total doesn't exceed session balance)
5. **Verify timestamp** is within acceptable skew and before session expiry
6. **On settle:** Apply state update via ClearNode and return confirmation

## 5) Components to Build

### 5.1 Yellow Facilitator Server

A small Node.js/TypeScript service that:
- Receives `/verify` and `/settle` calls from the x402 middleware
- Connects to ClearNode WebSocket
- Validates session states and signatures
- Applies state updates on settle

```typescript
// Facilitator API endpoints
POST /verify   → validates payment payload against Yellow session
POST /settle   → applies state update to Yellow session
GET /health    → health check
```

### 5.2 Yellow Client SDK (for Buyer Agent)

Wraps the Nitrolite SDK for agent use:

```typescript
class YellowClient {
  async openSession(seller: Address, amount: bigint): Promise<SessionId>;
  async pay(sessionId: SessionId, amount: bigint): Promise<PaymentProof>;
  async closeSession(sessionId: SessionId): Promise<void>;
  async getSession(sessionId: SessionId): Promise<SessionState>;
}
```

### 5.3 Yellow x402 Middleware (for Seller Agent)

Extends the standard x402 middleware pattern:

```typescript
const routes = {
  "GET /api/resource": {
    accepts: [{
      scheme: "yellow",
      price: "$0.001",
      network: "eip155:8453",
      payTo: sellerAddress,
      extra: {
        clearNodeUrl: CLEARNODE_URL,
        // ... Yellow-specific fields
      }
    }]
  }
};
```

### 5.4 AgentKit Action Providers

For the agent to control payments:

```typescript
// Buyer actions
yellowPayAction()        // Pay for an x402-gated resource
yellowOpenSessionAction() // Open a new Yellow session

// Seller actions  
yellowReceiveAction()    // Called when payment received
```

## 6) Comparison: CPC vs Yellow

| Aspect | CPC (x402-hackathon) | Yellow |
|--------|---------------------|--------|
| Contracts | Custom CheddrChannelManager | Pre-deployed Nitrolite |
| Sequencer | Self-hosted | ClearNode (managed) |
| Session creation | `openChannel` on-chain | Session via ClearNode |
| State updates | EIP-712 signed ChannelData | SDK-handled messages |
| Settlement | Manual finalize call | ClearNode + Adjudicator |

## 7) Implementation Order

1. **Yellow Client SDK** (~2 hours)
   - Wrap Nitrolite SDK
   - Session open/close flows
   - Payment helper

2. **Yellow Facilitator** (~3 hours)
   - Express server with /verify, /settle
   - ClearNode WebSocket connection
   - State validation logic

3. **x402 Middleware Integration** (~1 hour)
   - Custom Yellow scheme registration
   - Route configuration

4. **AgentKit Actions** (~2 hours)
   - yelloPay action provider
   - Integration with agent flow

5. **Demo** (~1 hour)
   - Two agents, one pays the other
   - E2E flow with Yellow settlement

## 8) Files to Create

```
yellow-agent/
├── lib/
│   ├── yellow/
│   │   ├── client.ts           # Yellow client SDK
│   │   ├── types.ts            # TypeScript types
│   │   └── facilitator/
│   │       ├── server.ts       # Facilitator Express app
│   │       ├── verify.ts       # /verify handler
│   │       └── settle.ts       # /settle handler
│   └── x402/
│       ├── middleware.ts       # x402 middleware with Yellow scheme
│       └── scheme.ts           # Yellow scheme definition
└── app/
    └── api/
        └── facilitator/
            └── route.ts        # Next.js API route for facilitator
```

## 9) Environment Variables Needed

```env
# Yellow Network
YELLOW_CLEARNODE_URL=wss://clearnet-sandbox.yellow.com/ws
YELLOW_CUSTODY_CONTRACT=0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6
YELLOW_ADJUDICATOR_CONTRACT=0xcbbc03a873c11beeFA8D99477E830be48d8Ae6D7

# Asset
USDC_BASE_ADDRESS=0x833589fCD6eDB6E08f4c7C32D4f71b54bdA02913

# Agent wallet (already have)
PRIVATE_KEY=0x...
```
