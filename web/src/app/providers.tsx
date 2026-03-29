"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/contexts/auth-context";
import { AppShell } from "@/components/AppShell";

/** Login is rendered without AppShell so its tree stays minimal (fewer RSC/HMR edge cases). */
function RouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RouteShell>{children}</RouteShell>
    </AuthProvider>
  );
}
