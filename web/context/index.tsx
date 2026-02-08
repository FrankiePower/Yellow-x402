"use client";

import React, { createContext, useState, useEffect, ReactNode } from "react";
import { createPublicClient, createWalletClient, custom, http, PublicClient, WalletClient, Chain } from "viem";
import { sepolia } from "viem/chains";
import { NitroliteClient, WalletStateSigner } from "@erc7824/nitrolite";
import { YellowClient } from "@/lib/yellow-client";

interface YellowNetworkContextType {
  isConnected: boolean;
  address: string | null;
  client: NitroliteClient | null;
  yellowClient: YellowClient | null;
  publicClient: PublicClient | null;
  walletClient: WalletClient | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  chain: Chain;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
}

export const YellowNetworkContext = createContext<YellowNetworkContextType | null>(null);

const CUSTODY_ADDRESS = "0x019B65A265EB3363822f2752141b3dF16131b262";
const ADJUDICATOR_ADDRESS = "0x7c7ccbc98469190849BCC6c926307794fDfB11F2";

export default function YellowNetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [client, setClient] = useState<NitroliteClient | null>(null);
  const [yellowClient, setYellowClient] = useState<YellowClient | null>(null);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const connect = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet");
      return;
    }

    try {
      setIsAuthenticating(true);

      // Switch to Sepolia network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }], // Sepolia chainId in hex
        });
      } catch (switchError: any) {
        // If Sepolia is not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            }],
          });
        } else {
          throw switchError;
        }
      }

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
        transport: http(),
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

      // Initialize Yellow Client using the connected wallet
      // User will sign the auth challenge via MetaMask
      const _yellowClient = new YellowClient(_walletClient, {
        appName: 'yellow-x402-frontend',
        clearnetUrl: process.env.NEXT_PUBLIC_CLEARNET_URL || 'wss://clearnet-sandbox.yellow.com/ws'
      });

      // Connect and authenticate to ClearNode
      await _yellowClient.connect();

      setYellowClient(_yellowClient);
      setIsAuthenticated(true);
      setIsConnected(true);
      console.log("✅ Connected to Yellow Network");
      console.log("  Address:", _yellowClient.address);

    } catch (error) {
      console.error("Failed to connect:", error);
      alert(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const disconnect = () => {
    if (yellowClient) {
      yellowClient.close();
    }
    setIsConnected(false);
    setIsAuthenticated(false);
    setAddress(null);
    setClient(null);
    setYellowClient(null);
    setWalletClient(null);
    setPublicClient(null);
  };



  return (
    <YellowNetworkContext.Provider
      value={{
        isConnected,
        address,
        client,
        yellowClient,
        publicClient,
        walletClient,
        connect,
        disconnect,
        chain: sepolia,
        isAuthenticating,
        isAuthenticated
      }}
    >
      {children}
    </YellowNetworkContext.Provider>
  );
}
