"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === "1";

  useEffect(() => {
    if (!loading && user) window.location.assign("/");
  }, [loading, user]);

  useEffect(() => {
    if (authDisabled) window.location.assign("/");
  }, [authDisabled]);

  if (authDisabled) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500">Redirecting…</p>
      </div>
    );
  }

  if (loading || user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email.trim(), password);
      // Full navigation avoids stale RSC chunks / HMR WebSocket issues after auth.
      window.location.assign("/");
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "status" in err ? (err as { status?: number }).status : undefined;
      if (status === 401) {
        setError("Invalid email or password.");
      } else if (status && status >= 500) {
        setError("API error — check that the server is running and DATABASE_URL reaches Supabase.");
      } else if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Cannot reach API. Run `npm run dev` from the repo root (starts port 4000) or set NEXT_PUBLIC_API_URL.");
      } else {
        setError("Sign-in failed. Try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-center text-xl font-semibold">LW Worship Team App</h1>
        <p className="mt-1 text-center text-sm text-zinc-500">Sign in with your team account</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Email</label>
            <input
              className="login-field mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Password</label>
            <input
              className="login-field mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-zinc-400">
          Demo: admin@church.local / password123 · musician@church.local (charts) · singer@church.local (lyrics only)
        </p>
      </div>
    </div>
  );
}
