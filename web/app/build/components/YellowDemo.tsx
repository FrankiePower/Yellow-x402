"use client";

import { useState } from "react";
import { useYellowPayment } from "@/hooks/useYellowPayment";
import { useYellow } from "@/hooks/useYellow";

const ENDPOINTS = [
  { path: "/resource", name: "Premium Resource", price: "1.00 ytest.usd" },
  { path: "/data", name: "Analytics Data", price: "0.50 ytest.usd" },
  { path: "/quote", name: "Market Quote", price: "0.20 ytest.usd" },
];

export default function YellowDemo() {
  const { isAuthenticated, yellowClient } = useYellow();
  const { loading, error, response, status, callEndpoint, reset } = useYellowPayment();
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);

  const handleCallEndpoint = async () => {
    try {
      await callEndpoint(selectedEndpoint.path);
    } catch (err) {
      // Error is already handled in the hook
      console.error("Payment failed:", err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-white/5 border border-white/10 p-8">
        <div className="text-center space-y-4">
          <p className="text-sm text-white/60 font-mono">
            Connect your wallet to try the Yellow Network x402 demo
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-mono text-white/60 uppercase tracking-wider text-center mb-6">
        Live Demo - Pay-Per-Call API
      </h3>

      <div className="bg-white/5 border border-white/10 p-6 space-y-6">
        {/* Endpoint Selection */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-white/60 uppercase tracking-wider">
            Select Endpoint
          </label>
          <div className="grid grid-cols-1 gap-2">
            {ENDPOINTS.map((endpoint) => (
              <button
                key={endpoint.path}
                onClick={() => setSelectedEndpoint(endpoint)}
                disabled={loading}
                className={`px-4 py-3 text-left border transition-all ${
                  selectedEndpoint.path === endpoint.path
                    ? "border-[#FCD535] bg-[#FCD535]/10"
                    : "border-white/20 hover:border-white/40"
                } disabled:opacity-50`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-mono text-white">{endpoint.name}</span>
                  <span className="text-xs font-mono text-white/60">{endpoint.price}</span>
                </div>
                <div className="text-xs font-mono text-white/40 mt-1">{endpoint.path}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Call Button */}
        <button
          onClick={handleCallEndpoint}
          disabled={loading}
          className="w-full px-6 py-3 bg-[#FCD535] text-black font-bold text-sm uppercase tracking-wider hover:bg-[#FCD535]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              <span>Processing Payment...</span>
            </>
          ) : (
            <span>Call Endpoint & Pay</span>
          )}
        </button>

        {/* Status */}
        {status !== "// Waiting..." && (
          <div className="bg-black border border-white/10 p-4">
            <div className="text-xs font-mono text-white/60">{status}</div>
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono text-white/60 uppercase tracking-wider">
                Response
              </label>
              <button
                onClick={reset}
                className="text-xs font-mono text-white/60 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="bg-black border border-white/10 p-4 overflow-auto max-h-96">
              <pre className="text-xs font-mono text-white whitespace-pre-wrap">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4">
            <p className="text-xs font-mono text-red-400">{error}</p>
          </div>
        )}

        {/* Info */}
        <div className="text-xs font-mono text-white/40 space-y-1">
          <p>💡 Each call requires an instant off-chain payment via Yellow Network</p>
          <p>⚡ Payments settle in milliseconds with zero gas fees</p>
          {yellowClient && (
            <p>🔑 Your Yellow address: {yellowClient.address}</p>
          )}
        </div>
      </div>
    </div>
  );
}
