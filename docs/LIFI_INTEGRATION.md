# LI.FI Integration Reference

## Role in the System

LI.FI handles one thing: **getting USDC onto Base** so the Yellow state channel can be funded.

The agent's USDC might live on Arbitrum, Polygon, Optimism, or anywhere else.
LI.FI finds the cheapest/fastest route and executes the bridge. The agent does not
need to know which bridge, DEX, or intermediate hop is involved.

This also satisfies the LI.FI prize requirement for a **strategy loop**:
```
monitor (check Base USDC balance)
  → decide (is it below the session funding threshold?)
    → act (query LI.FI route → approve → execute → poll until done)
```

---

## Install

```bash
npm install @lifi/sdk
```

---

## Configuration

```typescript
import { createConfig, EVM } from '@lifi/sdk';

createConfig({
  providers: {
    evm: EVM,
  },
});
```

No API key required for basic usage. LI.FI is a public SDK.

---

## Core Flow: Quote → Approve → Execute → Poll

### 1. Get a Route (Quote)

Ask LI.FI: "How do I move X USDC from chain A to Base?"

```typescript
import { getRoutes } from '@lifi/sdk';

const routes = await getRoutes({
  fromChainId: sourceChainId,           // e.g. 42161 (Arbitrum)
  toChainId: 8453,                      // Base
  fromTokenAddress: USDC_ON_SOURCE,     // USDC address on the source chain
  toTokenAddress: USDC_ON_BASE,         // 0x833589fCD6e373e65B35bD758d186c7332460d4
  fromAmount: amount.toString(),        // in base units (6 decimals for USDC)
  fromAddress: agentWalletAddress,
});

// routes.routes[0] is the recommended route
const bestRoute = routes.routes[0];
```

The route object contains:
- Estimated gas cost
- Estimated time
- Steps (which bridges/DEXs are used)
- Transaction data you'll need to execute

### 2. Approve Token Spend

Before LI.FI can move your USDC, the source chain contract needs an ERC-20 approval.

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(SOURCE_CHAIN_RPC);
const signer = new ethers.Wallet(privateKey, provider);

const usdc = new ethers.Contract(USDC_ON_SOURCE, ERC20_ABI, signer);
await usdc.approve(bestRoute.steps[0].action.approvalAddress, amount);
```

### 3. Execute the Route

Send the actual bridge transaction.

```typescript
import { executeRoute } from '@lifi/sdk';

// executeRoute handles multi-step routes automatically.
// It returns a promise that resolves when the route is fully executed
// on the SOURCE side (the bridge pickup). Arrival on Base is async.
await executeRoute(bestRoute, {
  // Provide a signer for each chain involved
  signer: signer,
});
```

### 4. Poll for Completion

The bridge is async. The tokens may take minutes to arrive on Base depending on the bridge.

```typescript
import { getStatus } from '@lifi/sdk';

async function waitForBridge(txHash: string, fromChainId: number): Promise<void> {
  let status = 'STARTED';
  while (status !== 'DONE' && status !== 'FAILED') {
    await new Promise(resolve => setTimeout(resolve, 5000)); // poll every 5s
    const result = await getStatus({
      txHash,
      fromChain: fromChainId,
    });
    status = result.status;
    console.log(`Bridge status: ${status}`);
  }
  if (status === 'FAILED') throw new Error('Bridge transaction failed');
}
```

---

## The Strategy Loop (Agent Side)

This is what the agent actually runs. It's the piece that makes LI.FI integration
"meaningful" vs. a one-off call.

```
┌─────────────────────────────────────────────┐
│  BEFORE opening a Yellow session:           │
│                                             │
│  1. Check USDC balance on Base              │
│  2. If balance < SESSION_FUNDING_AMOUNT:    │
│       a. Determine source chain             │
│          (where does the agent have USDC?)  │
│       b. Query LI.FI for route              │
│       c. Pick best route (cost vs. time)    │
│       d. Approve + execute                  │
│       e. Poll until tokens arrive on Base   │
│  3. Proceed to open Yellow app session      │
└─────────────────────────────────────────────┘
```

Source chain selection can be simple for the demo:
- Hardcode one source chain (e.g., Arbitrum) and pre-fund it, OR
- Check balances on 2-3 chains and pick the one with sufficient USDC.

The second option is more impressive for judging. Keep it simple though — the
strategy loop itself is the signal, not the complexity of the routing logic.

---

## Relevant Constants

| Constant | Value |
|---|---|
| Base chain ID | `8453` |
| USDC on Base | `0x833589fCD6e373e65B35bD758d186c7332460d4` |
| USDC on Arbitrum | `0xaf88d065a77c8525ccd842791a5c8a00989811513` |
| USDC on Polygon | `0x3c499c542cef5e3890944785d693472e041e730d` |

---

## Demo Consideration

LI.FI bridges take time (30s to several minutes depending on the bridge). For a live
hackathon demo:

- **Option A (safe):** Pre-fund the Base wallet with USDC before the demo. Show the
  LI.FI integration as a background service that already ran. Show the transaction
  receipts / status in the UI.
- **Option B (live):** Run the bridge live but have a fallback: if the agent already
  has sufficient balance on Base, skip the bridge and go straight to the Yellow session.
  This way the demo is fast, but LI.FI is still wired in and demonstrably functional.

Option B is the right call — it keeps the demo snappy while proving the integration works.

---

## What LI.FI Does NOT Do Here

- It does not handle the micro-payments. That's Yellow.
- It does not interact with ENS. That's the agent's resolver.
- It fires once (or occasionally) to top up the Base wallet. It is not in the hot path
  of every payment.
