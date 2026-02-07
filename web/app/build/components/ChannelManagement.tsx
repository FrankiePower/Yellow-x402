"use client";

import { useState } from "react";
import { useChannel } from "@/hooks/useChannel";
import { useYellow } from "@/hooks/useYellow";

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io/tx/";
const FAUCET_URL = "https://clearnet-sandbox.yellow.com/faucet/requestTokens";

export default function ChannelManagement() {
  const { isAuthenticated, address } = useYellow();
  const [faucetStatus, setFaucetStatus] = useState<string | null>(null);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const {
    channelId,
    status,
    createTxHash,
    closeTxHash,
    error,
    isLoading,
    createChannel,
    closeChannel,
    reset,
  } = useChannel();

  if (!isAuthenticated) {
    return (
      <div className="bg-white/5 border border-white/10 p-8">
        <div className="text-center space-y-4">
          <p className="text-sm text-white/60 font-mono">
            Connect your wallet to manage state channels
          </p>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    try {
      const result = await createChannel();
      if (result.alreadyExists) {
        console.log("Using existing channel:", result.channelId);
      }
    } catch (err) {
      console.error("Failed to create channel:", err);
    }
  };

  const handleClose = async () => {
    try {
      await closeChannel();
    } catch (err) {
      console.error("Failed to close channel:", err);
    }
  };

  const handleFaucet = async () => {
    if (!address) return;

    setFaucetLoading(true);
    setFaucetStatus(null);

    try {
      const response = await fetch(FAUCET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: address }),
      });

      const data = await response.json();

      if (response.ok) {
        setFaucetStatus("Tokens requested! Wait ~30s for confirmation.");
        console.log("Faucet response:", data);
      } else {
        setFaucetStatus(`Error: ${data.error || data.message || "Unknown error"}`);
      }
    } catch (err: any) {
      setFaucetStatus(`Error: ${err.message}`);
    } finally {
      setFaucetLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-mono text-white/60 uppercase tracking-wider text-center mb-6">
        State Channels (Advanced)
      </h3>

      <div className="bg-green-500/10 border border-green-500/30 p-3 mb-4">
        <p className="text-xs font-mono text-green-400">
          The off-chain payments (right panel) work now! State channels below are for on-chain settlement.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 p-6 space-y-6">
        {/* Status Indicator */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-white/60 uppercase">Channel Status</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              status === "none" ? "bg-white/30" :
              status === "creating" || status === "closing" ? "bg-yellow-400 animate-pulse" :
              status === "open" ? "bg-green-400" :
              status === "closed" ? "bg-blue-400" : "bg-red-400"
            }`} />
            <span className="text-sm font-mono text-white capitalize">{status}</span>
          </div>
        </div>

        {/* Channel ID */}
        {channelId && (
          <div className="bg-black/50 border border-white/10 p-3">
            <div className="text-xs font-mono text-white/60 mb-1">Channel ID</div>
            <div className="text-xs font-mono text-white break-all">{channelId}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* Create Channel */}
          <button
            onClick={handleCreate}
            disabled={isLoading || status === "open" || status === "creating"}
            className={`px-4 py-3 font-mono text-sm uppercase tracking-wider transition-all
              ${status === "none"
                ? "bg-[#FCD535] text-black hover:bg-[#FCD535]/90"
                : "bg-white/10 text-white/40 cursor-not-allowed"}
              disabled:opacity-50`}
          >
            {status === "creating" ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              "① Create Channel"
            )}
          </button>

          {/* Close Channel */}
          <button
            onClick={handleClose}
            disabled={isLoading || status !== "open"}
            className={`px-4 py-3 font-mono text-sm uppercase tracking-wider transition-all
              ${status === "open"
                ? "bg-[#FCD535] text-black hover:bg-[#FCD535]/90"
                : "bg-white/10 text-white/40 cursor-not-allowed"}
              disabled:opacity-50`}
          >
            {status === "closing" ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Settling...
              </span>
            ) : (
              "③ Close & Settle"
            )}
          </button>
        </div>

        {/* Transaction Links */}
        {(createTxHash || closeTxHash) && (
          <div className="space-y-2">
            <div className="text-xs font-mono text-white/60 uppercase">On-Chain Transactions</div>
            <div className="bg-black/50 border border-white/10 p-3 space-y-2">
              {createTxHash && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-white/60">Create Channel:</span>
                  <a
                    href={`${SEPOLIA_EXPLORER}${createTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-[#FCD535] hover:underline"
                  >
                    View on Etherscan →
                  </a>
                </div>
              )}
              {closeTxHash && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-white/60">Close & Settle:</span>
                  <a
                    href={`${SEPOLIA_EXPLORER}${closeTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-[#FCD535] hover:underline"
                  >
                    View on Etherscan →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-3">
            <p className="text-xs font-mono text-red-400">{error}</p>
          </div>
        )}

        {/* Reset Button */}
        {status === "closed" && (
          <button
            onClick={reset}
            className="w-full px-4 py-2 bg-white/10 text-white/60 font-mono text-xs uppercase tracking-wider hover:bg-white/20 transition-all"
          >
            Start New Session
          </button>
        )}

        {/* Faucet Section */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="text-xs font-mono text-white/60 uppercase">Need Test Tokens?</div>
          <button
            onClick={handleFaucet}
            disabled={faucetLoading}
            className="w-full px-4 py-2 bg-white/10 text-white font-mono text-xs uppercase tracking-wider hover:bg-white/20 transition-all disabled:opacity-50"
          >
            {faucetLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Requesting...
              </span>
            ) : (
              "Request ytest.usd from Faucet"
            )}
          </button>
          {faucetStatus && (
            <div className={`text-xs font-mono p-2 ${
              faucetStatus.startsWith("Error")
                ? "text-red-400 bg-red-500/10"
                : "text-green-400 bg-green-500/10"
            }`}>
              {faucetStatus}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="text-xs font-mono text-white/40 space-y-1 pt-2 border-t border-white/10">
          <p className="text-white/60 font-bold mb-2">Off-Chain (Already Working!):</p>
          <p>• Instant transfers via Yellow ledger</p>
          <p>• Zero gas fees per transfer</p>
          <p className="text-white/60 font-bold mt-3 mb-2">On-Chain Channels (Advanced):</p>
          <p>① Create Channel — Lock funds on-chain</p>
          <p>② Make payments — Off-chain, instant</p>
          <p>③ Close & Settle — Final state on-chain</p>
          <p className="mt-2 text-white/30">Requires custody deposit. Use faucet first.</p>
        </div>
      </div>
    </div>
  );
}
