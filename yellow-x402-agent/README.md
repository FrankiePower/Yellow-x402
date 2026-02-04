# yellow-x402-agent

x402 HTTP Payment Required flow settled over Yellow (ClearNode ledger) instead of on-chain.

---

## What this is

A buyer agent and a paid resource service that speak the x402 protocol. Payment is settled via Yellow's ClearNode ledger — no sequencer, no facilitator, no on-chain transactions. ClearNode replaces both.

---

## Architecture

```
Buyer                          Service                        ClearNode (sandbox)
  │                               │                                  │
  │── GET /resource ──────────►   │                                  │
  │◄── 402 { accepts: [...] } ──  │                                  │
  │                               │                                  │
  │── createTransferMessage ─────────────────────────────────────►    │
  │◄── { transactions: [tx] } ───────────────────────────────────    │
  │                               │◄── "tr" notification (push) ──   │
  │                               │    (caches tx)                   │
  │                               │                                  │
  │── GET /resource               │                                  │
  │   X-PAYMENT: base64(receipt)  │                                  │
  │──────────────────────────►    │                                  │
  │                               │  decode → find tx in cache       │
  │                               │  verify asset + amount + dest    │
  │◄── 200 { resource } ──────────│                                  │
```

- **Buyer** and **Service** both authenticate to ClearNode independently via EIP-712 challenge/response.
- **Transfer** is a ClearNode ledger operation — instant, no gas, returns a receipt with a transaction `id`.
- **Service** confirms payment by receiving a `"tr"` push notification from ClearNode containing the same `id`. It does NOT verify signatures — ClearNode is the source of truth.

---

## File structure

```
yellow-x402-agent/
├── .env                        ← wallet keys + config (never commit)
├── .env.example                ← template
├── package.json
├── tsconfig.json
└── src/
    ├── lib/
    │   └── yellow-client.ts    ← shared ClearNode WebSocket client
    ├── service/
    │   └── index.ts            ← Express: 402 gate + payment verification
    └── buyer/
        └── index.ts            ← agent: 402 → pay → retry with X-PAYMENT
```

---

## Setup

### 1. Dependencies

```sh
cd yellow-x402-agent
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and fill in two funded sandbox wallet keys:

```env
CLEARNET_URL=wss://clearnet-sandbox.yellow.com/ws

BUYER_PRIVATE_KEY=0x...          # funded with ytest.usd on sandbox
SERVICE_PRIVATE_KEY=0x...        # funded with ytest.usd on sandbox (different key)

SERVICE_PORT=4000
PRICE=1000000                    # ytest.usd base units
SERVICE_URL=http://localhost:4000
```

Both accounts are auto-funded by the ClearNode sandbox faucet on first auth.
Use different keys for buyer and service — you cannot transfer to yourself.

### 3. Run

Two terminals:

```sh
# Terminal 1 — start the paid service
npm run service
# wait for: [service] HTTP on http://localhost:4000

# Terminal 2 — run the buyer agent
npm run buyer
```

---

## The flow (step by step)

1. **Service starts**, connects to ClearNode, authenticates, begins listening for `"tr"` transfer notifications.
2. **Buyer starts**, connects to ClearNode, authenticates.
3. Buyer sends `GET /resource` with no payment header.
4. Service returns **402** with a JSON body describing what it accepts:
   ```json
   {
     "accepts": [{
       "scheme": "yellow",
       "network": "eip155:11155111",
       "maxAmountRequired": "1000000",
       "payTo": "0x<service-wallet>",
       "asset": "ytest.usd"
     }]
   }
   ```
5. Buyer calls `yellow.transfer()` — sends `createTransferMessage` over its WebSocket to ClearNode. ClearNode moves funds on the ledger instantly and returns a receipt:
   ```json
   { "id": 15926, "from_account": "0x...", "to_account": "0x...", "asset": "ytest.usd", "amount": "1000000" }
   ```
6. Buyer builds the `X-PAYMENT` header — base64-encoded JSON:
   ```json
   {
     "x402Version": 1,
     "scheme": "yellow",
     "network": "eip155:11155111",
     "payload": { "transactionId": 15926, "fromAccount": "0x...", "toAccount": "0x...", "asset": "ytest.usd", "amount": "1000000" }
   }
   ```
7. Buyer retries `GET /resource` with `X-PAYMENT`.
8. Service decodes the header, extracts `transactionId`, looks it up in its notification cache (polls up to 3 s if it hasn't arrived yet), verifies asset + amount + destination, returns the resource with **200**.

---

## Key implementation details

### ClearNode uses snake_case

The transaction objects returned by ClearNode use snake_case, not camelCase:

| Actual field      | NOT this        |
|-------------------|-----------------|
| `from_account`    | `fromAccount`   |
| `to_account`      | `toAccount`     |
| `tx_type`         | `txType`        |
| `created_at`      | `createdAt`     |
| `from_account_tag`| `fromAccountTag`|
| `to_account_tag`  | `toAccountTag`  |

### Transfer notification method is `"tr"`

ClearNode push notifications use abbreviated method names (from the nitrolite SDK `RPCMethod` enum):

| Method string | Meaning                  |
|---------------|--------------------------|
| `"tr"`        | TransferNotification     |
| `"transfer"`  | Transfer response        |
| `"bu"`        | BalanceUpdate            |
| `"cu"`        | ChannelUpdate            |
| `"channels"`  | ChannelsUpdate           |

The service listens on `"tr"`, NOT `"transfer_notification"`.

### Auth flow

Both client and service use the same EIP-712 handshake:

1. Send `createAuthRequestMessage` with address, session key, allowances, expiry.
2. ClearNode pushes back `auth_challenge` with a challenge string.
3. Sign it with `createEIP712AuthMessageSigner` (uses the wallet's private key locally — no RPC needed).
4. Send `createAuthVerifyMessageFromChallenge`.
5. ClearNode responds with `auth_verify` → authenticated.

Session key is an ephemeral keypair generated per connection. It signs all subsequent RPC messages (transfers, etc.) — the main wallet key is only used for the EIP-712 auth signature.

### Service payment confirmation

The service does NOT verify cryptographic signatures on the transfer. It trusts ClearNode as the source of truth: if a `"tr"` notification arrived with the matching `transactionId`, the payment happened. It does sanity-check asset, amount, and destination against its own config.

If the notification hasn't arrived by the time the retry request comes in, it polls the cache for up to 3 seconds (30 × 100 ms) before rejecting.

---

## What replaced what (vs x402-hackathon CPC scheme)

| CPC component              | Yellow equivalent                        |
|----------------------------|------------------------------------------|
| Sequencer (Rust + Postgres)| ClearNode                                |
| Facilitator (Rust)         | ClearNode                                |
| On-chain state channel     | ClearNode ledger transfer                |
| EIP-712 ChannelData sign   | EIP-712 auth handshake (one-time)        |
| Facilitator signature check| `"tr"` notification presence check       |
| `v1-eip155-cpc` scheme     | `yellow` scheme                          |
