import React from "react";
import { StatusIcon, NetworkLogo, getExplorerUrl } from "./utils";

interface TransactionStepProps {
  stepNumber: number;
  title: string;
  status?: string;
  txHash?: string;
  chainName: string;
  statusMessage?: string;
}

export const TransactionStep = ({
  stepNumber,
  title,
  status,
  txHash,
  chainName,
  statusMessage,
}: TransactionStepProps) => {
  return (
    <div className="bg-white/5 border border-white/10 p-3 md:p-4">
      <div className="flex items-start gap-3 md:gap-4">
        <StatusIcon status={status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider">
              {stepNumber}. {title}
            </h4>
            {txHash && (
              <a
                href={getExplorerUrl(chainName, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-mono text-white/60 hover:text-white transition-colors shrink-0"
              >
                <NetworkLogo chainName={chainName} />
                <span className="hidden sm:inline">View Transaction</span>
                <span className="sm:hidden">View TX</span>
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>
          {statusMessage && (
            <p className="text-xs text-white/60 font-mono">{statusMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
};
