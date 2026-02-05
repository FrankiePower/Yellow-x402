"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();

  const connect = () => {
    open();
  };

  return {
    address,
    isConnected,
    connect,
  };
}
