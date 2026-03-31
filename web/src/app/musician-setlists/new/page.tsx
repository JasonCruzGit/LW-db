"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Protected } from "@/components/Protected";
import { LineupEditor, songToRow, type LineupRow } from "@/components/LineupEditor";
import { api } from "@/lib/api";
import type { Lineup, Song } from "@/lib/types";

function nextSundayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const add = (7 - day) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

export default function MusicianSetlistNewPage() {
  return (
    <Protected roles={["musician"]}>
      <Inner />
    </Protected>
  );
}

function Inner() {
  const [tab, setTab] = useState<"new" | "drafts">("new");
  const [serviceDate, setServiceDate] = useState(nextSundayISO);
  const [songLeaderName, setSongLeaderName] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [rows, setRows] = useState<LineupRow[]>([]);
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; href?: string } | null>(null);

  const [drafts, setDrafts] = useState<Lineup[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  const draftList = useMemo(() => drafts.slice().sort((a, b) => b.serviceDate.localeCompare(a.serviceDate)), [drafts]);

  useEffect(() => {
    api.songs.list({ sort: "alpha" }).then(setCatalog).catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (tab !== "drafts") return;
    let cancelled = false;
    setDraftsLoading(true);
    api.lineups
      .list({})
      .then((list) => {
        if (cancelled) return;
        // Musicians only create musicians-only drafts via API; filter defensively.
        setDrafts(list.filter((l) => (l as any).audience === "musicians_only" && l.status === "draft"));
      })
      .catch(() => {
        if (!cancelled) setDrafts([]);
      })
      .finally(() => {
        if (!cancelled) setDraftsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  function addSong() {
    const s = catalog.find((x) => x.id === pick);
    if (!s || rows.some((r) => r.songId === s.id)) return;
    setRows([...rows, songToRow(s)]);
    setPick("");
  }

  function reset() {
    setRows([]);
    setPick("");
    setSongLeaderName("");
    setServiceDate(nextSundayISO());
    setChangeNote("");
  }

  async function save(status: "draft" | "published") {
    setMsg(null);
    setNotice(null);
    if (!serviceDate) return setMsg("Pick a service date.");
    if (rows.length === 0) return setMsg("Add at least one song.");
    setBusy(true);
    try {
      const l = await api.lineups.create({
        serviceDate,
        songLeaderName: songLeaderName.trim() || null,
        changeNote: changeNote.trim() || null,
        status,
        audience: "musicians_only",
        songs: rows.map((r, order) => ({
          songId: r.songId,
          order,
          selectedKey: r.selectedKey,
          notes: r.notes || null,
        })),
      });
      reset();
      if (status === "draft") {
        setNotice({ text: "Saved draft (musicians-only).", href: `/lineups/${l.id}` });
        setTab("drafts");
      } else {
        setNotice({ text: "Posted to Musicians dashboard only.", href: `/service/${l.id}` });
        setTab("drafts");
      }
    } catch {
      setMsg("Could not save setlist.");
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
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Musician setlist</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Create a setlist that’s visible only to musicians.</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "new"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
          onClick={() => setTab("new")}
        >
          New
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "drafts"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
          onClick={() => setTab("drafts")}
        >
          Drafts
        </button>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium">{notice.text}</div>
            {notice.href && (
              <Link href={notice.href} className="text-sm font-semibold underline">
                Open →
              </Link>
            )}
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      {tab === "new" ? (
        <>
          <LineupEditor
            serviceDate={serviceDate}
            onServiceDateChange={setServiceDate}
            songLeaderName={songLeaderName}
            onSongLeaderNameChange={setSongLeaderName}
            changeNote={changeNote}
            onChangeNoteChange={setChangeNote}
            rows={rows}
            onRowsChange={setRows}
            songPicker={
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Add song</div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <select className="select-field min-w-0 flex-1 px-3 py-2 pr-9" value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">Choose…</option>
                    {catalog.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} — {s.artist}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900" onClick={addSong}>
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
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              onClick={() => save("published")}
            >
              Post to Musicians
            </button>
          </div>
        </>
      ) : (
        <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {draftsLoading && <div className="p-4 text-sm text-zinc-500">Loading…</div>}
          {!draftsLoading && draftList.length === 0 && <div className="p-4 text-sm text-zinc-500">No drafts yet.</div>}
          {draftList.map((l) => (
            <Link key={l.id} href={`/lineups/${l.id}`} className="block p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              <div className="font-medium">
                {new Date(l.serviceDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{l.songs.length} songs · Draft</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

