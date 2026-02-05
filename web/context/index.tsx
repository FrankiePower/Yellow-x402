"use client";

import React, { createContext, useState, useEffect, ReactNode } from "react";
import { createPublicClient, createWalletClient, custom, http, PublicClient, WalletClient, Chain } from "viem";
import { sepolia } from "viem/chains";
import { NitroliteClient, WalletStateSigner } from "@erc7824/nitrolite";

interface YellowNetworkContextType {
  isConnected: boolean;
  address: string | null;
  client: NitroliteClient | null;
  publicClient: PublicClient | null;
  walletClient: WalletClient | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  chain: Chain;
}

export const YellowNetworkContext = createContext<YellowNetworkContextType | null>(null);

const CUSTODY_ADDRESS = "0x019B65A265EB3363822f2752141b3dF16131b262";
const ADJUDICATOR_ADDRESS = "0x7c7ccbc98469190849BCC6c926307794fDfB11F2";

export default function YellowNetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [client, setClient] = useState<NitroliteClient | null>(null);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  const connect = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet");
      return;
    }

    try {
      // Connect Wallet
      const tempWalletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum),
      });

      const [userAddress] = await tempWalletClient.requestAddresses();
      const address = userAddress as `0x${string}`;
      setAddress(address);

      const _walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum),
        account: address,
      });

      setWalletClient(_walletClient);

      // Setup Public Client
      const _publicClient = createPublicClient({
        chain: sepolia,
        transport: http(), // Default Viem public RPC or add specific one if needed
      });
      setPublicClient(_publicClient);

      // Initialize Nitrolite Client
      const nitroliteClient = new NitroliteClient({
        publicClient: _publicClient,
        walletClient: _walletClient,
        stateSigner: new WalletStateSigner(_walletClient),
        addresses: {
          custody: CUSTODY_ADDRESS,
          adjudicator: ADJUDICATOR_ADDRESS,
        },
        chainId: sepolia.id,
        challengeDuration: 3600n,
      });

      setClient(nitroliteClient);
      setIsConnected(true);
      console.log("Connected to Yellow Network via Nitrolite");

    } catch (error) {
      console.error("Failed to connect:", error);
      alert("Failed to connect wallet");
    }
  };

  const disconnect = () => {
    setIsConnected(false);
    setAddress(null);
    setClient(null);
    setWalletClient(null);
    setPublicClient(null);
  };

  return (
    <YellowNetworkContext.Provider
      value={{
        isConnected,
        address,
        client,
        publicClient,
        walletClient,
        connect,
        disconnect,
        chain: sepolia
      }}
    >
      {children}
    </YellowNetworkContext.Provider>
  );
}
