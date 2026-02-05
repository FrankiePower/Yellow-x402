"use client";

import { useWallet } from "@/hooks/useWallet";

export function ConnectButton() {
  const { address, isConnected, connect } = useWallet();

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        type="button"
        className="relative px-6 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider transition-transform duration-300 hover:scale-105 border border-white cursor-pointer"
      >
        <span className="relative z-10">
          <span className="md:hidden">Connect</span>
          <span className="hidden md:inline">Connect Wallet</span>
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      type="button"
      className="px-4 py-2 bg-white/5 border border-white/10 font-mono text-sm hover:bg-white/10 transition-colors cursor-pointer"
    >
      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connected"}
    </button>
  );
}
