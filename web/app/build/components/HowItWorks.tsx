"use client";

import { useState } from "react";

export default function HowItWorks() {
  const [showUSDOPopup, setShowUSDOPopup] = useState(false);

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-xs font-mono text-white/60 uppercase tracking-wider text-center mb-6">
          How It Works
        </h3>

        <div className="grid grid-cols-1 gap-3 md:gap-4">
          <button
            onClick={() => setShowUSDOPopup(true)}
            className="bg-white/5 border border-white/10 p-4 md:p-6 hover:bg-white/10 transition-colors flex items-start gap-4 md:gap-6 text-left w-full"
          >
            <div className="w-7 h-7 md:w-8 md:h-8 bg-white text-black font-bold flex items-center justify-center text-xs md:text-sm shrink-0">
              1
            </div>
            <div>
              <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
                Get USDO
              </h4>
              <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
                Wrap USDC into USDO on Polygon. Unwrap anytime back to USDC.
              </p>
            </div>
          </button>

          <div className="bg-white/5 border border-white/10 p-4 md:p-6 hover:bg-white/10 transition-colors flex items-start gap-4 md:gap-6">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-white text-black font-bold flex items-center justify-center text-xs md:text-sm shrink-0">
              2
            </div>
            <div>
              <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
                Choose Endpoint
              </h4>
              <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
                Pick any X402 endpoint on Base or Polygon.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 md:p-6 hover:bg-white/10 transition-colors flex items-start gap-4 md:gap-6">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-white text-black font-bold flex items-center justify-center text-xs md:text-sm shrink-0">
              3
            </div>
            <div>
              <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
                Sign Payment
              </h4>
              <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
                One signature using EIP-3009 standard.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 md:p-6 hover:bg-white/10 transition-colors flex items-start gap-4 md:gap-6">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-white text-black font-bold flex items-center justify-center text-xs md:text-sm shrink-0">
              4
            </div>
            <div>
              <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
                We Route Cross-Chain
              </h4>
              <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
                Protocol routes payment via LayerZero automatically.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 md:p-6 hover:bg-white/10 transition-colors flex items-start gap-4 md:gap-6">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-white text-black font-bold flex items-center justify-center text-xs md:text-sm shrink-0">
              5
            </div>
            <div>
              <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
                Get Response
              </h4>
              <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
                Receive endpoint response with settled payment.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showUSDOPopup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-white/20 max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowUSDOPopup(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h3 className="text-lg font-bold uppercase tracking-wider mb-4">
              Get USDO Tokens
            </h3>

            <div className="space-y-4">
              <p className="text-sm text-white/60 font-mono leading-relaxed">
                USDO is a wrapped version of USDC on Polygon. Wrap to get USDO,
                unwrap anytime to get your USDC back.
              </p>

              <div className="bg-white/5 border border-white/10 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-white text-black font-bold flex items-center justify-center text-xs shrink-0">
                    1
                  </div>
                  <p className="text-sm text-white/80">
                    Connect your wallet to{" "}
                    <span className="text-purple-400 font-semibold">
                      Polygon
                    </span>{" "}
                    network
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-white text-black font-bold flex items-center justify-center text-xs shrink-0">
                    2
                  </div>
                  <p className="text-sm text-white/80">
                    Click{" "}
                    <span className="text-orange-400 font-semibold">
                      Get USDO
                    </span>{" "}
                    button in the header to wrap USDC into USDO
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-white text-black font-bold flex items-center justify-center text-xs shrink-0">
                    3
                  </div>
                  <p className="text-sm text-white/80">
                    Start making cross-chain payments with USDO
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowUSDOPopup(false)}
                className="w-full px-6 py-3 bg-white text-black font-bold text-sm uppercase tracking-wider hover:bg-white/90 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
