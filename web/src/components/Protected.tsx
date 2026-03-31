"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import type { UserRole } from "@/lib/types";

export function Protected({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === "1";

  useEffect(() => {
    if (!authDisabled && !loading && !user) router.replace("/login");
  }, [authDisabled, loading, user, router]);

  useEffect(() => {
    if (!loading && user && roles && !roles.includes(user.role)) {
      router.replace("/");
    }
  }, [loading, user, roles, router]);

  if (loading || !user) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        Loading…
      </div>
    );
  }

  if (roles && !roles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
