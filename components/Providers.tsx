"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import ReviveAdGoogle from "@/components/ReviveAdGoogle";
import { resolveReviveAdProviderMode } from "@/lib/client/ads";

const loadGoogleGam = resolveReviveAdProviderMode() === "slot";

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {loadGoogleGam && <ReviveAdGoogle />}
      {children}
    </QueryClientProvider>
  );
}
