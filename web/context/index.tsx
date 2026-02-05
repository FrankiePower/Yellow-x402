"use client";

import React, { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, cookieToInitialState, type Config } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { config, networks, projectId, wagmiAdapter } from "@/config";
import { base } from "@reown/appkit/networks";

const queryClient = new QueryClient();

const metadata = {
  name: "OMNIX402",
  description: "Enabling agents to reach any X402 seller from any chain via an OFT powered protocol",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "https://omnix402.com",
  icons: ["/favicon.ico"],
};

// Initialize AppKit
if (!projectId) {
  console.error("AppKit Initialization Error: Project ID is missing.");
} else {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId: projectId!,
    networks: networks,
    defaultNetwork: base,
    metadata,
    features: { analytics: true },
  });
}

export default function ContextProvider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(config as Config, cookies);

  return (
    <WagmiProvider config={config as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
