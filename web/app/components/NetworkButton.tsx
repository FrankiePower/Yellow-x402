"use client";

import { useYellow } from "@/hooks/useYellow";

export function NetworkButton() {
  const { isConnected, chain } = useYellow();

  // Don't show button if not connected
  if (!isConnected) return null;

  return (
    <button
      type="button"
      className="flex items-center gap-2 px-4 py-2 border text-xs font-mono uppercase tracking-wider transition-colors cursor-default bg-white/5 border-white/10 hover:bg-white/10"
    >
       {/* Simple dot for connected status */}
       <span className="w-2 h-2 rounded-full bg-green-500"></span>
      <span>{chain.name}</span>
    </button>
  );
}
