import React from "react";
import { NetworkLogo, formatTime } from "./utils";

interface TransactionHeaderProps {
  sourceChainName: string;
  destinationChainName: string;
  elapsedTime: number;
  isComplete: boolean;
}

export const TransactionHeader = ({
  sourceChainName,
  destinationChainName,
  elapsedTime,
  isComplete,
}: TransactionHeaderProps) => {
  return (
    <div className="bg-white/5 border border-white/10 p-4 md:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono text-white/60 uppercase tracking-wider">
            Demo Transaction
          </h3>
          <div className="text-xs font-mono text-white">
            {formatTime(elapsedTime)}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-center">
          <div className="flex items-center gap-2">
            <NetworkLogo chainName={sourceChainName} />
            <span className="text-sm font-mono uppercase">
              {sourceChainName}
            </span>
          </div>
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 text-white/40 rotate-90 sm:rotate-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
          <div className="flex items-center gap-2">
            <NetworkLogo chainName={destinationChainName} />
            <span className="text-sm font-mono uppercase">
              {destinationChainName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
