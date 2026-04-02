"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { AppShell } from "@/components/AppShell";
import { TourProvider } from "@/components/TourProvider";

/** Login is rendered without AppShell so its tree stays minimal (fewer RSC/HMR edge cases). */
function RouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // If Vercel deploys a new build while someone is on the site,
  // the HTML can reference chunks that no longer exist -> ChunkLoadError 404.
  // Reload once to pick up the new asset map.
  useEffect(() => {
    let reloading = false;
    function onUnhandledRejection(ev: PromiseRejectionEvent) {
      const msg = String((ev as any)?.reason?.message ?? (ev as any)?.reason ?? "");
      if (reloading) return;
      if (msg.includes("ChunkLoadError") || msg.includes("Loading chunk")) {
        reloading = true;
        window.location.reload();
      }
    }
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }, []);

  return (
    <AuthProvider>
      <TourProvider>
        <RouteShell>{children}</RouteShell>
      </TourProvider>
    </AuthProvider>
  );
}
