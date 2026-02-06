"use client";

import { useState } from "react";

export default function CodeExample() {
  const [copied, setCopied] = useState(false);

  const exampleCode = `// Complete Yellow Network x402 Payment Flow
// Access protected endpoints with instant, gas-free micropayments

// STEP 1: Initialize Yellow Client
import { YellowClient } from './yellow-client';

const yellowClient = new YellowClient(privateKey, {
  appName: 'my-x402-app',
  clearnetUrl: 'wss://clearnet-sandbox.yellow.com/ws'
});

// Connect and authenticate to ClearNode
await yellowClient.connect();
console.log('Connected! Address:', yellowClient.address);

// STEP 2: Request Protected Resource (Gets 402)
const endpoint = '/resource';
const response = await fetch(\`http://localhost:4000\${endpoint}\`);

// Parse 402 Payment Required response
const requirements = await response.json();
const accept = requirements.accepts[0];

console.log('Payment required:');
console.log(\`  Amount: \${accept.maxAmountRequired} \${accept.asset}\`);
console.log(\`  Pay to: \${accept.payTo}\`);

// STEP 3: Pay via Yellow Network (Off-Chain, Instant!)
const transactions = await yellowClient.transfer({
  destination: accept.payTo,
  asset: accept.asset,
  amount: accept.maxAmountRequired
});

const tx = transactions[0];
console.log('✅ Payment sent!');
console.log(\`  Transaction ID: \${tx.id}\`);
console.log(\`  Amount: \${tx.amount} \${tx.asset}\`);

// STEP 4: Build X-PAYMENT Header
const paymentPayload = {
  scheme: 'yellow',
  payload: {
    transactionId: tx.id,
    fromAccount: tx.from_account,
    toAccount: tx.to_account,
    asset: tx.asset,
    amount: tx.amount
  }
};

const xPaymentHeader = btoa(JSON.stringify(paymentPayload));

// STEP 5: Retry Request with Payment Proof
const paidResponse = await fetch(\`http://localhost:4000\${endpoint}\`, {
  headers: { 'X-PAYMENT': xPaymentHeader }
});

const data = await paidResponse.json();
console.log('✅ Resource received:', data);

// That's it! Zero gas fees, instant settlement
// The service confirmed payment via ClearNode notification`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exampleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white/5 border border-white/10">
      <div className="border-b border-white/10 px-3 sm:px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-xs font-mono text-white/60 uppercase tracking-wider shrink-0">
            API Usage Example
          </span>
          <span className="text-xs font-mono text-white/40 truncate">
            // Yellow Network x402 Flow
          </span>
        </div>
        <button
          onClick={copyToClipboard}
          className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-white/20 hover:bg-white hover:text-black transition-all shrink-0 w-full sm:w-auto"
        >
          {copied ? "✓ Copied" : "Copy Code"}
        </button>
      </div>
      <div className="relative">
        <div className="code-scroll p-4 sm:p-6 md:p-8 bg-black overflow-auto max-h-[500px] sm:max-h-[600px]">
          <pre className="text-xs sm:text-sm font-mono leading-relaxed sm:leading-loose whitespace-pre">
            <span className="text-white/50">
              // Complete Yellow Network x402 Payment Flow
            </span>
            {"\n"}
            <span className="text-white/50">
              // Access protected endpoints with instant, gas-free micropayments
            </span>
            {"\n\n"}
            <span className="text-white/50">
              // STEP 1: Initialize Yellow Client
            </span>
            {"\n"}
            <span className="text-purple-400">import</span>
            <span className="text-white"> {"{ "}YellowClient {" }"} </span>
            <span className="text-purple-400">from</span>
            <span className="text-emerald-400"> './yellow-client'</span>
            <span className="text-white">;</span>
            {"\n\n"}
            <span className="text-purple-400">const</span>
            <span className="text-white"> yellowClient = </span>
            <span className="text-purple-400">new</span>
            <span className="text-white"> YellowClient(privateKey, {"{"}</span>
            {"\n"}
            <span className="text-white">  appName: </span>
            <span className="text-emerald-400">'my-x402-app'</span>
            <span className="text-white">,</span>
            {"\n"}
            <span className="text-white">  clearnetUrl: </span>
            <span className="text-emerald-400">'wss://clearnet-sandbox.yellow.com/ws'</span>
            {"\n"}
            <span className="text-white">{"}"});</span>
            {"\n\n"}
            <span className="text-white/50">
              // Connect and authenticate to ClearNode
            </span>
            {"\n"}
            <span className="text-purple-400">await</span>
            <span className="text-white"> yellowClient.connect();</span>
            {"\n"}
            <span className="text-white">console.log(</span>
            <span className="text-emerald-400">'Connected! Address:'</span>
            <span className="text-white">, yellowClient.address);</span>
            {"\n\n"}
            <span className="text-white/50">
              // STEP 2: Request Protected Resource (Gets 402)
            </span>
            {"\n"}
            <span className="text-purple-400">const</span>
            <span className="text-white"> endpoint = </span>
            <span className="text-emerald-400">'/resource'</span>
            <span className="text-white">;</span>
            {"\n"}
            <span className="text-purple-400">const</span>
            <span className="text-white"> response = </span>
            <span className="text-purple-400">await</span>
            <span className="text-white"> fetch(</span>
            <span className="text-emerald-400">{"`"}http://localhost:4000${"{"}</span>
            <span className="text-white">endpoint</span>
            <span className="text-emerald-400">{"}"}{"`"}</span>
            <span className="text-white">);</span>
            {"\n\n"}
            <span className="text-white/50">// Parse 402 Payment Required response</span>
            {"\n"}
            <span className="text-purple-400">const</span>
            <span className="text-white"> requirements = </span>
            <span className="text-purple-400">await</span>
            <span className="text-white"> response.json();</span>
            {"\n"}
            <span className="text-purple-400">const</span>
            <span className="text-white"> accept = requirements.accepts[</span>
            <span className="text-orange-400">0</span>
            <span className="text-white">];</span>
            {"\n\n"}
            <span className="text-white/50">// STEP 3: Pay via Yellow Network (Off-Chain, Instant!)</span>
            {"\n"}
            <span className="text-purple-400">const</span>
            <span className="text-white"> transactions = </span>
            <span className="text-purple-400">await</span>
            <span className="text-white"> yellowClient.transfer({"{"}</span>
            {"\n"}
            <span className="text-white">  destination: accept.payTo,</span>
            {"\n"}
            <span className="text-white">  asset: accept.asset,</span>
            {"\n"}
            <span className="text-white">  amount: accept.maxAmountRequired</span>
            {"\n"}
            <span className="text-white">{"}"});</span>
            {"\n\n"}
            <span className="text-purple-400">const</span>
            <span className="text-white"> tx = transactions[</span>
            <span className="text-orange-400">0</span>
            <span className="text-white">];</span>
            {"\n"}
            <span className="text-white">console.log(</span>
            <span className="text-emerald-400">'✅ Payment sent!'</span>
            <span className="text-white">);</span>
            {"\n\n"}
            <span className="text-white/50">// STEP 4: Build X-PAYMENT Header</span>
            {"\n"}
            <span className="text-purple-400">const</span>
            <span className="text-white"> paymentPayload = {"{"}</span>
            {"\n"}
            <span className="text-white">  scheme: </span>
            <span className="text-emerald-400">'yellow'</span>
            <span className="text-white">,</span>
            {"\n"}
            <span className="text-white">  payload: {"{"}</span>
            {"\n"}
            <span className="text-white">    transactionId: tx.id,</span>
            {"\n"}
            <span className="text-white">    fromAccount: tx.from_account,</span>
            {"\n"}
            <span className="text-white">    toAccount: tx.to_account,</span>
            {"\n"}
            <span className="text-white">    asset: tx.asset,</span>
            {"\n"}
            <span className="text-white">    amount: tx.amount</span>
            {"\n"}
            <span className="text-white">  {"}"}</span>
            {"\n"}
            <span className="text-white">{"};"}</span>
            {"\n\n"}
            <span className="text-purple-400">const</span>
            <span className="text-white"> xPaymentHeader = btoa(JSON.stringify(paymentPayload));</span>
            {"\n\n"}
            <span className="text-white/50">// STEP 5: Retry Request with Payment Proof</span>
            {"\n"}
            <span className="text-purple-400">const</span>
            <span className="text-white"> paidResponse = </span>
            <span className="text-purple-400">await</span>
            <span className="text-white"> fetch(</span>
            <span className="text-emerald-400">{"`"}http://localhost:4000${"{"}</span>
            <span className="text-white">endpoint</span>
            <span className="text-emerald-400">{"}"}{"`"}</span>
            <span className="text-white">, {"{"}</span>
            {"\n"}
            <span className="text-white">  headers: {"{ "}</span>
            <span className="text-orange-400 font-semibold">'X-PAYMENT'</span>
            <span className="text-white">: xPaymentHeader {" }"}</span>
            {"\n"}
            <span className="text-white">{"}"});</span>
            {"\n\n"}
            <span className="text-purple-400">const</span>
            <span className="text-white"> data = </span>
            <span className="text-purple-400">await</span>
            <span className="text-white"> paidResponse.json();</span>
            {"\n"}
            <span className="text-white">console.log(</span>
            <span className="text-emerald-400">'✅ Resource received:'</span>
            <span className="text-white">, data);</span>
            {"\n\n"}
            <span className="text-white/50">
              // That's it! Zero gas fees, instant settlement
            </span>
          </pre>
        </div>
        {/* Scroll indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-linear-to-t from-black via-black/95 to-transparent pointer-events-none flex items-end justify-center pb-3">
          <div className="bg-white/10 border border-white/20 px-3 py-1 backdrop-blur-sm">
            <span className="text-xs font-mono text-white uppercase tracking-wider">
              Scroll to see more ↓
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
