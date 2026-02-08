"use client";

import { useState, useCallback } from "react";
import { useYellow } from "@/hooks/useYellow";
import type { ChannelInfo } from "@/lib/yellow-client";

export interface ChannelState {
  channelId: string | null;
  status: "none" | "creating" | "funding" | "open" | "closing" | "closed";
  createTxHash: string | null;
  resizeTxHash: string | null;
  closeTxHash: string | null;
  channelInfo: ChannelInfo | null;
  error: string | null;
}

const CHAIN_ID = 11155111; // Sepolia
const FUND_AMOUNT = 20n; // Amount to allocate from Unified Balance to channel
// ytest.usd token on Yellow sandbox
const YTEST_USD_TOKEN = "0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb";

export function useChannel() {
  const { yellowClient, client, publicClient, isAuthenticated } = useYellow();

  const [state, setState] = useState<ChannelState>({
    channelId: null,
    status: "none",
    createTxHash: null,
    resizeTxHash: null,
    closeTxHash: null,
    channelInfo: null,
    error: null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const tokenAddress = YTEST_USD_TOKEN;

  // Helper to fund (resize) an existing channel
  const fundChannel = useCallback(async (channelId: string) => {
    if (!yellowClient || !client || !publicClient) return;

    setState(prev => ({ ...prev, status: "funding", channelId }));
    console.log("[useChannel] Requesting resize from ClearNode...");
    console.log("[useChannel] Allocating", FUND_AMOUNT.toString(), "from Unified Balance");

    const resizeResp = await yellowClient.resizeChannel({
      channel_id: channelId,
      allocate_amount: FUND_AMOUNT,
    });

    console.log("[useChannel] Resize response received");

    // Step 5: Get proofStates from on-chain data
    let proofStates: any[] = [];
    try {
      console.log("[useChannel] Getting on-chain channel data for proofStates...");
      const onChainData = await client.getChannelData(channelId as `0x${string}`);
      if (onChainData.lastValidState) {
        proofStates = [onChainData.lastValidState];
        console.log("[useChannel] Got proofStates from on-chain data");
      }
    } catch (e) {
      console.log("[useChannel] Could not fetch on-chain data (may be new channel):", e);
    }

    // Step 6: Submit resize to blockchain
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
      proofStates,
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

    return resizeTxHash;
  }, [yellowClient, client, publicClient]);

  /**
   * Full channel lifecycle matching yellow-app reference:
   * 1. Create channel via ClearNode
   * 2. Submit to blockchain
   * 3. Wait 5s for node to index
   * 4. Call fundChannel (Resize)
   */
  const createChannel = useCallback(async () => {
    if (!yellowClient || !client || !publicClient || !isAuthenticated) {
      throw new Error("Not connected to Yellow Network");
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
      console.log("[useChannel] Waiting for confirmation...");
      await publicClient.waitForTransactionReceipt({ hash: createTxHash });
      console.log("[useChannel] Channel created on-chain!");

      // Step 3: Wait 5s for node to index (matching reference project)
      setState(prev => ({ ...prev, status: "funding" }));
      console.log("[useChannel] Waiting 5s for node to index channel...");
      await new Promise(r => setTimeout(r, 5000));

      // Step 4: Fund the channel (moves funds from Unified Balance to on-chain channel)
      const resizeTxHash = await fundChannel(channelResp.channel_id);

      console.log("[useChannel] Channel created and funded!");

      return { channelId: channelResp.channel_id, createTxHash, resizeTxHash };
    } catch (err: any) {
      console.error("[useChannel] Create error:", err);

      // Check if channel already exists
      let errorMsg = err.message;
      if (typeof err === 'object' && err.error) {
          errorMsg = JSON.stringify(err.error);
      }
      
      const match = errorMsg?.match(/0x[a-fA-F0-9]{64}/);
      if (match && (errorMsg.includes("already exists") || errorMsg.includes("open channel"))) {
        const existingId = match[0];
        console.log("[useChannel] Found existing channel:", existingId);
        
        // Recover: Check if funded
        try {
          console.log("[useChannel] Checking funding status via getChannels...");
          const { channels } = await yellowClient.getChannels();
          const channelData = channels.find((c: any) => c.channel_id === existingId);
          
          if (channelData) {
            console.log("[useChannel] Found channel data:", channelData);
            const allocations = channelData.state?.allocations || [];
            const isFunded = allocations.some((a: any) => BigInt(a.amount) > 0n);

            if (isFunded) {
              console.log("[useChannel] Channel is already funded. Opening.");
              setState(prev => ({
                ...prev,
                channelId: existingId,
                status: "open",
                error: null,
                channelInfo: channelData
              }));
              return { channelId: existingId, createTxHash: null, alreadyExists: true, funded: true };
            } else {
               console.log("[useChannel] Channel exists but is unfunded. Attempting to fund...");
               // If unfunded, try to fund it
               const resizeTxHash = await fundChannel(existingId);
               return { channelId: existingId, createTxHash: null, resizeTxHash, alreadyExists: true, funded: true };
            }
          }
        } catch (recoverErr) {
          console.error("[useChannel] Failed to verify/recover channel:", recoverErr);
        }

        // Fallback if recovery check failed but we have ID
        setState(prev => ({
          ...prev,
          channelId: existingId,
          status: "open",
          error: null,
          channelInfo: { 
            channel_id: existingId, 
            state: { intent: 0, version: 0, state_data: "0x", allocations: [] }, 
            server_signature: "0x" 
          }
        }));
        return { channelId: existingId, createTxHash: null, alreadyExists: true };
      }

      setState(prev => ({ ...prev, status: "none", error: err.message }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [yellowClient, client, publicClient, isAuthenticated, tokenAddress, fundChannel]);

  /**
   * Close channel and settle on-chain
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
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      console.log("[useChannel] Channel closed and settled on-chain!");
      setState(prev => ({ ...prev, status: "closed" }));

      return { txHash };
    } catch (err: any) {
      console.error("[useChannel] Close error:", err);
      setState(prev => ({ ...prev, status: "open", error: err.message }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [yellowClient, client, publicClient, state.channelId]);

  const reset = useCallback(() => {
    setState({
      channelId: null,
      status: "none",
      createTxHash: null,
      resizeTxHash: null,
      closeTxHash: null,
      channelInfo: null,
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
  };
}
