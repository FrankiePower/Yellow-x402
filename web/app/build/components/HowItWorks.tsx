"use client";

export default function HowItWorks() {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-mono text-white/60 uppercase tracking-wider text-center mb-6">
        How It Works
      </h3>

      <div className="grid grid-cols-1 gap-3 md:gap-4">
        <div className="bg-white/5 border border-white/10 p-4 md:p-6 hover:bg-white/10 transition-colors flex items-start gap-4 md:gap-6">
          <div className="w-7 h-7 md:w-8 md:h-8 bg-[#FCD535] text-black font-bold flex items-center justify-center text-xs md:text-sm shrink-0">
            1
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
              Connect to Yellow Network
            </h4>
            <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
              Connect your wallet and authenticate with ClearNode sandbox. Get free ytest.usd from the faucet.
            </p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-4 md:p-6 hover:bg-white/10 transition-colors flex items-start gap-4 md:gap-6">
          <div className="w-7 h-7 md:w-8 md:h-8 bg-[#FCD535] text-black font-bold flex items-center justify-center text-xs md:text-sm shrink-0">
            2
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
              Request Protected Resource
            </h4>
            <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
              Make a GET request to any paid endpoint. Server responds with 402 Payment Required.
            </p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-4 md:p-6 hover:bg-white/10 transition-colors flex items-start gap-4 md:gap-6">
          <div className="w-7 h-7 md:w-8 md:h-8 bg-[#FCD535] text-black font-bold flex items-center justify-center text-xs md:text-sm shrink-0">
            3
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
              Instant Off-Chain Payment
            </h4>
            <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
              Yellow client sends payment via ClearNode ledger. Zero gas fees, instant settlement.
            </p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-4 md:p-6 hover:bg-white/10 transition-colors flex items-start gap-4 md:gap-6">
          <div className="w-7 h-7 md:w-8 md:h-8 bg-[#FCD535] text-black font-bold flex items-center justify-center text-xs md:text-sm shrink-0">
            4
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
              Service Confirms Payment
            </h4>
            <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
              Service receives transfer notification from ClearNode and validates transaction ID.
            </p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-4 md:p-6 hover:bg-white/10 transition-colors flex items-start gap-4 md:gap-6">
          <div className="w-7 h-7 md:w-8 md:h-8 bg-[#FCD535] text-black font-bold flex items-center justify-center text-xs md:text-sm shrink-0">
            5
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-2">
              Get Response
            </h4>
            <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
              Retry request with X-PAYMENT header. Receive protected resource data instantly.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-[#FCD535]/10 border border-[#FCD535]/30 p-4">
        <p className="text-xs font-mono text-[#FCD535] leading-relaxed">
          💡 <strong>Why Yellow Network?</strong> Process thousands of micropayments off-chain without gas costs or blockchain latency. Only 2 on-chain transactions needed: channel open + close. Perfect for AI agents and high-frequency commerce.
        </p>
      </div>
    </div>
  );
}
