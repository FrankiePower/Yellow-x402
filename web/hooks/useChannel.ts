"use client";

import { useState, useCallback } from "react";
import { useYellow } from "@/hooks/useYellow";
import type { ChannelInfo } from "@/lib/yellow-client";

export interface ChannelState {
  channelId: string | null;
  status: "none" | "creating" | "open" | "closing" | "closed";
  createTxHash: string | null;
  closeTxHash: string | null;
  channelInfo: ChannelInfo | null;
  error: string | null;
}

const CHAIN_ID = 11155111; // Sepolia
const TOKEN_ADDRESS = "0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb"; // ytest.usd on sandbox

export function useChannel() {
  const { yellowClient, client, publicClient, isAuthenticated } = useYellow();

  const [state, setState] = useState<ChannelState>({
    channelId: null,
    status: "none",
    createTxHash: null,
    closeTxHash: null,
    channelInfo: null,
    error: null,
  });

  const [isLoading, setIsLoading] = useState(false);

  /**
   * Step 1: Create a channel (on-chain)
   * - Requests channel from ClearNode
   * - Submits to blockchain via NitroliteClient
   */
  const createChannel = useCallback(async () => {
    if (!yellowClient || !client || !publicClient || !isAuthenticated) {
      throw new Error("Not connected to Yellow Network");
    }

    setIsLoading(true);
    setState(prev => ({ ...prev, status: "creating", error: null }));

    try {
      // Request channel from ClearNode
      console.log("[useChannel] Requesting channel from ClearNode...");
      const channelResp = await yellowClient.createChannel({
        chain_id: CHAIN_ID,
        token: TOKEN_ADDRESS,
      });

      console.log("[useChannel] Channel response:", channelResp.channel_id);
      setState(prev => ({ ...prev, channelInfo: channelResp }));

      // Submit to blockchain
      console.log("[useChannel] Submitting to blockchain...");
      const { txHash } = await client.createChannel({
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

      console.log("[useChannel] Create tx submitted:", txHash);
      setState(prev => ({ ...prev, createTxHash: txHash }));

      // Wait for confirmation
      console.log("[useChannel] Waiting for confirmation...");
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      console.log("[useChannel] Channel created on-chain!");
      setState(prev => ({
        ...prev,
        channelId: channelResp.channel_id,
        status: "open",
      }));

      return { channelId: channelResp.channel_id, txHash };
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
        return { channelId: match[1], txHash: null, alreadyExists: true };
      }

      setState(prev => ({ ...prev, status: "none", error: err.message }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [yellowClient, client, publicClient, isAuthenticated]);

  /**
   * Step 2: Close channel and settle on-chain
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
      closeTxHash: null,
      channelInfo: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    isLoading,
    createChannel,
    closeChannel,
    reset,
  };
}
