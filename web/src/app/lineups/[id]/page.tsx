"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LineupEditor, songToRow, type LineupRow } from "@/components/LineupEditor";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import type { Lineup, Song } from "@/lib/types";

export default function LineupDetailPage() {
  return (
    <Protected>
      <LineupDetailInner />
    </Protected>
  );
}

function LineupDetailInner() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const { user } = useAuth();
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [serviceDate, setServiceDate] = useState("");
  const [songLeaderName, setSongLeaderName] = useState("");
  const [rows, setRows] = useState<LineupRow[]>([]);
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canEdit =
    user &&
    (user.role === "admin" || user.role === "song_leader") &&
    lineup &&
    (user.role === "admin" || lineup.createdById === user.id);

  const canDelete =
    user &&
    lineup &&
    (user.role === "admin" || (canEdit && lineup.status === "draft"));

  useEffect(() => {
    api.songs.list({ sort: "alpha" }).then(setCatalog).catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const l = await api.lineups.get(id);
        if (cancelled) return;
        setLineup(l);
        setServiceDate(l.serviceDate.slice(0, 10));
        setSongLeaderName(l.songLeaderName ?? "");
        setRows(
          l.songs.map((ls) => ({
            songId: ls.song.id,
            title: ls.song.title,
            bpm: ls.song.bpm,
            originalKey: ls.song.key,
            selectedKey: ls.selectedKey,
            notes: ls.notes ?? "",
          }))
        );
      } catch {
        if (!cancelled) setMsg("Lineup not found.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function addSong() {
    const s = catalog.find((x) => x.id === pick);
    if (!s || rows.some((r) => r.songId === s.id)) return;
    setRows([...rows, songToRow(s)]);
    setPick("");
  }

  async function save(status?: "draft" | "final" | "published") {
    if (!lineup || !canEdit) return;
    setMsg(null);
    setBusy(true);
    try {
      const nextStatus = status ?? lineup.status;
      const updated = await api.lineups.update(lineup.id, {
        serviceDate,
        songLeaderName: songLeaderName.trim() || null,
        status: nextStatus,
        songs: rows.map((r, order) => ({
          songId: r.songId,
          order,
          selectedKey: r.selectedKey,
          notes: r.notes || null,
        })),
      });
      setLineup(updated);
      router.refresh();
    } catch {
      setMsg("Could not update lineup.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLineup() {
    if (!lineup || !canDelete || busy) return;
    const label = new Date(lineup.serviceDate).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const warn =
      lineup.status !== "draft"
        ? `Delete this published setlist (${label})? This cannot be undone.`
        : `Delete this draft setlist (${label})? This cannot be undone.`;
    if (!window.confirm(warn)) return;
    setMsg(null);
    setBusy(true);
    try {
      await api.lineups.remove(lineup.id);
      router.replace("/");
      router.refresh();
    } catch (e: unknown) {
      const body =
        e && typeof e === "object" && "body" in e
          ? (e as { body?: { error?: string } }).body
          : undefined;
      setMsg(typeof body?.error === "string" ? body.error : "Could not delete setlist.");
    } finally {
      setBusy(false);
    }
  }

  if (msg && !lineup) {
    return <p className="text-red-600">{msg}</p>;
  }

  if (!lineup) {
    return <p className="text-zinc-500">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Lineup</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Status: <span className="font-medium text-zinc-800 dark:text-zinc-200">{lineup.status}</span>
            {lineup.publishedAt && (
              <>
                {" "}
                · Published {new Date(lineup.publishedAt).toLocaleString()}
              </>
            )}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link
            href={`/service/${lineup.id}`}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
          >
            Service view
          </Link>
          {canEdit && (
            <>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => save("draft")}
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => save("final")}
              >
                Mark final
              </button>
              <button
                type="button"
                disabled={busy || lineup.status === "published"}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={() => save("published")}
              >
                Publish
              </button>
            </>
          )}
          {canDelete && (
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
              onClick={deleteLineup}
            >
              Delete setlist
            </button>
          )}
        </div>
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      {canEdit ? (
        <LineupEditor
          serviceDate={serviceDate}
          onServiceDateChange={setServiceDate}
          songLeaderName={songLeaderName}
          onSongLeaderNameChange={setSongLeaderName}
          rows={rows}
          onRowsChange={setRows}
          songPicker={
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Add song</div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <select
                  className="select-field min-w-0 flex-1 px-3 py-2 pr-9"
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {catalog.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} — {s.artist}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
                  onClick={addSong}
                >
                  Add
                </button>
              </div>
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            Read-only — only the creator or an admin can edit this lineup.
          </p>
          {lineup.songLeaderName && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">Song leader:</span> {lineup.songLeaderName}
            </p>
          )}
          <ol className="list-decimal space-y-4 pl-5">
            {lineup.songs.map((ls) => (
              <li key={ls.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="font-semibold">{ls.song.title}</div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Key: {ls.selectedKey} · BPM: {ls.song.bpm}
                </div>
                {ls.notes && <div className="mt-2 text-sm">{ls.notes}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
