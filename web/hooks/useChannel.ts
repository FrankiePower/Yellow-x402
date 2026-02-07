"use client";

import { useState, useCallback, useEffect } from "react";
import { useYellow } from "@/hooks/useYellow";
import type { ChannelInfo } from "@/lib/yellow-client";

export interface ChannelState {
  channelId: string | null;
  status: "none" | "creating" | "funding" | "open" | "closing" | "closed";
  createTxHash: string | null;
  resizeTxHash: string | null;
  closeTxHash: string | null;
  channelInfo: ChannelInfo | null;
  ledgerBalance: string | null;
  error: string | null;
}

const CHAIN_ID = 11155111; // Sepolia
const FUND_AMOUNT = 20n; // Amount to allocate from Unified Balance to channel

export function useChannel() {
  const { yellowClient, client, publicClient, isAuthenticated, address } = useYellow();

  const [state, setState] = useState<ChannelState>({
    channelId: null,
    status: "none",
    createTxHash: null,
    resizeTxHash: null,
    closeTxHash: null,
    channelInfo: null,
    ledgerBalance: null,
    error: null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);

  // Fetch config to get correct token address
  useEffect(() => {
    if (!yellowClient || !isAuthenticated) return;

    const fetchConfig = async () => {
      try {
        console.log("[useChannel] Fetching config for token address...");
        const config = await yellowClient.getConfig();
        const asset = config.assets?.find(
          (a: any) => (a.chain_id ?? a.chainId) === CHAIN_ID
        );
        if (asset) {
          console.log("[useChannel] Found token:", asset.token);
          setTokenAddress(asset.token);
        } else {
          // Fallback to known sandbox token
          console.log("[useChannel] Using fallback token address");
          setTokenAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
        }
      } catch (err) {
        console.warn("[useChannel] Config fetch failed, using fallback:", err);
        setTokenAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
      }
    };

    fetchConfig();
  }, [yellowClient, isAuthenticated]);

  // Fetch ledger balance
  const refreshLedgerBalance = useCallback(async () => {
    if (!yellowClient || !isAuthenticated) return;
    try {
      const result = await yellowClient.getLedgerBalances();
      const ytestBal = result.balances?.find((b: any) =>
        b.asset === "ytest.usd" || b.asset?.includes("ytest")
      );
      if (ytestBal) {
        setState(prev => ({ ...prev, ledgerBalance: ytestBal.amount }));
      }
    } catch (err) {
      console.warn("[useChannel] Failed to fetch ledger balance:", err);
    }
  }, [yellowClient, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshLedgerBalance();
    }
  }, [isAuthenticated, refreshLedgerBalance]);

  /**
   * Full channel lifecycle:
   * 1. Create channel via ClearNode
   * 2. Submit to blockchain
   * 3. Resize (fund) channel with allocate_amount
   * 4. Submit resize to blockchain
   */
  const createChannel = useCallback(async () => {
    if (!yellowClient || !client || !publicClient || !isAuthenticated || !tokenAddress) {
      throw new Error("Not connected to Yellow Network or token not loaded");
    }

    setIsLoading(true);
    setState(prev => ({ ...prev, status: "creating", error: null }));

    try {
      // Step 1: Request channel from ClearNode
      console.log("[useChannel] Requesting channel from ClearNode...");
      console.log("[useChannel] Token:", tokenAddress, "Chain:", CHAIN_ID);

      const channelResp = await yellowClient.createChannel({
        chain_id: CHAIN_ID,
        token: tokenAddress,
      });

      console.log("[useChannel] Channel response:", channelResp.channel_id);
      setState(prev => ({ ...prev, channelInfo: channelResp }));

      // Step 2: Submit to blockchain
      console.log("[useChannel] Submitting to blockchain...");
      const { txHash: createTxHash } = await client.createChannel({
        channel: channelResp.channel as any,
        unsignedInitialState: {
          intent: channelResp.state.intent,
          version: BigInt(channelResp.state.version),
          data: channelResp.state.state_data as `0x${string}`,
          allocations: channelResp.state.allocations.map((a: any) => ({
            destination: a.destination as `0x${string}`,
            token: a.token as `0x${string}`,
            amount: BigInt(a.amount),
          })),
        },
        serverSignature: channelResp.server_signature as `0x${string}`,
      });

      console.log("[useChannel] Create tx submitted:", createTxHash);
      setState(prev => ({ ...prev, createTxHash, channelId: channelResp.channel_id }));

      // Wait for confirmation
      console.log("[useChannel] Waiting for create confirmation...");
      await publicClient.waitForTransactionReceipt({ hash: createTxHash });
      console.log("[useChannel] Channel created on-chain!");

      // Step 3: Wait for node to index, then resize (fund) channel
      setState(prev => ({ ...prev, status: "funding" }));
      console.log("[useChannel] Waiting 3s for node to index channel...");
      await new Promise(r => setTimeout(r, 3000));

      console.log("[useChannel] Requesting resize (funding) from ClearNode...");
      console.log("[useChannel] Allocating", FUND_AMOUNT.toString(), "from Unified Balance");

      const resizeResp = await yellowClient.resizeChannel({
        channel_id: channelResp.channel_id,
        allocate_amount: FUND_AMOUNT,
      });

      console.log("[useChannel] Resize response received");

      // Step 4: Submit resize to blockchain
      console.log("[useChannel] Submitting resize to blockchain...");
      const { txHash: resizeTxHash } = await client.resizeChannel({
        resizeState: {
          intent: resizeResp.state.intent,
          version: BigInt(resizeResp.state.version),
          data: (resizeResp.state.state_data || "0x") as `0x${string}`,
          allocations: resizeResp.state.allocations.map((a: any) => ({
            destination: a.destination as `0x${string}`,
            token: a.token as `0x${string}`,
            amount: BigInt(a.amount),
          })),
          channelId: resizeResp.channel_id as `0x${string}`,
          serverSignature: resizeResp.server_signature as `0x${string}`,
        },
        proofStates: [],
      });

      console.log("[useChannel] Resize tx submitted:", resizeTxHash);
      setState(prev => ({ ...prev, resizeTxHash }));

      // Wait for resize confirmation
      console.log("[useChannel] Waiting for resize confirmation...");
      await publicClient.waitForTransactionReceipt({ hash: resizeTxHash });

      console.log("[useChannel] Channel funded and ready!");
      setState(prev => ({
        ...prev,
        status: "open",
      }));

      // Refresh ledger balance
      await refreshLedgerBalance();

      return { channelId: channelResp.channel_id, createTxHash, resizeTxHash };
    } catch (err: any) {
      console.error("[useChannel] Create error:", err);

      // Check if channel already exists
      const match = err.message?.match(/(0x[0-9a-fA-F]{64})/);
      if (match && err.message.includes("already exists")) {
        setState(prev => ({
          ...prev,
          channelId: match[1],
          status: "open",
          error: null,
        }));
        return { channelId: match[1], createTxHash: null, alreadyExists: true };
      }

      setState(prev => ({ ...prev, status: "none", error: err.message }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [yellowClient, client, publicClient, isAuthenticated, tokenAddress, refreshLedgerBalance]);

  /**
   * Close channel and settle on-chain
   * - Requests final state from ClearNode
   * - Submits to blockchain via NitroliteClient
   */
  const closeChannel = useCallback(async () => {
    if (!yellowClient || !client || !publicClient || !state.channelId) {
      throw new Error("No channel to close");
    }

    setIsLoading(true);
    setState(prev => ({ ...prev, status: "closing", error: null }));

    try {
      // Request close from ClearNode
      console.log("[useChannel] Requesting close from ClearNode...");
      const closeResp = await yellowClient.closeChannel(
        state.channelId,
        yellowClient.address
      );

      console.log("[useChannel] Close response received");
      console.log("[useChannel] Final allocations:", closeResp.state.allocations);

      // Submit to blockchain
      console.log("[useChannel] Submitting close to blockchain...");
      const txHash = await client.closeChannel({
        finalState: {
          intent: closeResp.state.intent,
          version: BigInt(closeResp.state.version),
          data: (closeResp.state.state_data || "0x") as `0x${string}`,
          allocations: closeResp.state.allocations.map((a: any) => ({
            destination: a.destination as `0x${string}`,
            token: a.token as `0x${string}`,
            amount: BigInt(a.amount),
          })),
          channelId: closeResp.channel_id as `0x${string}`,
          serverSignature: closeResp.server_signature as `0x${string}`,
        },
        stateData: (closeResp.state.state_data || "0x") as `0x${string}`,
      });

      console.log("[useChannel] Close tx submitted:", txHash);
      setState(prev => ({ ...prev, closeTxHash: txHash }));

      // Wait for confirmation
      console.log("[useChannel] Waiting for confirmation...");
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      console.log("[useChannel] Channel closed and settled on-chain!");
      setState(prev => ({ ...prev, status: "closed" }));

      // Refresh ledger balance
      await refreshLedgerBalance();

      return { txHash };
    } catch (err: any) {
      console.error("[useChannel] Close error:", err);
      setState(prev => ({ ...prev, status: "open", error: err.message }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [yellowClient, client, publicClient, state.channelId, refreshLedgerBalance]);

  const reset = useCallback(() => {
    setState({
      channelId: null,
      status: "none",
      createTxHash: null,
      resizeTxHash: null,
      closeTxHash: null,
      channelInfo: null,
      ledgerBalance: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    isLoading,
    tokenAddress,
    createChannel,
    closeChannel,
    reset,
    refreshLedgerBalance,
  };
}
