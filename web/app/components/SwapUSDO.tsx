"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, Address } from "viem";
import { USDO_ADDRESS, USDO_ABI, ERC20_ABI } from "../../config/contracts";
import { ConnectButton } from "./ConnectButton";
import { useAppKit } from "@reown/appkit/react";

export default function SwapUSDO() {
  const { address, chainId, isConnected } = useAccount();
  const { open } = useAppKit();
  const [amount, setAmount] = useState("");
  const [isWrapping, setIsWrapping] = useState(true); // true = wrap (USDC->USDO), false = unwrap (USDO->USDC)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  const usdoAddress = chainId ? USDO_ADDRESS[chainId] : undefined;

  // Read USDC Address from USDO contract
  const { data: usdcAddress } = useReadContract({
    address: usdoAddress,
    abi: USDO_ABI,
    functionName: "USDC",
    query: {
      enabled: !!usdoAddress,
    },
  });

  // Read Balances
  const { data: usdoBalance, refetch: refetchUsdo } = useReadContract({
    address: usdoAddress,
    abi: USDO_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!usdoAddress,
    },
  });

  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: usdcAddress as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!usdcAddress,
    },
  });

  const { data: usdcDecimals } = useReadContract({
    address: usdcAddress as Address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: {
      enabled: !!usdcAddress,
    },
  });

  // Allowance check
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && usdoAddress ? [address, usdoAddress] : undefined,
    query: {
      enabled: !!address && !!usdoAddress && !!usdcAddress,
    },
  });

  const { writeContractAsync, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) {
      refetchUsdo();
      refetchUsdc();
      refetchAllowance();
      setAmount("");
      setTxHash(undefined);
    }
  }, [isSuccess, refetchUsdo, refetchUsdc, refetchAllowance]);

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

  if (!usdoAddress || !usdcAddress) {
    return (
      <div className="p-6 border border-white/10 bg-white/5 text-center">
        <p className="text-white/60 text-sm font-mono">
          Unsupported network. Switch to Base or Polygon.
        </p>
      </div>
    );
  }

  const handleAction = async () => {
    if (!amount || !usdcDecimals) return;
    const parsedAmount = parseUnits(amount, usdcDecimals);

    try {
      if (isWrapping) {
        // Wrap: Approve USDC -> Deposit
        if (!allowance || allowance < parsedAmount) {
          const tx = await writeContractAsync({
            address: usdcAddress as Address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [usdoAddress, parsedAmount],
          });
          setTxHash(tx);
          // Note: Ideally we wait for approval receipt before deposit, but for simple UX here we might need two clicks or better flow
          // Let's keep it simple: if approval needed, just approve. User clicks again to deposit.
          return;
        }

        const tx = await writeContractAsync({
          address: usdoAddress,
          abi: USDO_ABI,
          functionName: "deposit",
          args: [parsedAmount],
        });
        setTxHash(tx);
      } else {
        // Unwrap: Withdraw (no approval needed for burning own tokens usually, check logic)
        // USDO.withdraw burns msg.sender tokens. No approval needed for contract to burn sender tokens?
        // Actually USDO.withdraw calls _burn(msg.sender, amount). ERC20 burn doesn't need allowance if owner calls it.
        const tx = await writeContractAsync({
          address: usdoAddress,
          abi: USDO_ABI,
          functionName: "withdraw",
          args: [parsedAmount],
        });
        setTxHash(tx);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const decimals = usdcDecimals || 6;
  const maxBalance = isWrapping
    ? usdcBalance
      ? formatUnits(usdcBalance, decimals)
      : "0"
    : usdoBalance
    ? formatUnits(usdoBalance as bigint, decimals)
    : "0";

  const needsApproval =
    isWrapping &&
    allowance !== undefined &&
    amount &&
    parseUnits(amount, decimals) > allowance;

  const networkName =
    chainId === 8453 ? "Base" : chainId === 137 ? "Polygon" : "Unknown";

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
            ) : (
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 38.4 33.5" fill="none">
                  <path
                    d="M29,10.2c-0.7-0.4-1.6-0.4-2.4,0L21,13.5l-3.8,2.1l-5.5,3.3c-0.7,0.4-1.6,0.4-2.4,0L5,16.3 c-0.7-0.4-1.2-1.2-1.2-2.1v-5c0-0.8,0.4-1.6,1.2-2.1l4.3-2.5c0.7-0.4,1.6-0.4,2.4,0L16,7.2c0.7,0.4,1.2,1.2,1.2,2.1v3.3l3.8-2.2V7 c0-0.8-0.4-1.6-1.2-2.1l-8-4.7c-0.7-0.4-1.6-0.4-2.4,0L1.2,5C0.4,5.4,0,6.2,0,7v9.4c0,0.8,0.4,1.6,1.2,2.1l8.1,4.7 c0.7,0.4,1.6,0.4,2.4,0l5.5-3.2l3.8-2.2l5.5-3.2c0.7-0.4,1.6-0.4,2.4,0l4.3,2.5c0.7,0.4,1.2,1.2,1.2,2.1v5c0,0.8-0.4,1.6-1.2,2.1 L29,28.8c-0.7,0.4-1.6,0.4-2.4,0l-4.3-2.5c-0.7-0.4-1.2-1.2-1.2-2.1V21l-3.8,2.2v3.3c0,0.8,0.4,1.6,1.2,2.1l8.1,4.7 c0.7,0.4,1.6,0.4,2.4,0l8.1-4.7c0.7-0.4,1.2-1.2,1.2-2.1V17c0-0.8-0.4-1.6-1.2-2.1L29,10.2z"
                    fill="white"
                  />
                </svg>
                <span className="text-sm text-white font-mono">Polygon</span>
              </div>
            )}
          </div>
          <button
            onClick={() => open({ view: "Networks" })}
            className="text-xs text-white/50 hover:text-white font-mono uppercase tracking-wider transition-colors flex items-center gap-1"
          >
            Switch
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </button>
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
