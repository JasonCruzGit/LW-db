"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LineupEditor, songToRow, type LineupRow } from "@/components/LineupEditor";
import { Protected } from "@/components/Protected";
import { api } from "@/lib/api";
import type { Song } from "@/lib/types";

function nextSundayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const add = (7 - day) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

export default function NewLineupPage() {
  return (
    <Protected roles={["admin", "song_leader"]}>
      <NewLineupInner />
    </Protected>
  );
}

function NewLineupInner() {
  const router = useRouter();
  const [serviceDate, setServiceDate] = useState(nextSundayISO);
  const [songLeaderName, setSongLeaderName] = useState("");
  const [rows, setRows] = useState<LineupRow[]>([]);
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.songs.list({ sort: "alpha" }).then(setCatalog).catch(() => setCatalog([]));
  }, []);

  function addSong() {
    const s = catalog.find((x) => x.id === pick);
    if (!s || rows.some((r) => r.songId === s.id)) return;
    setRows([...rows, songToRow(s)]);
    setPick("");
  }

  async function save(status: "draft" | "final" | "published") {
    setMsg(null);
    if (!serviceDate) {
      setMsg("Pick a service date.");
      return;
    }
    if (rows.length === 0) {
      setMsg("Add at least one song.");
      return;
    }
    setBusy(true);
    try {
      const lineup = await api.lineups.create({
        serviceDate,
        songLeaderName: songLeaderName.trim() || null,
        status,
        songs: rows.map((r, order) => ({
          songId: r.songId,
          order,
          selectedKey: r.selectedKey,
          notes: r.notes || null,
        })),
      });
      router.push(`/lineups/${lineup.id}`);
    } catch {
      setMsg("Could not save lineup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New lineup</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Arrange songs, set keys and notes, then save or publish.</p>
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

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

      <div className="no-print flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
          onClick={() => save("draft")}
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
          onClick={() => save("final")}
        >
          Mark final
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          onClick={() => save("published")}
        >
          Publish for Sunday
        </button>
      </div>
    </div>
  );
}
