import React from "react";

export const NetworkLogo = ({ chainName }: { chainName: string }) => {
  const chain = chainName.toLowerCase();

  if (chain === "base") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 111 111"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z"
          fill="white"
        />
      </svg>
    );
  }

  if (chain === "polygon") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 38.4 33.5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M29,10.2c-0.7-0.4-1.6-0.4-2.4,0L21,13.5l-3.8,2.1l-5.5,3.3c-0.7,0.4-1.6,0.4-2.4,0L5,16.3 c-0.7-0.4-1.2-1.2-1.2-2.1v-5c0-0.8,0.4-1.6,1.2-2.1l4.3-2.5c0.7-0.4,1.6-0.4,2.4,0L16,7.2c0.7,0.4,1.2,1.2,1.2,2.1v3.3l3.8-2.2V7 c0-0.8-0.4-1.6-1.2-2.1l-8-4.7c-0.7-0.4-1.6-0.4-2.4,0L1.2,5C0.4,5.4,0,6.2,0,7v9.4c0,0.8,0.4,1.6,1.2,2.1l8.1,4.7 c0.7,0.4,1.6,0.4,2.4,0l5.5-3.2l3.8-2.2l5.5-3.2c0.7-0.4,1.6-0.4,2.4,0l4.3,2.5c0.7,0.4,1.2,1.2,1.2,2.1v5c0,0.8-0.4,1.6-1.2,2.1 L29,28.8c-0.7,0.4-1.6,0.4-2.4,0l-4.3-2.5c-0.7-0.4-1.2-1.2-1.2-2.1V21l-3.8,2.2v3.3c0,0.8,0.4,1.6,1.2,2.1l8.1,4.7 c0.7,0.4,1.6,0.4,2.4,0l8.1-4.7c0.7-0.4,1.2-1.2,1.2-2.1V17c0-0.8-0.4-1.6-1.2-2.1L29,10.2z"
          fill="white"
        />
      </svg>
    );
  }

  return null;
};

export const Loader = () => (
  <div className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
);

export const StatusIcon = ({ status }: { status?: string }) => {
  if (!status) {
    return <Loader />;
  }

  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "pending") {
    return <Loader />;
  }

  if (
    normalizedStatus === "success" ||
    normalizedStatus === "completed" ||
    normalizedStatus === "confirmed"
  ) {
    return (
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
    );
  }

  return (
    <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center">
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
  );
};

export const getExplorerUrl = (chainName: string, txHash: string) => {
  const chain = chainName.toLowerCase();
  if (chain === "base") {
    return `https://basescan.org/tx/${txHash}`;
  }
  if (chain === "polygon") {
    return `https://polygonscan.com/tx/${txHash}`;
  }
  return "#";
};

export const formatTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
};
