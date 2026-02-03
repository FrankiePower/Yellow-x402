# ENS Integration Reference

## Role in the System

ENS gives agents **human-readable identities** and replaces hardcoded discovery URLs
with on-chain-resolvable names.

Instead of:
```
discoveryUrls: ["http://localhost:8787"]
```

The agent does:
```
agents: ["sub-agent-1.agents.eth"]  →  resolve  →  { address, url, pricing, capabilities }
```

This is the piece we "figure out how to get creative with later." This doc captures
all the integration points and options so that decision is informed.

---

## ENS on Base — How It Works

- **Resolution always starts on Ethereum L1.** Even though we settle on Base, ENS
  name lookups hit mainnet first.
- **L2 data via CCIP-Read.** Text records and sub-name data can be stored on Base
  (or off-chain) and fetched via EIP-3668 (CCIP Read). Libraries like viem and wagmi
  handle this transparently.
- **Primary names on Base are supported.** Addresses on Base can have reverse records
  (address → name), and names like `username.base.eth` are a real pattern (Coinbase does this).

---

## Install

```bash
# viem is the recommended resolution library (handles CCIP-Read natively)
npm install viem

# Optional: ENS.js for more advanced ENS operations
npm install @ensdomains/ensjs
```

---

## Resolution Patterns

### Forward: Name → Address

"What Base address does `sub-agent-1.agents.eth` point to?"

```typescript
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';  // Resolution starts on L1

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const address = await client.ens.resolve('sub-agent-1.agents.eth');
// Returns: 0x... (the Base address of the sub-agent)
```

### Reverse: Address → Name

"What ENS name does this address belong to?"

```typescript
const name = await client.ens.getName({ address: '0x...' });
// Returns: 'sub-agent-1.agents.eth' (or null if no primary name set)
```

### Text Records: Name → Metadata

"What does this agent advertise about itself?"

```typescript
const url = await client.ens.getText({
  name: 'sub-agent-1.agents.eth',
  key: 'com.cronos-stream.resource_url',
});

const pricing = await client.ens.getText({
  name: 'sub-agent-1.agents.eth',
  key: 'com.cronos-stream.pricing_usdc',
});

const capabilities = await client.ens.getText({
  name: 'sub-agent-1.agents.eth',
  key: 'com.cronos-stream.capabilities',
});
```

---

## Proposed Text Record Schema

ENS text records are arbitrary key-value pairs. We define our own namespace
to store agent metadata. Prefix: `com.cronos-stream.*`

| Key | Example Value | Description |
|---|---|---|
| `com.cronos-stream.resource_url` | `https://sub-agent.example.com/resource` | Base URL of the paywalled resource |
| `com.cronos-stream.pricing_usdc` | `1000` | Cost per request in USDC base units (6 decimals) |
| `com.cronos-stream.capabilities` | `inference,summarization` | Comma-separated capability tags |
| `com.cronos-stream.agent_version` | `1.0.0` | Agent software version |
| `com.cronos-stream.status` | `active` | Current agent status |

This is a draft. The "creative" ENS integration decision will likely shape this schema.

---

## Integration Points in the Agent Flow

### Option A: ENS replaces the discovery URL list (solid, minimal)

The agent's discovery payload changes from:
```python
discovery_urls: ["http://localhost:8787"]
```
to:
```python
agent_names: ["sub-agent-1.agents.eth"]
```

The pipeline resolves each name → fetches text records → constructs the same agent
record that `discover_agents()` currently builds from HTTP discovery.

**Effort:** Low. One new resolver module. Swaps the input to the pipeline.

### Option B: ENS-based agent registry (more impressive)

A parent ENS name (e.g., `agents.eth` or a project-specific name) has subnames,
each representing a registered agent. The aggregator enumerates subnames to discover
all available agents dynamically.

**Effort:** Medium. Requires either off-chain indexing or a known list of subnames.
ENS does not natively support "list all subnames" — you'd need a side channel
(e.g., a simple API or event index) to enumerate them.

### Option C: ENS as payment identity (creative angle)

Instead of paying to a raw `0x...` address, the payment target is an ENS name.
The state channel participant list uses ENS names that resolve to addresses.
This makes the demo more human-readable and ties ENS deeply into the payment flow.

**Effort:** Low additional effort on top of Option A. The ENS name is resolved
to an address before the Yellow session is opened — but it's displayed as the
name throughout the UI/logs.

---

## Demo / Hackathon Considerations

- **ENS names cost gas to set up on mainnet.** For the demo, you can:
  - Use existing ENS names (if team members have them)
  - Use a test ENS name on a testnet (Sepolia has ENS)
  - Mock the ENS resolution in the demo and show the real resolution path in the code
- **L1 RPC calls add latency.** ENS resolution hits mainnet even if everything else is on Base.
  Cache resolved names aggressively. For a hackathon demo with a known set of agents,
  pre-resolve at startup.
- **The ENS prize pool is $3,500 split** among all qualifying projects. The bar is:
  "write some code specifically for ENS, even if it's just a couple hooks." Option A clears
  this easily. Option C is the "creative use of ENS for DeFi" $1,500 prize territory.

---

## Key Packages Reference

| Package | Purpose |
|---|---|
| `viem` | ENS resolution (forward, reverse, text records). Handles CCIP-Read. |
| `@ensdomains/ensjs` | Advanced ENS ops (set records, manage names). Needed if you write records. |
| `wagmi` | React hooks for ENS (if a frontend is added later). Not needed for the agent. |
