"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { PwaControls } from "@/components/pwa-controls";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {});
      })
      .catch(() => {
        // Ignore service worker registration errors in restricted contexts.
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <PwaControls />
    </QueryClientProvider>
  );
}
