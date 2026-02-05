"use client";

import { useState } from "react";
import { Omnix402Service } from "@/services/omnix402.service";
import { useYellow } from "@/hooks/useYellow";

export interface UseOmnix402Return {
  loading: boolean;
  error: string | null;
  response: any;
  status: string;
  callEndpoint: (endpointUrl: string, requestBody: any) => Promise<void>;
  reset: () => void;
}

export function useOmnix402(): UseOmnix402Return {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("// Waiting...");

  const { address, chain, isConnected, walletClient } = useYellow();
  const chainId = chain.id;

  const reset = () => {
    setResponse(null);
    setError(null);
    setStatus("// Waiting...");
    setLoading(false);
  };

  const callEndpoint = async (endpointUrl: string, requestBody: any) => {
    if (!isConnected || !walletClient) {
      throw new Error("Please connect your wallet first");
    }

    if (!endpointUrl) {
      throw new Error("Please enter an endpoint URL");
    }

    if (!address) {
      throw new Error("Wallet address not found");
    }

    setLoading(true);
    setError(null);
    setStatus("// Loading...");
    setResponse(null);

    try {
      // Determine network name from chainId
      const network = Omnix402Service.getNetworkFromChainId(chainId);

      if (!network) {
        throw new Error("Please switch to Base or Polygon network");
      }

      // Step 1: Get payment requirements
      setStatus("// Step 1: Getting payment requirements...");
      const requirements = await Omnix402Service.getPaymentRequirements(
        endpointUrl,
        network
      );

      // Step 2: Sign payment with EIP-3009
      setStatus("// Step 2: Signing payment (check wallet)...");

      const accept = requirements.accepts.find((a) => a.network === network);
      if (!accept) {
        throw new Error("No accept found for current network");
      }

      const validAfter = Math.floor(Date.now() / 1000);
      const validBefore = validAfter + 900; // 15 minutes
      const nonce = Omnix402Service.generateNonce();

      const domain = {
        name: accept.extra.name,
        version: "1",
        chainId: chainId,
        verifyingContract: accept.asset as `0x${string}`,
      } as const;

       const types = {
        TransferWithAuthorizationData: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      } as const;

      const message = {
        from: address as `0x${string}`,
        to: accept.payTo as `0x${string}`,
        value: BigInt(accept.maxAmountRequired),
        validAfter: BigInt(validAfter),
        validBefore: BigInt(validBefore),
        nonce: nonce as `0x${string}`,
      } as const;

      const signature = await walletClient.signTypedData({
        account: address as `0x${string}`,
        domain,
        types,
        primaryType: "TransferWithAuthorizationData",
        message,
      });

      // Step 3: Call endpoint with payment
      setStatus("// Step 3: Calling endpoint with payment...");

      const paymentPayload = Omnix402Service.createPaymentPayload(
        requirements,
        network,
        address,
        signature,
        validAfter,
        validBefore,
        nonce
      );

      const responseData = await Omnix402Service.callEndpointWithPayment(
        paymentPayload,
        requestBody
      );

      setResponse(responseData);
      setStatus("// Success");
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || "An error occurred";
      setError(errorMessage);
      setStatus("// Error");
      setResponse({ error: errorMessage });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    response,
    status,
    callEndpoint,
    reset,
  };
}