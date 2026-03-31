"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { api } from "@/lib/api";

export default function MentionsPage() {
  return (
    <Protected>
      <MentionsInner />
    </Protected>
  );
}

function entityHref(entityType: string, entityId: string) {
  if (entityType === "song") return `/songs/${entityId}`;
  if (entityType === "lineup") return `/lineups/${entityId}`;
  return "/";
}

function MentionsInner() {
  const [items, setItems] = useState<
    Array<{
      id: string;
      readAt: string | null;
      createdAt: string;
      comment: { entityType: "song" | "lineup"; entityId: string; body: string; author?: { name: string } };
    }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const m = await api.mentions.list();
      setItems(m as any);
    } catch {
      setErr("Could not load mentions.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markAllRead() {
    setBusy(true);
    try {
      await api.mentions.markAllRead();
      await load();
    } finally {
      setBusy(false);
    }
  }

  const unread = items.filter((m) => !m.readAt).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mentions</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">Comments where someone @mentioned you.</p>
        </div>
        <button
          type="button"
          disabled={busy || unread === 0}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          onClick={markAllRead}
        >
          Mark all read
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {items.length === 0 && <div className="p-4 text-sm text-zinc-500">No mentions yet.</div>}
        {items.map((m) => (
          <Link
            key={m.id}
            href={entityHref(m.comment.entityType, m.comment.entityId)}
            className="block p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">
                {m.comment.author?.name || "User"}{" "}
                <span className="font-normal text-zinc-500">· {new Date(m.createdAt).toLocaleString()}</span>
              </div>
              {!m.readAt && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">NEW</span>
              )}
            </div>
            <div className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {m.comment.body}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

