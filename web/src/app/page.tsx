"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import type { Lineup, Song } from "@/lib/types";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [upcoming, setUpcoming] = useState<Lineup[]>([]);
  const [recent, setRecent] = useState<Song[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [u, r] = await Promise.all([
          api.lineups.list({ upcoming: "true" }),
          api.meta.recentSongs(),
        ]);
        if (!cancelled) {
          setUpcoming(u);
          setRecent(r);
        }
      } catch (e) {
        if (!cancelled) setErr("Could not load dashboard data.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const deleteUpcomingLineup = useCallback(
    async (l: Lineup) => {
      if (user?.role !== "admin" || deletingId) return;
      const when = new Date(l.serviceDate).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      if (
        !window.confirm(
          `Delete the published setlist for ${when} (${l.songs.length} songs)? This cannot be undone.`
        )
      ) {
        return;
      }
      setDeleteErr(null);
      setDeletingId(l.id);
      try {
        await api.lineups.remove(l.id);
        setUpcoming((prev) => prev.filter((x) => x.id !== l.id));
      } catch (e: unknown) {
        const body =
          e && typeof e === "object" && "body" in e
            ? (e as { body?: { error?: string } }).body
            : undefined;
        setDeleteErr(typeof body?.error === "string" ? body.error : "Could not delete lineup.");
      } finally {
        setDeletingId(null);
      }
    },
    [user?.role, deletingId]
  );

  if (loading) {
    return <div className="text-zinc-500">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Sign in to browse songs, build lineups, and view Sunday charts.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Upcoming services and quick access.</p>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {deleteErr && <p className="text-sm text-red-600">{deleteErr}</p>}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Upcoming lineup</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Published upcoming services can only be removed by an admin. Song leaders can open{" "}
          <strong className="font-medium text-zinc-600 dark:text-zinc-400">Edit lineup</strong> for drafts, or ask an
          admin to delete a published setlist.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {upcoming.length === 0 && (
            <p className="text-sm text-zinc-500">No published upcoming services yet.</p>
          )}
          {upcoming.map((l) => (
            <div
              key={l.id}
              className="flex items-stretch overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Link
                href={`/service/${l.id}`}
                className="flex min-w-0 flex-1 flex-col p-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="text-sm font-medium text-zinc-500">
                  {new Date(l.serviceDate).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="mt-1 font-semibold">{l.songs.length} songs</div>
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Open service view →</div>
              </Link>
              {(user.role === "admin" || user.role === "song_leader") && (
                <div className="flex shrink-0 flex-col justify-center gap-2 border-l border-zinc-200 px-3 py-3 dark:border-zinc-800">
                  <Link
                    href={`/lineups/${l.id}`}
                    className="whitespace-nowrap text-center text-sm font-medium text-zinc-800 underline dark:text-zinc-200"
                  >
                    Edit lineup
                  </Link>
                  {user.role === "admin" && (
                    <button
                      type="button"
                      disabled={deletingId === l.id}
                      className="whitespace-nowrap rounded-lg border border-red-300 px-2 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                      onClick={() => deleteUpcomingLineup(l)}
                    >
                      {deletingId === l.id ? "Deleting…" : "Delete"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Recently used</h2>
          <Link href="/songs" className="text-sm font-medium text-zinc-900 underline dark:text-white">
            Song library
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {recent.length === 0 && (
            <li className="px-4 py-3 text-sm text-zinc-500">No history yet — publish a lineup to populate this.</li>
          )}
          {recent.map((s) => (
            <li key={s.id}>
              <Link href={`/songs/${s.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <span className="font-medium">{s.title}</span>
                <span className="text-sm text-zinc-500">
                  {s.key} · {s.bpm} BPM
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/songs"
          className="rounded-xl border border-zinc-200 bg-white p-4 text-center font-medium shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          Browse songs
        </Link>
        {(user.role === "song_leader" || user.role === "admin") && (
          <Link
            href="/lineups/new"
            className="rounded-xl border border-zinc-200 bg-white p-4 text-center font-medium shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            New lineup
          </Link>
        )}
        <Link
          href="/songs/history"
          className="rounded-xl border border-zinc-200 bg-white p-4 text-center font-medium shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          Setlist history
        </Link>
      </section>
    </div>
  );
}
