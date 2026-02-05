"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { base, polygon } from "@reown/appkit/networks";

export function NetworkButton() {
  const { open } = useAppKit();
  const { chain, isConnected } = useAccount();

  // Don't show button if not connected
  if (!isConnected) return null;

  const getNetworkInfo = () => {
    if (!chain)
      return { name: "Select Network", logo: null, isSupported: false };

    switch (chain.id) {
      case base.id:
        return {
          name: "Base",
          isSupported: true,
          logo: (
            <svg
              width="16"
              height="16"
              viewBox="0 0 111 111"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z"
                fill="white"
              />
            </svg>
          ),
        };
      case polygon.id:
        return {
          name: "Polygon",
          isSupported: true,
          logo: (
            <svg
              width="16"
              height="16"
              viewBox="0 0 38.4 33.5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M29,10.2c-0.7-0.4-1.6-0.4-2.4,0L21,13.5l-3.8,2.1l-5.5,3.3c-0.7,0.4-1.6,0.4-2.4,0L5,16.3 c-0.7-0.4-1.2-1.2-1.2-2.1v-5c0-0.8,0.4-1.6,1.2-2.1l4.3-2.5c0.7-0.4,1.6-0.4,2.4,0L16,7.2c0.7,0.4,1.2,1.2,1.2,2.1v3.3l3.8-2.2V7 c0-0.8-0.4-1.6-1.2-2.1l-8-4.7c-0.7-0.4-1.6-0.4-2.4,0L1.2,5C0.4,5.4,0,6.2,0,7v9.4c0,0.8,0.4,1.6,1.2,2.1l8.1,4.7 c0.7,0.4,1.6,0.4,2.4,0l5.5-3.2l3.8-2.2l5.5-3.2c0.7-0.4,1.6-0.4,2.4,0l4.3,2.5c0.7,0.4,1.2,1.2,1.2,2.1v5c0,0.8-0.4,1.6-1.2,2.1 L29,28.8c-0.7,0.4-1.6,0.4-2.4,0l-4.3-2.5c-0.7-0.4-1.2-1.2-1.2-2.1V21l-3.8,2.2v3.3c0,0.8,0.4,1.6,1.2,2.1l8.1,4.7 c0.7,0.4,1.6,0.4,2.4,0l8.1-4.7c0.7-0.4,1.2-1.2,1.2-2.1V17c0-0.8-0.4-1.6-1.2-2.1L29,10.2z"
                fill="white"
              />
            </svg>
          ),
        };
      default:
        return { name: "Switch Network", logo: null, isSupported: false };
    }
  };

  const networkInfo = getNetworkInfo();

  return (
    <button
      onClick={() => open({ view: "Networks" })}
      type="button"
      className={`flex items-center gap-2 px-4 py-2 border text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
        networkInfo.isSupported
          ? "bg-white/5 border-white/10 hover:bg-white/10"
          : "bg-red-500/10 border-red-500/50 hover:bg-red-500/20 text-red-400 animate-pulse"
      }`}
    >
      {networkInfo.logo && (
        <span className="flex-shrink-0">{networkInfo.logo}</span>
      )}
      <span>{networkInfo.name}</span>
    </button>
  );
}
