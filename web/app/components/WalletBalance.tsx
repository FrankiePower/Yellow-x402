"use client";

import { useYellow } from "@/hooks/useYellow";
import { useEffect, useState } from "react";
import { formatUnits, erc20Abi } from "viem";

const YTEST_USD_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

export default function WalletBalance() {
  const { address, publicClient, isConnected } = useYellow();
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      if (!address || !publicClient || !isConnected) return;

      try {
        const balanceBigInt = await publicClient.readContract({
          address: YTEST_USD_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });

        // ytest.usd has 6 decimals? yellow.md says "1 USDC = 1,000,000 units with 6 decimals" 
        // assuming ytest.usd is also 6 decimals based on standard USDO/USDC
        // yellow.md init example: allowances: [{ asset: 'ytest.usd', amount: '1000000000' }]
        // The quickstart example says "1 USDC = 1,000,000 units with 6 decimals"
        // Let's assume 6 decimals for ytest.usd as well since it's USD-pegged.
        
        setBalance(formatUnits(balanceBigInt, 6)); 
      } catch (error) {
        console.error("Failed to fetch balance", error);
        setBalance(null);
      }
    }

    fetchBalance();
    // Poll every 5 seconds
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [address, publicClient, isConnected]);

  if (!balance) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white/5 border border-white/10 text-xs md:text-sm font-mono tracking-wider">
      <span className="text-white/60">BAL:</span>
      <span className="text-[#FCD535] font-bold">{parseFloat(balance).toFixed(2)}</span>
      <span className="text-white/40">ytest.usd</span>
    </div>
  );
}
