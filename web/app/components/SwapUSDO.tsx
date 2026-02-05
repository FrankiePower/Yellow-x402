"use client";

import { useState, useEffect, useCallback } from "react";
import { parseUnits, formatUnits, Address } from "viem";
import { USDO_ADDRESS, USDO_ABI, ERC20_ABI } from "../../config/contracts";
import { ConnectButton } from "./ConnectButton";
import { useYellow } from "@/hooks/useYellow";

export default function SwapUSDO() {
  const { address, chain, isConnected, publicClient, walletClient } = useYellow();
  const chainId = chain.id;

  const [amount, setAmount] = useState("");
  const [isWrapping, setIsWrapping] = useState(true); // true = wrap (USDC->USDO), false = unwrap (USDO->USDC)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  
  // Data states
  const [usdcAddress, setUsdcAddress] = useState<Address | undefined>(undefined);
  const [usdoBalance, setUsdoBalance] = useState<bigint>(0n);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);
  const [usdcDecimals, setUsdcDecimals] = useState<number>(6);
  const [allowance, setAllowance] = useState<bigint>(0n);

  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const usdoAddress = chainId ? USDO_ADDRESS[chainId as keyof typeof USDO_ADDRESS] : undefined;

  const fetchData = useCallback(async () => {
    if (!publicClient || !usdoAddress) return;

    try {
      // 1. Get USDC Address from USDO contract
      if (!usdcAddress) {
          const _usdcAddress = await publicClient.readContract({
            address: usdoAddress,
            abi: USDO_ABI,
            functionName: "USDC",
          }) as Address;
          setUsdcAddress(_usdcAddress);
      }

      // If we have address (user connected)
      if (address) {
        // 2. Get USDO Balance
        const _usdoBalance = await publicClient.readContract({
            address: usdoAddress,
            abi: USDO_ABI,
            functionName: "balanceOf",
            args: [address as Address],
        }) as bigint;
        setUsdoBalance(_usdoBalance);

        if (usdcAddress) {
             // 3. Get USDC Balance
            const _usdcBalance = await publicClient.readContract({
                address: usdcAddress,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [address as Address],
            }) as bigint;
            setUsdcBalance(_usdcBalance);

            // 4. Get Decimals
            const _decimals = await publicClient.readContract({
                address: usdcAddress,
                abi: ERC20_ABI,
                functionName: "decimals",
            }) as number;
            setUsdcDecimals(_decimals);

            // 5. Get Allowance
            const _allowance = await publicClient.readContract({
                address: usdcAddress,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [address as Address, usdoAddress],
            }) as bigint;
            setAllowance(_allowance);
        }
      }
    } catch (error) {
        console.error("Error fetching data:", error);
    }
  }, [publicClient, usdoAddress, usdcAddress, address]);

  // Initial fetch and on dependencies change
  useEffect(() => {
    fetchData();
    // Set up interval for refreshing data? Or just on mount/change.
    const interval = setInterval(fetchData, 10000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!isConnected) {
    return (
      <div className="bg-white/5 border border-white/10 p-6">
        <div className="text-center space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-2">
            Connect Your Wallet
          </h3>
          <p className="text-white/60 text-sm font-mono mb-4">
            Connect to swap USDC/USDO
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (!usdoAddress) {
    return (
      <div className="p-6 border border-white/10 bg-white/5 text-center">
        <p className="text-white/60 text-sm font-mono">
          Unsupported network. Switch to Base or Polygon.
        </p>
      </div>
    );
  }

  const handleAction = async () => {
    if (!amount || !usdcDecimals || !walletClient || !publicClient || !address || !usdcAddress) return;
    const parsedAmount = parseUnits(amount, usdcDecimals);

    setIsPending(true);
    setTxHash(undefined);

    try {
      let hash: `0x${string}`;

      if (isWrapping) {
        // Wrap: Approve USDC -> Deposit
        if (allowance < parsedAmount) {
            // Need approval
             hash = await walletClient.writeContract({
                address: usdcAddress,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [usdoAddress, parsedAmount],
                account: address as Address, 
                chain: chain
            });
            // Simple UX: just approve first, let user click again to deposit or auto-continue? 
            // The original code returned after approval. I'll stick to that.
            setTxHash(hash);
            setIsConfirming(true);
            await publicClient.waitForTransactionReceipt({ hash });
            setIsConfirming(false);
            fetchData();
            setIsPending(false);
            return;
        }

        // Deposit
        hash = await walletClient.writeContract({
          address: usdoAddress,
          abi: USDO_ABI,
          functionName: "deposit",
          args: [parsedAmount],
          account: address as Address,
          chain: chain
        });

      } else {
        // Unwrap: Withdraw
        hash = await walletClient.writeContract({
          address: usdoAddress,
          abi: USDO_ABI,
          functionName: "withdraw",
          args: [parsedAmount],
          account: address as Address,
          chain: chain
        });
      }

      setTxHash(hash);
      setIsConfirming(true);
      await publicClient.waitForTransactionReceipt({ hash });
      setIsConfirming(false);
      
      // Success handling
      setAmount("");
      setTxHash(undefined);
      fetchData();

    } catch (e) {
      console.error(e);
    } finally {
        setIsPending(false);
        setIsConfirming(false);
    }
  };

  const decimals = usdcDecimals || 6;
  const maxBalance = isWrapping
    ? formatUnits(usdcBalance, decimals)
    : formatUnits(usdoBalance, decimals);

  const needsApproval =
    isWrapping &&
    allowance !== undefined &&
    amount &&
    parseUnits(amount, decimals) > allowance;

  return (
    <div className="bg-white/5 border border-white/10 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider">
          Swap USDC / USDO
        </h3>
        <div className="flex bg-black border border-white/20 rounded p-1">
          <button
            onClick={() => setIsWrapping(true)}
            className={`px-3 py-1 text-xs font-mono uppercase transition-colors ${
              isWrapping
                ? "bg-white text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            Wrap
          </button>
          <button
            onClick={() => setIsWrapping(false)}
            className={`px-3 py-1 text-xs font-mono uppercase transition-colors ${
              !isWrapping
                ? "bg-white text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            Unwrap
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs text-white/60 font-mono">
              Amount ({isWrapping ? "USDC" : "USDO"})
            </label>
            <span
              className="text-xs text-white/40 font-mono cursor-pointer hover:text-white"
              onClick={() => setAmount(maxBalance)}
            >
              Max: {maxBalance}
            </span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const value = e.target.value;
              // Allow only numbers and one decimal point
              if (value === "" || /^\d*\.?\d*$/.test(value)) {
                setAmount(value);
              }
            }}
            placeholder="0.00"
            className="w-full bg-black border border-white/20 px-4 py-3 text-white font-mono focus:border-white focus:outline-none transition-colors"
          />
        </div>

        <div className="flex justify-between text-xs text-white/40 font-mono px-1">
          <span>1 USDC = 1 USDO</span>
          <span>Stable 1:1</span>
        </div>

        <button
          disabled={isPending || isConfirming || !amount}
          onClick={handleAction}
          className="w-full bg-white text-black font-bold uppercase tracking-wider py-3 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending || isConfirming
            ? "Processing..."
            : needsApproval
            ? "Approve USDC"
            : isWrapping
            ? "Wrap to USDO"
            : "Unwrap to USDC"}
        </button>

        <div className="flex items-center justify-between bg-black/50 border border-white/10 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-mono">Receive on</span>
            {chainId === 8453 ? (
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 111 111" fill="none">
                  <path
                    d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z"
                    fill="white"
                  />
                </svg>
                <span className="text-sm text-white font-mono">Base</span>
              </div>
            ) : chainId === 137 ? (
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 38.4 33.5" fill="none">
                  <path
                    d="M29,10.2c-0.7-0.4-1.6-0.4-2.4,0L21,13.5l-3.8,2.1l-5.5,3.3c-0.7,0.4-1.6,0.4-2.4,0L5,16.3 c-0.7-0.4-1.2-1.2-1.2-2.1v-5c0-0.8,0.4-1.6,1.2-2.1l4.3-2.5c0.7-0.4,1.6-0.4,2.4,0L16,7.2c0.7,0.4,1.2,1.2,1.2,2.1v3.3l3.8-2.2V7 c0-0.8-0.4-1.6-1.2-2.1l-8-4.7c-0.7-0.4-1.6-0.4-2.4,0L1.2,5C0.4,5.4,0,6.2,0,7v9.4c0,0.8,0.4,1.6,1.2,2.1l8.1,4.7 c0.7,0.4,1.6,0.4,2.4,0l5.5-3.2l3.8-2.2l5.5-3.2c0.7-0.4,1.6-0.4,2.4,0l4.3,2.5c0.7-0.4,1.2,1.2,1.2,2.1v5c0,0.8-0.4,1.6-1.2,2.1 L29,28.8c-0.7,0.4-1.6,0.4-2.4,0l-4.3-2.5c-0.7-0.4-1.2-1.2-1.2-2.1V21l-3.8,2.2v3.3c0,0.8,0.4,1.6,1.2,2.1l8.1,4.7 c0.7,0.4,1.6,0.4,2.4,0l8.1-4.7c0.7-0.4,1.2-1.2,1.2-2.1V17c0-0.8-0.4-1.6-1.2-2.1L29,10.2z"
                    fill="white"
                  />
                </svg>
                <span className="text-sm text-white font-mono">Polygon</span>
              </div>
            ) : (
                <div className="flex items-center gap-2">
                 <span className="text-sm text-white font-mono">Unknown Network</span>
                </div>
            )}
          </div>
          
      {/* Network Switch Button - Removed or kept as non-functional if not supported */}
        </div>

        {txHash && (
          <div className="text-center mt-2">
            <a
              href={
                chainId === 8453
                  ? `https://basescan.org/tx/${txHash}`
                  : `https://polygonscan.com/tx/${txHash}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-white underline font-mono"
            >
              View Transaction
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
