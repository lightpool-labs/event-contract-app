"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "@wagmi/core";
import { createConfig, http, WagmiProvider } from "wagmi";
import { defineChain } from "viem";
import { useState, type ReactNode } from "react";

const chainId = Number(process.env.NEXT_PUBLIC_EVM_CHAIN_ID ?? "1337");
const rpcUrl =
  process.env.NEXT_PUBLIC_EVM_RPC_URL ?? "http://127.0.0.1:8545";

export const lightpoolLocal = defineChain({
  id: chainId,
  name: "LightPool Local Reth",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
});

const wagmiConfig = createConfig({
  chains: [lightpoolLocal],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [lightpoolLocal.id]: http(rpcUrl),
  },
  ssr: true,
});

export function WalletProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
