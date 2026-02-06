"use client";

import { useState } from "react";
import { YellowService } from "@/services/yellow.service";
import { useYellow } from "@/hooks/useYellow";

export interface UseYellowPaymentReturn {
  loading: boolean;
  error: string | null;
  response: any;
  status: string;
  callEndpoint: (endpoint: string) => Promise<void>;
  reset: () => void;
}

export function useYellowPayment(): UseYellowPaymentReturn {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("// Waiting...");

  const { yellowClient, isAuthenticated } = useYellow();

  const reset = () => {
    setResponse(null);
    setError(null);
    setStatus("// Waiting...");
    setLoading(false);
  };

  const callEndpoint = async (endpoint: string) => {
    if (!isAuthenticated || !yellowClient) {
      throw new Error("Please connect to Yellow Network first");
    }

    setLoading(true);
    setError(null);
    setStatus("// Loading...");
    setResponse(null);

    try {
      // Step 1: Get payment requirements (402 response)
      setStatus("// Step 1: Getting payment requirements...");
      const requirements = await YellowService.getPaymentRequirements(endpoint);

      if (!requirements.accepts || requirements.accepts.length === 0) {
        throw new Error("No payment methods accepted");
      }

      const accept = requirements.accepts[0];
      console.log(`Payment required: ${accept.maxAmountRequired} ${accept.asset} → ${accept.payTo}`);

      // Step 2: Pay via Yellow Network (off-chain transfer)
      setStatus("// Step 2: Processing payment via Yellow Network...");
      const transactions = await yellowClient.transfer({
        destination: accept.payTo as `0x${string}`,
        asset: accept.asset,
        amount: accept.maxAmountRequired,
      });

      const tx = transactions[0];
      console.log(`✅ Payment sent! Transaction ID: ${tx.id}`);

      // Step 3: Call endpoint with payment proof
      setStatus("// Step 3: Calling endpoint with payment proof...");
      const paymentPayload = {
        scheme: accept.scheme,
        payload: {
          transactionId: tx.id,
          fromAccount: tx.from_account,
          toAccount: tx.to_account,
          asset: tx.asset,
          amount: tx.amount,
        },
      };

      const responseData = await YellowService.callEndpointWithPayment(
        endpoint,
        paymentPayload
      );

      setResponse(responseData);
      setStatus("// Success ✅");
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || "An error occurred";
      setError(errorMessage);
      setStatus("// Error ❌");
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
