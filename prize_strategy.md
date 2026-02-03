# HackMoney 2026 Prize Strategy: "YellowStream"

## 🎯 Core Concept
**YellowStream**: A high-frequency, agent-to-agent payment rail.
**Tech Stack**: Yellow Network (State Channels) + Arc (Settlement Layer) + ENS (Identity).

## 🏆 Targeted Tracks & Integration Plan

### 1. 🟡 Yellow Network ($15,000)
*   **Track**: "Integrate Yellow SDK" ($5,000 1st Place).
*   **Why**: This is our core. We are building a "Pay-Per-Use App" for AI agents.
*   **Requirement**: Use Nitrolite SDK.
*   **Implementation**: The Node.js sidecar (`adapter.ts`) uses `@erc7824/nitrolite` to open channels and stream payments.

### 2. 🔴 Arc ($10,000)
*   **Track**: "Best Agentic Commerce App Powered by RWA on Arc" ($2,500).
*   **Why**: The prompt asks explicitly for "AI agents that... execute transactions... all settled in USDC."
*   **Integration**:
    *   **Deploy**: We deploy the Yellow `Adjudicator.sol` and `Custody.sol` contracts **on Arc**.
    *   **Flow**: The agents act on Yellow (L3), but the final "Settlement" transaction (moving real USDC) happens on Arc.
    *   **Narrative**: "Arc is the economic engine where our agents settle their debts."

### 3. 🔵 ENS ($5,000)
*   **Track**: "Integrate ENS" & "Most creative use".
*   **Why**: Agent addresses (`0x...`) are hard to manage in a swarm.
*   **Integration**:
    *   **Naming**: Assign names like `data-agent.eth` and `compute-agent.eth`.
    *   **Resolution**: The `Sidecar` resolves these names to addresses before opening the Yellow Channel.
    *   **Text Records**: Store the agent's "Price Per Token" in the ENS text record.
        *   *Flow*: Client queries `data-agent.eth` -> Reads `yellow-price: 0.001 USDC` -> Opens channel.

### 4. 🦄 Uniswap Foundation ($10,000) [Optional / Stretch]
*   **Track**: "Uniswap v4 Agentic Finance".
*   **Integration**:
    *   **Auto-Swap**: If the Agent holds `ETH` on Arc but the stream requires `USDC`, use Uniswap v4 to swap just-in-time before depositing into the Yellow Channel.

---

## 🗺️ Deployment Architecture

```mermaid
flowchart TD
    subgraph L3_Yellow [⚡ Yellow Network (Off-Chain)]
        AgentA[Agent A (Payer)]
        AgentB[Agent B (Payee)]
        Channel[State Channel #123]
        AgentA -- "Stream 0.001 USDC" --> Channel
        Channel -- "Stream 0.001 USDC" --> AgentB
    end

    subgraph L1_Arc [🔴 Arc Blockchain (On-Chain)]
        Registry[ENS Registry]
        USDC[USDC Contract]
        Adjudicator[Yellow Adjudicator]
        
        AgentA -- "1. Resolve 'agent-b.eth'" --> Registry
        AgentA -- "2. Deposit Collateral" --> Adjudicator
        Adjudicator -- "3. Lock" --> USDC
        Adjudicator -- "4. Settle" --> AgentB
    end

    click Registry "Resolve Identity"
    click Adjudicator "Settlement Layer"
```

## ✅ Checklist for "Winning"
1.  **Deploy Yellow Contracts to Arc Testnet**: Show the transaction hash.
2.  **Register ENS Names**: (Or simulate on testnet) for the agents.
3.  **The Demo Video**:
    *   Start with a CLI command: `pay @finance-agent 5 USDC`.
    *   Show it resolving via ENS.
    *   Show the "Streaming" logs (Yellow SDK).
    *   Show the final transaction resolving on the **Arc Explorer**.
