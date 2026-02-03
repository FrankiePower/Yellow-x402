# System Architecture — Yellow + LI.FI + ENS

## Overview

This document defines the target architecture for porting CronosStream onto Yellow Network.
The system replaces the custom `StreamChannel.sol` contract and Rust sequencer with Yellow's
pre-deployed ERC-7824 state channels, adds cross-chain fund routing via LI.FI, and uses ENS
for human-readable agent discovery.

**Settlement chain:** Base (chain ID 8453)
**State channel infra:** Yellow ClearNode (`wss://clearnet-sandbox.yellow.com/ws`)
**Cross-chain routing:** LI.FI SDK
**Agent identity / discovery:** ENS (resolution always starts on L1, CCIP-Read for L2 data)

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER                                              │
│                                                                 │
│   ┌──────────────┐        ┌──────────────────┐                  │
│   │ Aggregator   │        │  Sub-Agent       │                  │
│   │ Agent        │◄──────►│  (Resource Svc)  │                  │
│   │ (Python)     │        │  (Node/TS)       │                  │
│   └──────┬───────┘        └────────┬─────────┘                  │
│          │                         │                             │
│          │  ENS: discover agents   │                             │
│          │  by name, not URL       │                             │
└──────────┼─────────────────────────┼─────────────────────────────┘
           │                         │
┌──────────┼─────────────────────────┼─────────────────────────────┐
│  PAYMENT LAYER                     │                             │
│          │                         │                             │
│   ┌──────▼───────┐        ┌────────▼─────────┐                  │
│   │  LI.FI SDK   │        │   Yellow SDK     │                  │
│   │              │        │  (Nitrolite)     │                  │
│   │  Route funds │        │                  │                  │
│   │  to Base     │        │  Off-chain       │                  │
│   │  from any    │        │  app sessions    │                  │
│   │  EVM chain   │        │  on Base         │                  │
│   └──────┬───────┘        └────────┬─────────┘                  │
│          │                         │  WebSocket                  │
│          │                         │  to ClearNode               │
└──────────┼─────────────────────────┼─────────────────────────────┘
           │                         │
┌──────────▼─────────────────────────▼─────────────────────────────┐
│  ON-CHAIN LAYER (Base)                                           │
│                                                                  │
│   ┌───────────────┐   ┌──────────────┐   ┌─────────────────┐    │
│   │  USDC         │   │  Yellow      │   │  ENS            │    │
│   │  (native)     │   │  Custody     │   │  Universal      │    │
│   │               │   │  Contract    │   │  Resolver       │    │
│   │  0x833589...  │   │  0x490fb1... │   │  (via L1 +      │    │
│   └───────────────┘   └──────────────┘   │   CCIP-Read)    │    │
│                                          └─────────────────┘    │
│   Pre-deployed contracts — nothing to deploy.                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow — Happy Path

```
1.  Agent wants to pay Sub-Agent for inference.

2.  ENS RESOLUTION
    Agent resolves Sub-Agent's ENS name (e.g. "sub-agent-1.agents.eth")
    → gets: Base address, resource URL, pricing metadata (from text records)

3.  BALANCE CHECK
    Agent checks its USDC balance on Base.

4.  CROSS-CHAIN FUNDING (if needed)
    If balance is below threshold:
      a) Agent queries LI.FI for cheapest route: <source chain> → Base, USDC
      b) LI.FI returns route with estimated cost + time
      c) Agent approves + executes the bridge transaction
      d) Agent polls LI.FI status until DONE

5.  SESSION OPEN
    Agent opens a Yellow app session on Base with the Sub-Agent.
    Both parties are participants. Initial allocation = funded USDC amount.
    (Handled by Yellow SDK — no contract deployment.)

6.  OFF-CHAIN MICRO-PAYMENTS
    Agent sends signed state updates via ClearNode WebSocket.
    Each update increments the Sub-Agent's allocation.
    Zero gas. Near-instant (~100ms round-trip through ClearNode).

7.  SUB-AGENT DELIVERS
    Sub-Agent receives state update confirmation, serves the inference result.

8.  SESSION CLOSE (mutual)
    Both parties sign final state. ClearNode facilitates on-chain settlement
    via the adjudicator contract on Base. Funds distributed.

9.  SESSION CLOSE (unilateral fallback)
    If one party goes offline: the other posts the latest state on-chain.
    Challenge period runs. Adjudicator settles automatically.
```

---

## Component Responsibilities

| Component | Responsibility | Tech |
|---|---|---|
| Agent Pipeline | Orchestrates discover → pay → receive flow | Python |
| ENS Resolver | Resolves agent names to addresses + metadata | viem / @ensdomains/ensjs |
| LI.FI Client | Cross-chain fund routing (quote → bridge → poll) | @lifi/sdk (TS) |
| Yellow Client | App session lifecycle (open → state updates → close) | @erc7824/nitrolite (TS) |
| Resource Service | Hosts Sub-Agent, serves paywalled resources | Node/TS (Express) |
| ClearNode | Off-chain message broker, state co-signing | Yellow infra (external) |
| Base chain | On-chain settlement, USDC custody | EVM (external) |

---

## What Changes vs. CronosStream

| CronosStream (old) | Yellow port (new) | Action |
|---|---|---|
| `contracts/StreamChannel.sol` | Yellow custody + adjudicator (pre-deployed) | DELETE |
| `sequencer/` (Rust, axum, PG) | ClearNode (Yellow infra) | DELETE |
| `channel_manager.py` (EIP-712 signing) | Yellow SDK session management | REWRITE |
| `sequencer.client.ts` | Yellow SDK client wrapper | REWRITE |
| `service.py` streaming handler | Yellow session + LI.FI bridge trigger | ADAPT |
| `pipeline.py` | Add ENS discovery step | ADAPT |
| `demo/docker-compose.yml` | Remove sequencer + postgres services | SIMPLIFY |
| Agent discovery (hardcoded URLs) | ENS name resolution | NEW |
| — | LI.FI cross-chain bridge client | NEW |

---

## Key Constraints

- **ClearNode is external infra.** Demo depends on `clearnet-sandbox.yellow.com` being up.
- **ENS resolution starts on L1.** Even though we settle on Base, ENS queries go to mainnet.
  Use CCIP-Read for L2 text record data.
- **LI.FI bridge is async.** Fund routing takes minutes (bridge dependent). The agent must
  handle this without blocking the demo flow. Pre-fund Base wallet before demo if possible.
- **Yellow app sessions require both parties online** for mutual close. For the demo,
  both agent and resource service will be running locally.
- **Token requirement.** USDC must be available on Base in both LI.FI and Yellow's ClearNode.
  Base USDC: `0x833589fCD6e373e65B35bD758d186c7332460d4`
