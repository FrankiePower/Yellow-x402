# Yellow x402: Instant Micropayments for Web APIs

A demonstration of the **x402 payment protocol** powered by **Yellow Network** state channels. Pay for API access with instant, gasless off-chain transactions.

## What is x402?

x402 brings the [HTTP 402 Payment Required](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402) status code to life:

```
1. Client requests paid resource      GET /resource
2. Server responds with payment info  402 Payment Required
3. Client pays via Yellow Network     (instant, off-chain)
4. Client retries with proof          GET /resource + X-PAYMENT header
5. Server verifies and responds       200 OK + data
```

## Why Yellow Network?

- **Instant**: Off-chain transactions settle in ~50ms
- **Gasless**: No on-chain fees per payment
- **Scalable**: Thousands of micropayments per second
- **Secure**: Backed by on-chain state channel settlement

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YELLOW x402 ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   AI Agent /     │         │   x402 Payment   │         │  Yellow Network  │
│   Browser Client │         │      Server      │         │    ClearNode     │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                            │                            │
         │  1. GET /resource          │                            │
         │ ─────────────────────────► │                            │
         │                            │                            │
         │  2. 402 Payment Required   │                            │
         │    {scheme: "yellow",      │                            │
         │     payTo: "0x...",        │                            │
         │     amount: "10000"}       │                            │
         │ ◄───────────────────────── │                            │
         │                            │                            │
         │  3. Pay via Yellow Network │                            │
         │ ──────────────────────────────────────────────────────► │
         │                            │                            │
         │                            │   4. "tr" notification     │
         │                            │ ◄────────────────────────── │
         │                            │   (payment confirmed)      │
         │  5. GET /resource          │                            │
         │    + X-PAYMENT header      │                            │
         │ ─────────────────────────► │                            │
         │                            │                            │
         │  6. 200 OK + data          │                            │
         │ ◄───────────────────────── │                            │
         │                            │                            │
         ▼                            ▼                            ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAYMENT TIMING                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  On-Chain x402:  ████████████████████████████████████████  12-15 seconds    │
│  Yellow x402:    ██  ~50ms                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           STATE CHANNEL FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────┐      ┌─────────────────────────────────┐      ┌─────────┐    │
│   │ Open    │      │     Off-Chain Payments          │      │ Close   │    │
│   │ Channel │ ───► │  (unlimited, instant, free)     │ ───► │ Channel │    │
│   │ (1 tx)  │      │  tx1 → tx2 → tx3 → ... → txN    │      │ (1 tx)  │    │
│   └─────────┘      └─────────────────────────────────┘      └─────────┘    │
│       ▲                         ▲                               ▲          │
│       │                         │                               │          │
│   On-Chain               Off-Chain via                     On-Chain        │
│   (gas fee)              ClearNode WebSocket               (gas fee)       │
│                          (no gas)                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
yellow-x402/
├── web/                      # Next.js frontend
│   ├── app/build/           # Demo page with 100-payment test
│   ├── hooks/               # React hooks for Yellow integration
│   └── lib/yellow-client.ts # Browser WebSocket client
│
└── yellow-x402-agent/        # Express backend
    └── src/
        ├── service/         # x402 payment endpoints
        ├── demo-runner.ts   # Automated payment demo
        └── lib/             # Node.js Yellow client
```

## Quick Start

### 1. Backend (Payment Server)

```bash
cd yellow-x402-agent
npm install
cp .env.example .env
# Add your SERVICE_PRIVATE_KEY and BUYER_PRIVATE_KEY
npm run service
```

### 2. Frontend

```bash
cd web
npm install
npm run dev
```

### 3. Run Demo

Visit `http://localhost:3000/build` and click "Run 100-Payment Demo" to see:
- 100 consecutive API payments
- Each completing in ~50ms
- Real-time transaction streaming

## x402 Payment Flow

### Server Side (402 Response)
```json
{
  "accepts": [{
    "scheme": "yellow",
    "network": "eip155:11155111",
    "maxAmountRequired": "10000",
    "payTo": "0x...",
    "asset": "ytest.usd"
  }]
}
```

### Client Side (X-PAYMENT Header)
```json
{
  "x402Version": 1,
  "scheme": "yellow",
  "payload": {
    "transactionId": 12345,
    "fromAccount": "0x...",
    "toAccount": "0x...",
    "amount": "10000"
  }
}
```

## Technology Stack

- **Yellow Network SDK**: `@erc7824/nitrolite`
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Wallet**: MetaMask with EIP-712 signing
- **Network**: Sepolia testnet

## Key Features

1. **Wallet Authentication**: Sign once with MetaMask, use ephemeral session keys for transfers
2. **Instant Payments**: Off-chain transfers via ClearNode WebSocket
3. **x402 Protocol**: Standard HTTP payment negotiation
4. **Real-time Demo**: Stream 100 payments with live UI updates

## Environment Variables

### Backend (.env)
```
SERVICE_PRIVATE_KEY=0x...    # Server wallet for receiving payments
BUYER_PRIVATE_KEY=0x...      # Demo buyer wallet
CLEARNET_URL=wss://clearnet-sandbox.yellow.com/ws
```

### Frontend (.env.local)
```
NEXT_PUBLIC_SERVICE_URL=http://localhost:4000
```

## API Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `/resource` | 10000 | Premium resource access |
| `/data` | 5000 | Analytics data |
| `/quote` | 2000 | Market quote |
| `/run-demo` | Free | Run automated 100-payment demo |

## Demo Video

[Link to demo video]

## License

MIT

---

Built for the HackMoney 2026
