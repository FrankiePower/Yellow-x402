"use client";

import { useState } from "react";
import { Omnix402Service } from "@/services/omnix402.service";
import DemoStatus from "./DemoStatus";

export default function DemoSection() {
  const [callId, setCallId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartDemo = async () => {
    setIsLoading(true);
    setError(null);
    setCallId(null);

    try {
      const response = await Omnix402Service.requestDemo();
      setCallId(response.callId);
    } catch (err: any) {
      setError(err.message || "Failed to start demo");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-mono text-white/60 uppercase tracking-wider text-center mb-6">
        Try It Out
      </h3>

      {!callId ? (
        <div className="bg-white/5 border border-white/10 p-8">
          <div className="text-center space-y-4">
            <p className="text-sm text-white/60 font-mono leading-relaxed max-w-md mx-auto">
              Launch a live demo transaction to see Omnix402 in action. Watch as
              payments flow cross-chain via LayerZero.
            </p>

            <button
              onClick={handleStartDemo}
              disabled={isLoading}
              className="px-8 py-3 bg-white text-black font-bold text-sm uppercase tracking-wider hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-3"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  <span>Starting Demo...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Launch Demo</span>
                </>
              )}
            </button>

            {error && (
              <p className="text-xs text-red-400 font-mono mt-2">{error}</p>
            )}
          </div>
        </div>
      ) : (
        <DemoStatus callId={callId} />
      )}
    </div>
  );
}
