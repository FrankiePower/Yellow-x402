"use client";

import { useYellow } from "./useYellow";

export function useWallet() {
  const { address, isConnected, connect, disconnect } = useYellow();

  return {
    address,
    isConnected,
    connect,
    disconnect,
  };
}
