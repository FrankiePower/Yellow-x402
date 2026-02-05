"use client";

import { useYellow } from "./useYellow";

export function useWallet() {
  const { address, isConnected, connect } = useYellow();

  return {
    address,
    isConnected,
    connect,
  };
}
