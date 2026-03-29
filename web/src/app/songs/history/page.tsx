"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import type { Lineup } from "@/lib/types";

export default function SetlistHistoryPage() {
  return (
    <Protected>
      <HistoryInner />
    </Protected>
  );
}

function HistoryInner() {
  const { user } = useAuth();
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.lineups.list({ history: "true" }).then(setLineups).catch(() => setLineups([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteSetlist(l: Lineup) {
    if (user?.role !== "admin" || deletingId) return;
    const label = new Date(l.serviceDate).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!window.confirm(`Delete setlist for ${label}? This cannot be undone.`)) return;
    setErr(null);
    setDeletingId(l.id);
    try {
      await api.lineups.remove(l.id);
      setLineups((prev) => prev.filter((x) => x.id !== l.id));
    } catch (e: unknown) {
      const body =
        e && typeof e === "object" && "body" in e
          ? (e as { body?: { error?: string } }).body
          : undefined;
      setErr(typeof body?.error === "string" ? body.error : "Could not delete setlist.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Setlist history</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Past published services.</p>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {lineups.map((l) => (
          <li key={l.id} className="flex items-stretch">
            <Link
              href={`/service/${l.id}`}
              className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-4 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-800/50"
            >
              <div>
                <div className="font-semibold">
                  {new Date(l.serviceDate).toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                <div className="text-sm text-zinc-500">{l.songs.length} songs</div>
              </div>
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Open →</span>
            </Link>
            {user?.role === "admin" && (
              <div className="flex shrink-0 items-center border-l border-zinc-200 px-3 py-3 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={deletingId === l.id}
                  className="whitespace-nowrap rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                  onClick={() => deleteSetlist(l)}
                >
                  {deletingId === l.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            )}
          </li>
        ))}
        {lineups.length === 0 && (
          <li className="px-4 py-8 text-center text-zinc-500">No published history yet.</li>
        )}
      </ul>
    </div>
  );
}
