"use client";

import { useState } from "react";

export default function CodeExample() {
  const [copied, setCopied] = useState(false);

  const exampleCode = `// Complete X402 Cross-Chain Payment Flow
// Access protected endpoints on Base using USDO from Polygon

// STEP 1: Request Payment Requirements
const endpoint = encodeURIComponent('https://api.example.com/protected');
const response = await fetch(
  \`https://www.apifortest.shop/api/endpoint?endpoint=\${endpoint}&network=polygon\`
);
const requirements = await response.json();
// Response (402): { accepts: [{ network, payTo, maxAmountRequired, data }] }

// STEP 2: Build EIP-3009 Authorization
const accept = requirements.accepts[0];
const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(32));
const validAfter = Math.floor(Date.now() / 1000) - 60;
const validBefore = validAfter + 3600;

// Get USDO contract constants for EIP-712
const usdoContract = new ethers.Contract(accept.payTo, USDO_ABI, provider);
const TYPEHASH = await usdoContract.TRANSFER_WITH_AUTHORIZATION_EXTENDED_TYPEHASH();
const DOMAIN_SEPARATOR = await usdoContract.DOMAIN_SEPARATOR();

// Build EIP-712 struct hash
const structHash = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(
    ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32', 'bytes'],
    [TYPEHASH, wallet.address, accept.payTo, accept.maxAmountRequired, 
     validAfter, validBefore, nonce, accept.data || '0x']
  )
);

// Sign EIP-712 digest
const digest = ethers.utils.keccak256(
  ethers.utils.solidityPack(['string', 'bytes32', 'bytes32'], 
    ['\\x19\\x01', DOMAIN_SEPARATOR, structHash])
);
const signingKey = new ethers.utils.SigningKey(wallet.privateKey);
const signature = ethers.utils.joinSignature(signingKey.signDigest(digest));

// STEP 3: Build X402 Payload
const x402Payload = {
  x402Version: 1, scheme: 'exact', network: 'polygon',
  payload: {
    signature,
    authorization: {
      from: wallet.address, to: accept.payTo, value: accept.maxAmountRequired,
      validAfter, validBefore, nonce, data: accept.data
    }
  }
};

// STEP 4: Execute Payment (bridge happens automatically)
const result = await fetch(
  \`https://www.apifortest.shop/api/endpoint?endpoint=\${endpoint}\`,
  { method: 'POST', headers: { 'X-Payment': btoa(JSON.stringify(x402Payload)) } }
);

// STEP 5: Receive Protected Content
const content = await result.json();
const paymentProof = result.headers.get('X-Payment-Response');
console.log('Access granted!', content);`;

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
            // Cross-chain X402 with EIP-3009
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
              // Complete X402 Cross-Chain Payment Flow
            </span>
            {"\n"}
            <span className="text-white/50">
              // Access protected endpoints on Base using USDO from Polygon
            </span>
            {"\n\n"}
            <span className="text-white/50">
              // STEP 1: Request Payment Requirements
            </span>
            {"\n"}
            <span className="text-white">
              const endpoint = encodeURIComponent(
            </span>
            <span className="text-emerald-400">
              'https://api.example.com/protected'
            </span>
            <span className="text-white">);</span>
            {"\n"}
            <span className="text-white">const response = await fetch(</span>
            {"\n"}
            <span className="text-white"> </span>
            <span className="text-emerald-400">
              {
                "`https://www.apifortest.shop/api/endpoint?endpoint=${endpoint}&network=polygon`"
              }
            </span>
            {"\n"}
            <span className="text-white">);</span>
            {"\n"}
            <span className="text-white">
              const requirements = await response.json();
            </span>
            {"\n"}
            <span className="text-white/50">
              {
                "// Response (402): { accepts: [{ network, payTo, maxAmountRequired, data }] }"
              }
            </span>
            {"\n\n"}
            <span className="text-white/50">
              // STEP 2: Build EIP-3009 Authorization
            </span>
            {"\n"}
            <span className="text-white">
              const accept = requirements.accepts[0];
            </span>
            {"\n"}
            <span className="text-white">
              const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(
            </span>
            <span className="text-purple-400">32</span>
            <span className="text-white">));</span>
            {"\n"}
            <span className="text-white">
              const validAfter = Math.floor(Date.now() /{" "}
            </span>
            <span className="text-purple-400">1000</span>
            <span className="text-white">) - </span>
            <span className="text-purple-400">60</span>
            <span className="text-white">;</span>
            {"\n"}
            <span className="text-white">
              const validBefore = validAfter +{" "}
            </span>
            <span className="text-purple-400">3600</span>
            <span className="text-white">;</span>
            {"\n\n"}
            <span className="text-white/50">
              // Get USDO contract constants for EIP-712
            </span>
            {"\n"}
            <span className="text-white">
              const usdoContract = new ethers.Contract(accept.payTo, USDO_ABI,
              provider);
            </span>
            {"\n"}
            <span className="text-white">
              const TYPEHASH = await
              usdoContract.TRANSFER_WITH_AUTHORIZATION_EXTENDED_TYPEHASH();
            </span>
            {"\n"}
            <span className="text-white">
              const DOMAIN_SEPARATOR = await usdoContract.DOMAIN_SEPARATOR();
            </span>
            {"\n\n"}
            <span className="text-white/50">// Build EIP-712 struct hash</span>
            {"\n"}
            <span className="text-white">
              const structHash = ethers.utils.keccak256(
            </span>
            {"\n"}
            <span className="text-white">
              {" "}
              ethers.utils.defaultAbiCoder.encode(
            </span>
            {"\n"}
            <span className="text-white"> [</span>
            <span className="text-emerald-400">'bytes32'</span>
            <span className="text-white">, </span>
            <span className="text-emerald-400">'address'</span>
            <span className="text-white">, </span>
            <span className="text-emerald-400">'address'</span>
            <span className="text-white">, </span>
            <span className="text-emerald-400">'uint256'</span>
            <span className="text-white">, </span>
            <span className="text-emerald-400">'uint256'</span>
            <span className="text-white">, </span>
            <span className="text-emerald-400">'uint256'</span>
            <span className="text-white">, </span>
            <span className="text-emerald-400">'bytes32'</span>
            <span className="text-white">, </span>
            <span className="text-emerald-400">'bytes'</span>
            <span className="text-white">],</span>
            {"\n"}
            <span className="text-white">
              {" "}
              [TYPEHASH, wallet.address, accept.payTo, accept.maxAmountRequired,
            </span>
            {"\n"}
            <span className="text-white">
              {" "}
              validAfter, validBefore, nonce, accept.data ||{" "}
            </span>
            <span className="text-emerald-400">'0x'</span>
            <span className="text-white">]</span>
            {"\n"}
            <span className="text-white"> )</span>
            {"\n"}
            <span className="text-white">);</span>
            {"\n\n"}
            <span className="text-white/50">// Sign EIP-712 digest</span>
            {"\n"}
            <span className="text-white">
              const digest = ethers.utils.keccak256(
            </span>
            {"\n"}
            <span className="text-white"> ethers.utils.solidityPack([</span>
            <span className="text-emerald-400">'string'</span>
            <span className="text-white">, </span>
            <span className="text-emerald-400">'bytes32'</span>
            <span className="text-white">, </span>
            <span className="text-emerald-400">'bytes32'</span>
            <span className="text-white">],</span>
            {"\n"}
            <span className="text-white"> [</span>
            <span className="text-emerald-400">'\\x19\\x01'</span>
            <span className="text-white">, DOMAIN_SEPARATOR, structHash])</span>
            {"\n"}
            <span className="text-white">);</span>
            {"\n"}
            <span className="text-white">
              const signingKey = new ethers.utils.SigningKey(wallet.privateKey);
            </span>
            {"\n"}
            <span className="text-white">
              const signature =
              ethers.utils.joinSignature(signingKey.signDigest(digest));
            </span>
            {"\n\n"}
            <span className="text-white/50">// STEP 3: Build X402 Payload</span>
            {"\n"}
            <span className="text-white">const x402Payload = {"{"}</span>
            {"\n"}
            <span className="text-white"> x402Version: </span>
            <span className="text-purple-400">1</span>
            <span className="text-white">, scheme: </span>
            <span className="text-emerald-400">'exact'</span>
            <span className="text-white">, network: </span>
            <span className="text-emerald-400">'polygon'</span>
            <span className="text-white">,</span>
            {"\n"}
            <span className="text-white"> payload: {"{"}</span>
            {"\n"}
            <span className="text-white"> signature,</span>
            {"\n"}
            <span className="text-white"> authorization: {"{"}</span>
            {"\n"}
            <span className="text-white">
              {" "}
              from: wallet.address, to: accept.payTo, value:
              accept.maxAmountRequired,
            </span>
            {"\n"}
            <span className="text-white">
              {" "}
              validAfter, validBefore, nonce, data: accept.data
            </span>
            {"\n"}
            <span className="text-white"> {"}"}</span>
            {"\n"}
            <span className="text-white"> {"}"}</span>
            {"\n"}
            <span className="text-white">{"};"}</span>
            {"\n\n"}
            <span className="text-white/50">
              // STEP 4: Execute Payment (bridge happens automatically)
            </span>
            {"\n"}
            <span className="text-white">const result = await fetch(</span>
            {"\n"}
            <span className="text-white"> </span>
            <span className="text-emerald-400">
              {
                "`https://www.apifortest.shop/api/endpoint?endpoint=${endpoint}`"
              }
            </span>
            <span className="text-white">,</span>
            {"\n"}
            <span className="text-white"> {"{ "}method: </span>
            <span className="text-emerald-400">'POST'</span>
            <span className="text-white">, headers: {"{ "}</span>
            <span className="text-orange-400 font-semibold">'X-Payment'</span>
            <span className="text-white">
              : btoa(JSON.stringify(x402Payload)) {"} }"}
            </span>
            {"\n"}
            <span className="text-white">);</span>
            {"\n\n"}
            <span className="text-white/50">
              // STEP 5: Receive Protected Content
            </span>
            {"\n"}
            <span className="text-white">
              const content = await result.json();
            </span>
            {"\n"}
            <span className="text-white">
              const paymentProof = result.headers.get(
            </span>
            <span className="text-orange-400 font-semibold">
              'X-Payment-Response'
            </span>
            <span className="text-white">);</span>
            {"\n"}
            <span className="text-white">console.log(</span>
            <span className="text-emerald-400">'Access granted!'</span>
            <span className="text-white">, content);</span>
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
