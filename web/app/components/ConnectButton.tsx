"use client";

import { useWallet } from "@/hooks/useWallet";

export function ConnectButton() {
  const { address, isConnected, connect, disconnect } = useWallet();

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
      onClick={disconnect}
      type="button"
      className="group px-4 py-2 bg-white/5 border border-white/10 font-mono text-sm hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500 transition-all cursor-pointer min-w-[140px]"
    >
      <span className="group-hover:hidden">
        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connected"}
      </span>
      <span className="hidden group-hover:block">
        Disconnect
      </span>
    </button>
  );
}
