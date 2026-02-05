"use client";

import { useEffect, useState } from "react";
import { Omnix402Service } from "@/services/omnix402.service";
import { TransactionHeader } from "./demo/TransactionHeader";
import { TransactionStep } from "./demo/TransactionStep";
import { XPaymentResponse } from "./demo/XPaymentResponse";
import { Loader } from "./demo/utils";

interface DemoStatusProps {
  callId: string;
}

interface CallStatus {
  sourceChainName: string;
  destinationChainName: string;
  sourcePaymentStatus?: string;
  sourcePaymentTxHash?: string;
  verifyStatus?: string;
  verifyHash?: string;
  relayStatus?: string;
  relayHash?: string;
  executionStatus?: string;
  executionHash?: string;
  destPaymentStatus?: string;
  destPaymentTxHash?: string;
  xPaymentResponse?: any;
  bodyResponse?: any;
  createdAt?: string;
  updatedAt?: string;
}

const getStatusMessage = (status?: string, defaultMsg?: string) => {
  if (!status) return defaultMsg || "Waiting...";
  const normalized = status.toLowerCase();
  if (normalized === "pending") return "Processing...";
  if (
    normalized === "success" ||
    normalized === "confirmed" ||
    normalized === "completed"
  )
    return "Completed";
  return status;
};

export default function DemoStatus({ callId }: DemoStatusProps) {
  const [status, setStatus] = useState<CallStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let timeIntervalId: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        const data = await Omnix402Service.getCallStatus(callId);
        setStatus(data);

        if (data.xPaymentResponse) {
          setIsComplete(true);
          if (intervalId) clearInterval(intervalId);
          if (timeIntervalId) clearInterval(timeIntervalId);
        }
      } catch (err: any) {
        setError(err.message);
        if (intervalId) clearInterval(intervalId);
        if (timeIntervalId) clearInterval(timeIntervalId);
      }
    };

    fetchStatus();

    if (!isComplete) {
      intervalId = setInterval(fetchStatus, 1000);
      timeIntervalId = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeIntervalId) clearInterval(timeIntervalId);
    };
  }, [callId, isComplete, startTime]);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 p-6">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center shrink-0">
            <svg
              className="w-3 h-3 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-1">
              Error
            </h4>
            <p className="text-xs text-red-400/80 font-mono">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-white/5 border border-white/10 p-6 flex items-center justify-center gap-3">
        <Loader />
        <span className="text-sm font-mono text-white/60">
          Loading status...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TransactionHeader
        sourceChainName={status.sourceChainName}
        destinationChainName={status.destinationChainName}
        elapsedTime={elapsedTime}
        isComplete={isComplete}
      />

      <div className="space-y-3">
        <TransactionStep
          stepNumber={1}
          title={`Payment on ${status.sourceChainName} with USD0`}
          status={status.sourcePaymentStatus}
          txHash={status.sourcePaymentTxHash}
          chainName={status.sourceChainName}
          statusMessage={getStatusMessage(
            status.sourcePaymentStatus,
            "Payment authorized and sent"
          )}
        />

        <TransactionStep
          stepNumber={2}
          title="DVN Verification (bridge)"
          status={status.verifyStatus}
          txHash={status.verifyHash}
          chainName={status.destinationChainName}
          statusMessage={getStatusMessage(
            status.verifyStatus,
            status.verifyStatus
              ? "Message verified by DVN"
              : "Waiting for payment..."
          )}
        />

        <TransactionStep
          stepNumber={3}
          title="Cross-Chain Relay (bridge)"
          status={status.relayStatus}
          txHash={status.relayHash}
          chainName={status.destinationChainName}
          statusMessage={getStatusMessage(
            status.relayStatus,
            status.relayStatus
              ? "Message relayed to destination"
              : "Waiting for verification..."
          )}
        />

        <TransactionStep
          stepNumber={4}
          title={`Finalize the bridge on ${status.destinationChainName}`}
          status={status.executionStatus}
          txHash={status.executionHash}
          chainName={status.destinationChainName}
          statusMessage={getStatusMessage(
            status.executionStatus,
            status.executionStatus
              ? "Payment executed successfully"
              : "Waiting for relay..."
          )}
        />

        {status.executionHash && (
          <TransactionStep
            stepNumber={5}
            title={`Final Payment on ${status.destinationChainName} with USDC`}
            status={status.destPaymentStatus}
            txHash={status.destPaymentTxHash}
            chainName={status.destinationChainName}
            statusMessage={getStatusMessage(
              status.destPaymentStatus,
              status.destPaymentStatus
                ? "Payment confirmed on destination"
                : "Waiting..."
            )}
          />
        )}
      </div>

      {status.executionHash && (
        <XPaymentResponse
          xPaymentResponse={status.xPaymentResponse}
          bodyResponse={status.bodyResponse}
          elapsedTime={elapsedTime}
        />
      )}
    </div>
  );
}
