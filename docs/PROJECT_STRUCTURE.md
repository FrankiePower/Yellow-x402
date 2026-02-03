# Project Structure — Old vs. New

## TL;DR

| Action | What |
|---|---|
| DELETE | `contracts/` — no contracts to deploy |
| DELETE | `sequencer/` — ClearNode replaces this entirely |
| REWRITE | `a2a/resource-service/src/lib/sequencer.client.ts` → `yellow.client.ts` + `lifi.client.ts` |
| ADAPT | `a2a/a2a-service/host/service.py` — Yellow session instead of voucher flow |
| ADAPT | `a2a/a2a-service/host/pipeline.py` — ENS discovery step |
| NEW | `a2a/resource-service/src/lib/ens.client.ts` |
| NEW | `a2a/a2a-service/host/lib/bridge_monitor.py` — LI.FI balance check + bridge trigger |
| SIMPLIFY | `demo/docker-compose.yml` — remove sequencer + postgres |

---

## Old Structure (CronosStream)

```
cronos-stream/
├── a2a/
│   ├── a2a-service/                    # Python agent (orchestrator)
│   │   ├── host/
│   │   │   ├── main.py
│   │   │   ├── service.py             # PaywallService — x402 + streaming payment
│   │   │   ├── pipeline.py            # PaywallPipeline — discover → choose → fetch
│   │   │   ├── channel_manager.py     # EIP-712 voucher signing + on-chain channel mgmt
│   │   │   ├── executor.py
│   │   │   └── lib/                   # Shared utilities, error types, enums
│   │   └── channel_state.json         # Persisted channel ID (hacky)
│   │
│   └── resource-service/              # Node/TS sub-agent (resource provider)
│       └── src/
│           ├── index.ts
│           ├── lib/
│           │   └── sequencer.client.ts  # HTTP client for Rust sequencer
│           ├── controllers/
│           ├── routes/
│           └── services/
│
├── contracts/                         # Solidity — StreamChannel.sol + TUSDC
│   ├── contracts/
│   ├── test/
│   └── artifacts/
│
├── sequencer/                         # Rust — axum HTTP server + PG database
│   └── src/
│       ├── main.rs
│       ├── handlers.rs                # HTTP routes
│       ├── service.rs                 # Business logic (seed, settle, finalize)
│       ├── crypto.rs                  # EIP-712 sign + recover
│       ├── db.rs                      # PostgreSQL persistence
│       ├── model.rs                   # Data types
│       ├── config.rs
│       └── error.rs
│
├── demo/
│   ├── docker-compose.yml             # postgres + sequencer + resource-service
│   ├── start.sh
│   ├── stop.sh
│   ├── agent.sh
│   └── cli.py
│
├── scripts/
└── docs/
```

---

## New Structure (Yellow + LI.FI + ENS)

```
cronos-stream/                         # (consider renaming — "cronos" is no longer accurate)
├── a2a/
│   ├── a2a-service/                   # Python agent (orchestrator) — KEPT, adapted
│   │   ├── host/
│   │   │   ├── main.py                # Entry point — unchanged
│   │   │   ├── service.py             # ADAPTED: Yellow session flow replaces voucher flow
│   │   │   ├── pipeline.py            # ADAPTED: ENS discovery step added
│   │   │   ├── executor.py            # Unchanged
│   │   │   └── lib/
│   │   │       ├── bridge_monitor.py  # NEW: monitors Base balance, triggers LI.FI bridge
│   │   │       ├── ens_resolver.py    # NEW: resolves ENS names → agent records
│   │   │       └── ...                # Existing error types, enums — keep
│   │   # channel_manager.py          → DELETED (Yellow SDK handles sessions)
│   │   # channel_state.json          → DELETED (no persisted channel state needed)
│   │
│   └── resource-service/              # Node/TS sub-agent — KEPT, clients swapped
│       └── src/
│           ├── index.ts               # Unchanged
│           ├── lib/
│           │   ├── yellow.client.ts   # NEW: Yellow SDK wrapper (replaces sequencer.client.ts)
│           │   ├── lifi.client.ts     # NEW: LI.FI SDK wrapper (quote, bridge, poll)
│           │   ├── ens.client.ts      # NEW: ENS resolution via viem
│           │   # sequencer.client.ts  → DELETED
│           │   └── middlewares/        # Keep — require.middleware.ts still validates payment
│           ├── controllers/           # Keep — adapt resource.controller for Yellow sessions
│           ├── routes/                # Keep — add /api/session endpoint if needed
│           └── services/              # Keep — adapt for new payment flow
│
├── demo/
│   ├── docker-compose.yml             # SIMPLIFIED: only resource-service (no sequencer, no PG)
│   ├── start.sh                       # SIMPLIFIED
│   ├── stop.sh                        # SIMPLIFIED
│   ├── agent.sh                       # Unchanged
│   └── cli.py                         # Unchanged (or minor updates for new output)
│
│ contracts/                           → DELETED entirely
│ sequencer/                           → DELETED entirely
│
├── scripts/                           # Keep utility scripts, update as needed
└── docs/
    ├── YELLOW_ARCHITECTURE.md         # NEW — this system's architecture
    ├── YELLOW_SDK_INTEGRATION.md      # NEW — Yellow/Nitrolite SDK reference
    ├── LIFI_INTEGRATION.md            # NEW — LI.FI SDK reference
    ├── ENS_INTEGRATION.md            # NEW — ENS integration options
    ├── PROJECT_STRUCTURE.md           # THIS FILE
    └── ...                            # Old docs (ARCHITECTURE.md etc.) can be archived
```

---

## New Files — What Each One Does

### `a2a/resource-service/src/lib/yellow.client.ts`
Thin wrapper around `@erc7824/nitrolite`. Exposes:
- `connectClearNode()` — opens WebSocket
- `openSession(participants, allocation)` — creates an app session
- `sendPayment(sessionId, newAllocation)` — sends a state update
- `closeSession(sessionId, finalAllocation)` — mutual close

### `a2a/resource-service/src/lib/lifi.client.ts`
Wrapper around `@lifi/sdk`. Exposes:
- `getRoute(fromChain, amount)` — quotes a route to Base
- `executeBridge(route, signer)` — approves + sends
- `pollStatus(txHash, fromChain)` — polls until DONE or FAILED

### `a2a/resource-service/src/lib/ens.client.ts`
Wrapper around `viem` ENS functions. Exposes:
- `resolveAgent(name)` — returns `{ address, resourceUrl, pricing, capabilities }`
- `resolveAddress(name)` — forward resolution only

### `a2a/a2a-service/host/lib/bridge_monitor.py`
Runs as part of the agent. Exposes:
- `check_and_fund(target_balance)` — checks Base USDC balance, bridges if needed
- Calls the resource-service's LI.FI client over HTTP (or runs the logic directly)

### `a2a/a2a-service/host/lib/ens_resolver.py`
Agent-side ENS resolution. Calls the resource-service's ENS client over HTTP.
Returns agent discovery records in the same format `discover_agents()` currently produces.

---

## Docker Compose — What Changes

### Old
```yaml
services:
  postgres:          # sequencer database
  sequencer:         # Rust HTTP server
  resource-service:  # Node/TS sub-agent
```

### New
```yaml
services:
  resource-service:  # Node/TS sub-agent (now includes Yellow + LI.FI + ENS clients)
```

That's it. Sequencer and postgres are gone. ClearNode is external.
The Python agent runs outside Docker (same as before, via `agent.sh`).

---

## Package.json Additions (resource-service)

```json
{
  "dependencies": {
    "@erc7824/nitrolite": "latest",
    "@lifi/sdk": "latest",
    "viem": "latest"
  }
}
```

Remove any sequencer-specific dependencies if present.

---

## Environment Variables — New

| Variable | Description | Example |
|---|---|---|
| `CLEARNODE_URL` | ClearNode WebSocket endpoint | `wss://clearnet-sandbox.yellow.com/ws` |
| `BASE_RPC_URL` | Base chain RPC | `https://mainnet.base.org` |
| `BASE_USDC_ADDRESS` | USDC contract on Base | `0x833589fCD6e373e65B35bD758d186c7332460d4` |
| `AGENT_PRIVATE_KEY` | Wallet key for signing (replaces `X402_AGENT_PRIVATE_KEY`) | — |
| `SOURCE_CHAIN_ID` | Chain where agent's funds currently live | `42161` (Arbitrum) |
| `SOURCE_USDC_ADDRESS` | USDC on the source chain | `0xaf88d065...` |
| `L1_RPC_URL` | Ethereum mainnet RPC (for ENS resolution) | `https://mainnet.infura.io/...` |
| `LIFI_FUNDING_THRESHOLD` | Min USDC balance on Base before bridge triggers | `5000000` (5 USDC) |
