# YellowStream: Agentic Commerce on Yellow Network

## 🚀 The Vision
Port the **CronosStream** architecture to **Yellow Network** to create the ultimate high-frequency settlement layer for AI Agents.

## 💡 The Core Concept (from CronosStream)
**CronosStream** enabled AI agents to stream payments for data/compute using off-chain vouchers (EIP-712), settling only once on-chain. It solved the "gas cost vs. frequency" problem.

## ⚡ Why Yellow Network (Nitrolite)?
While CronosStream built a *custom* off-chain sequencer in Rust, Yellow Network provides this **out-of-the-box** with standardized, interoperable state channels.

| Feature | CronosStream (Custom) | YellowStream (Nitrolite) |
| :--- | :--- | :--- |
| **Sequencer** | Custom Rust Server (Maintenance Heavy) | **Yellow Network Validators** (Managed) |
| **Contracts** | Custom `StreamChannel.sol` | **Standard ERC-7824** (`Adjudicator`, `Custody`) |
| **Finality** | Optimistic / Reputation based | **Instant Deterministic** |
| **Interop** | Cronos Only | **Cross-Chain / Layer-3** |

## 🛠️ Migration Plan

### 1. Smart Contracts
*   **Remove**: `StreamChannel.sol` (Custom escrow).
*   **Adopt**: Yellow Network's **ERC-7824** standard contracts (`Custody.sol`, `Adjudicator.sol`).
    *   *Benefit*: Audited, standard, no need to maintain our own security critical lock contracts.

### 2. The Sequencer
*   **Remove**: The entire `sequencer/` directory (Rust).
*   **Adopt**: **Yellow ClearNode** / Broker.
    *   *Benefit*: We delete ~2000 lines of complex Rust code. The Yellow Network acts as the trusted broker/sequencer automatically.

### 3. The Agent (Client)
*   **Current State**: Python (`a2a/`) using `web3.py`.
*   **Migration**:
    *   Since Nitrolite SDK is primarily **TypeScript/JS**, we will create a **Node.js Sidecar** (or "Wallet Agent").
    *   The Python AI Agent sends commands ("Pay 0.001 ETH") to the local Node.js Sidecar via HTTP/IPC.
    *   The Node.js Sidecar handles the Nitrolite State Channel interaction (Sign, Send to Broker).

### 4. Architecture Diagram

```mermaid
flowchart LR
    subgraph AI_Agent [Python AI Agent]
        Brain[LLM Logic]
        Cmd[Command: "Stream Payment"]
    end

    subgraph Sidecar [Node.js Nitrolite Bridge]
        SDK[Nitrolite SDK]
        Signer[Wallet Signer]
    end

    subgraph YellowNet [Yellow Network]
        Broker[ClearNode / Broker]
    end

    subgraph Chain [Blockchain (Sepolia/Cronos)]
        Contracts[ERC-7824 Adjudicator]
    end

    Brain --> Cmd
    Cmd -- "JSON-RPC" --> Sidecar
    Sidecar -- "State Update" --> Broker
    Broker -- "Settlement" --> Chain
```

## 🏆 Hackathon Pitch
**"We replaced a custom 2000-line Rust infrastructure with Yellow Network's standardized rails to enable instant, cross-chain agentic commerce."**

This demonstrates exactly what Yellow is for: **Abstracting the complexity of state channels so developers can focus on the application (the AI Agents).**
