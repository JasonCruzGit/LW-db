"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import type { Song } from "@/lib/types";

export default function SongsPage() {
  return (
    <Protected>
      <SongsInner />
    </Protected>
  );
}

function audioLabel(platform?: string | null) {
  if (!platform) return "Audio";
  if (platform === "youtube") return "YouTube";
  if (platform === "spotify") return "Spotify";
  return "Audio";
}

function SongsInner() {
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [filters, setFilters] = useState({
    q: "",
    key: "",
    bpmMin: "",
    bpmMax: "",
    tags: "",
    sort: "recent",
  });
  const [debouncedQ, setDebouncedQ] = useState("");
  const [meta, setMeta] = useState<{ keys: string[]; tags: string[]; bpmMin: number; bpmMax: number } | null>(
    null
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.meta
      .songFilters()
      .then(setMeta)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(filters.q), 250);
    return () => window.clearTimeout(t);
  }, [filters.q]);

  const params = useMemo(
    () => ({
      q: debouncedQ || undefined,
      key: filters.key || undefined,
      bpmMin: filters.bpmMin || undefined,
      bpmMax: filters.bpmMax || undefined,
      tags: filters.tags || undefined,
      sort: filters.sort || undefined,
    }),
    [filters.key, filters.bpmMin, filters.bpmMax, filters.tags, filters.sort, debouncedQ]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.songs.list(params);
        if (!cancelled) setSongs(list);
      } catch {
        if (!cancelled) setErr("Failed to load songs.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Song library</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">Search, filter, and open charts.</p>
        </div>
        {user?.role === "admin" && (
          <Link
            href="/admin/songs/new"
            className="inline-flex w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            Add song
          </Link>
        )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div
        data-tour="songs-filters"
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="text-xs font-medium uppercase text-zinc-500">
          Search
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="Title, artist, theme"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500">
          Key
          <select
            className="select-field mt-1 w-full px-3 py-2 pr-9"
            value={filters.key}
            onChange={(e) => setFilters((f) => ({ ...f, key: e.target.value }))}
          >
            <option value="">Any</option>
            {(meta?.keys || []).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500">
          BPM min
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={filters.bpmMin}
            placeholder={meta ? String(meta.bpmMin) : "60"}
            onChange={(e) => setFilters((f) => ({ ...f, bpmMin: e.target.value }))}
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500">
          BPM max
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={filters.bpmMax}
            placeholder={meta ? String(meta.bpmMax) : "180"}
            onChange={(e) => setFilters((f) => ({ ...f, bpmMax: e.target.value }))}
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500 sm:col-span-2">
          Tags (comma-separated)
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="praise, communion"
            value={filters.tags}
            onChange={(e) => setFilters((f) => ({ ...f, tags: e.target.value }))}
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500">
          Sort
          <select
            className="select-field mt-1 w-full px-3 py-2 pr-9"
            value={filters.sort}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
          >
            <option value="recent">Recently added</option>
            <option value="alpha">Alphabetical</option>
            <option value="bpm">BPM</option>
          </select>
        </label>
      </div>

      <ul
        data-tour="songs-list"
        className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {songs.map((s) => (
          <li key={s.id} className="flex items-stretch">
            <Link
              href={`/songs/${s.id}`}
              className="grid min-w-0 flex-1 grid-cols-1 gap-3 px-4 py-4 hover:bg-zinc-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center dark:hover:bg-zinc-800/50"
            >
              <div className="min-w-0">
                <div className="font-semibold">{s.title}</div>
                <div className="text-sm text-zinc-500">{s.artist}</div>
                {s.message && <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{s.message}</div>}
              </div>
              <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-2 text-sm sm:items-center">
                <span className="inline-flex w-10 justify-center rounded-md bg-zinc-100 px-2 py-0.5 font-medium tabular-nums dark:bg-zinc-800">
                  {s.key}
                </span>
                <span className="inline-flex w-20 justify-center rounded-md bg-zinc-100 px-2 py-0.5 font-medium tabular-nums dark:bg-zinc-800">
                  {s.bpm} BPM
                </span>
                <div className="flex min-w-0 flex-wrap justify-start gap-2 sm:justify-end">
                  {s.audioLinks?.[0]?.url && (
                    <a
                      href={s.audioLinks[0].url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      title={s.audioLinks[0].label || s.audioLinks[0].url}
                    >
                      {audioLabel((s.audioLinks[0] as any).platform)}
                    </a>
                  )}
                  {s.tags.map((t) => (
                    <span
                      key={t}
                      className="max-w-[14rem] truncate rounded-md border border-zinc-200 px-2 py-0.5 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                      title={t}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
            {user?.role === "admin" && (
              <div className="flex shrink-0 items-center border-l border-zinc-200 px-3 py-3 dark:border-zinc-800">
                <Link
                  href={`/admin/songs/${s.id}`}
                  className="rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-950/80"
                >
                  Edit song
                </Link>
              </div>
            )}
          </li>
        ))}
        {songs.length === 0 && <li className="px-4 py-8 text-center text-zinc-500">No songs match.</li>}
      </ul>
    </div>
  );
}
