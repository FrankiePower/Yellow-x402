# Yellow SDK / Nitrolite Integration Reference

## What Yellow Replaces

| You used to build | Yellow provides |
|---|---|
| `StreamChannel.sol` | Pre-deployed custody + adjudicator contracts |
| Rust sequencer (validate, co-sign, settle) | ClearNode (external, managed) |
| EIP-712 `ChannelData` voucher signing | SDK-handled state update messages |
| `openChannel` / `finalCloseBySequencer` | App session open / close via SDK |

You write zero Solidity. You deploy zero contracts.

---

## Install

```bash
npm install @erc7824/nitrolite
```

---

## Pre-deployed Contract Addresses

These are Yellow's contracts. Do not redeploy.

| Contract | Address |
|---|---|
| Custody | `0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6` |
| Adjudicator | `0xcbbc03a873c11beeFA8D99477E830be48d8Ae6D7` |
| Balance Checker | `0x2352c63A83f9Fd126af8676146721Fa00924d7e4` |

---

## ClearNode Endpoints

| Environment | WebSocket URL |
|---|---|
| Sandbox (dev/hackathon) | `wss://clearnet-sandbox.yellow.com/ws` |
| Production | `wss://clearnet.yellow.com/ws` |

Use sandbox for all development and demo purposes.

---

## Core SDK Imports

```typescript
import {
  createAppSessionMessage,   // Build a state update message for an app session
  parseRPCResponse,          // Parse incoming ClearNode messages
} from '@erc7824/nitrolite';
```

---

## App Session Lifecycle

### 1. Connect to ClearNode

```typescript
const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');

ws.onmessage = (event) => {
  const response = parseRPCResponse(JSON.parse(event.data));
  // handle response by method type
};

ws.onerror = (err) => {
  console.error('ClearNode connection error:', err);
};
```

### 2. Create an App Session

An app session defines:
- **Participants:** The two (or more) addresses involved.
- **Initial allocation:** How much each participant has at session open.
- **App:** Optional custom logic (for this project, standard payment session is sufficient).

```typescript
// Pseudo-structure — exact shape comes from SDK types.
// Both participants must sign to open the session.
const sessionParams = {
  participants: [aggregatorAddress, subAgentAddress],
  initialAllocation: [fundedAmount, BigInt(0)],  // aggregator funds, sub-agent starts at 0
  token: USDC_BASE_ADDRESS,                      // 0x833589fCD6e373e65B35bD758d186c7332460d4
};

// Send session creation request via ClearNode WebSocket
ws.send(JSON.stringify({
  method: 'app_session_create',
  params: sessionParams,
}));
```

### 3. Send State Updates (Micro-Payments)

Each state update shifts allocation from the aggregator to the sub-agent.
State updates are signed off-chain and routed through ClearNode.

```typescript
const stateUpdate = createAppSessionMessage({
  sessionId,                        // returned from session creation
  allocation: [newAggBalance, newSubBalance],  // new balances after payment
  // sequenceNumber auto-incremented by SDK
});

ws.send(JSON.stringify(stateUpdate));
```

- **Zero gas.** The update never touches the chain until session close.
- **~100ms round-trip** through ClearNode for confirmation.
- Call this for every micro-payment (per inference call, per token, per API hit).

### 4. Close Session — Mutual (Happy Path)

Both parties agree on the final state. ClearNode facilitates the on-chain settlement
via the adjudicator contract.

```typescript
ws.send(JSON.stringify({
  method: 'app_session_close',
  params: { sessionId, finalAllocation: [finalAgg, finalSub] },
}));
```

Settlement is a single transaction on Base. Funds are distributed per the final allocation.

### 5. Close Session — Unilateral (Dispute / Timeout Fallback)

If one party goes offline or refuses to co-sign the close:
- The online party posts the latest mutually-signed state on-chain via the adjudicator.
- A challenge period begins.
- If no valid counter-state is posted, the adjudicator settles using the posted state.

This is handled automatically by the adjudicator contract. The SDK provides helpers
to post state on-chain if needed, but for the hackathon demo (both parties local),
this path should not trigger.

---

## Session Key Delegation (Optional)

Yellow supports delegated session keys — a wallet can authorize a sub-key to act
on its behalf within a session without exposing the main private key.

Useful for: letting the Python agent sign state updates via a derived key rather than
the main wallet. Document this if time allows; not strictly required for the demo.

---

## Error Patterns to Handle

| Error | Likely Cause | Recovery |
|---|---|---|
| WebSocket connection refused | ClearNode sandbox down or network issue | Retry with backoff |
| Session creation rejected | Insufficient custody balance on Base | Top up via LI.FI bridge, retry |
| State update rejected | Sequence number mismatch or invalid signature | Re-fetch session state, rebuild update |
| Session close timeout | Other party not co-signing | Fall back to unilateral close |

---

## Mapping from CronosStream Concepts

| CronosStream | Yellow equivalent |
|---|---|
| `openChannel(amount, expiry, sig)` | App session creation with initial allocation |
| `create_voucher(recipient, amount)` | `createAppSessionMessage` with updated allocation |
| Sequencer `/settle` endpoint | ClearNode WebSocket message routing |
| Sequencer `/channel/finalize` | `app_session_close` (mutual) or on-chain post (unilateral) |
| `sequenceNumber` incremented manually | Managed by SDK / ClearNode |
| EIP-712 `ChannelData` struct | Internal to SDK — you don't construct it |
| `channel_id` (bytes32) | `sessionId` (returned from session creation) |
