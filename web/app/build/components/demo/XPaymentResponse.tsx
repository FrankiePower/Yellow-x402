import React from "react";
import { Loader, formatTime } from "./utils";

interface XPaymentResponseProps {
  xPaymentResponse?: any;
  bodyResponse?: any;
  elapsedTime: number;
}

export const XPaymentResponse = ({
  xPaymentResponse,
  bodyResponse,
  elapsedTime,
}: XPaymentResponseProps) => {
  return (
    <div className="bg-white/5 border border-white/20 p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            {xPaymentResponse ? (
              <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            ) : (
              <Loader />
            )}
            <span>
              {xPaymentResponse
                ? "X402 Response Received"
                : "Waiting for X402 Response..."}
            </span>
          </h4>
          <div className="text-xs font-mono text-white/60">
            {xPaymentResponse ? (
              <>
                Total time:{" "}
                <span className="text-white">{formatTime(elapsedTime)}</span>
              </>
            ) : (
              <>
                Elapsed:{" "}
                <span className="text-white/80">{formatTime(elapsedTime)}</span>
              </>
            )}
          </div>
        </div>

        {xPaymentResponse && (
          <>
            <div>
              <div className="text-xs text-white/60 mb-2">
                X402 Payment Response
              </div>
              <div className="bg-black/30 border border-white/10 p-4 rounded">
                <pre className="text-xs font-mono text-white/80 overflow-x-auto">
                  {JSON.stringify(xPaymentResponse, null, 2)}
                </pre>
              </div>
            </div>

            {bodyResponse && (
              <div>
                <div className="text-xs text-white/60 mb-2">
                  Protected Content Response
                </div>
                <div className="bg-black/30 border border-white/10 p-4 rounded">
                  <pre className="text-xs font-mono text-white/80 overflow-x-auto">
                    {JSON.stringify(bodyResponse, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

