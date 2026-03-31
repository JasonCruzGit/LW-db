"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LineupEditor, songToRow, type LineupRow } from "@/components/LineupEditor";
import { Protected } from "@/components/Protected";
import { api } from "@/lib/api";
import type { Lineup, Song } from "@/lib/types";

function nextSundayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const add = (7 - day) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

export default function NewLineupPage() {
  return (
    <Protected roles={["admin", "song_leader", "singer"]}>
      <NewLineupInner />
    </Protected>
  );
}

function NewLineupInner() {
  const router = useRouter();
  const [tab, setTab] = useState<"new" | "drafts">("new");
  const [serviceDate, setServiceDate] = useState(nextSundayISO);
  const [songLeaderName, setSongLeaderName] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [rows, setRows] = useState<LineupRow[]>([]);
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; href?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Lineup[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsErr, setDraftsErr] = useState<string | null>(null);

  const draftList = useMemo(() => {
    return drafts.slice().sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
  }, [drafts]);

  useEffect(() => {
    api.songs.list({ sort: "alpha" }).then(setCatalog).catch(() => setCatalog([]));
  }, []);

  function resetBuilder() {
    setRows([]);
    setPick("");
    setSongLeaderName("");
    setServiceDate(nextSundayISO());
    setChangeNote("");
  }

  useEffect(() => {
    if (tab !== "drafts") return;
    let cancelled = false;
    setDraftsErr(null);
    setDraftsLoading(true);
    api.lineups
      .list({ drafts: "true" })
      .then((list) => {
        if (!cancelled) setDrafts(list);
      })
      .catch(() => {
        if (!cancelled) setDraftsErr("Could not load drafts.");
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
    if (!s) return;
    if (rows.some((r) => r.songId === s.id)) {
      setToast("Already added.");
      window.setTimeout(() => setToast(null), 1400);
      return;
    }
    setRows([...rows, songToRow(s)]);
    setPick("");
    setToast(`Added “${s.title}”.`);
    window.setTimeout(() => setToast(null), 1400);
  }

  async function save(status: "draft" | "final" | "published") {
    setMsg(null);
    setNotice(null);
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
        changeNote: changeNote.trim() || null,
        status,
        songs: rows.map((r, order) => ({
          songId: r.songId,
          order,
          selectedKey: r.selectedKey,
          notes: r.notes || null,
        })),
      });
      resetBuilder();
      if (status === "draft") {
        setNotice({ text: "Saved to Drafts. You can reopen and edit it anytime.", href: `/lineups/${lineup.id}` });
        setTab("drafts");
      } else if (status === "final") {
        setNotice({ text: "Lineup created and marked Final.", href: `/lineups/${lineup.id}` });
        setTab("drafts");
      } else {
        setNotice({ text: "Published for Sunday. It will show up on the Dashboard / Service View.", href: `/service/${lineup.id}` });
        setTab("drafts");
      }
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "new"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
          onClick={() => {
            setMsg(null);
            setNotice(null);
            setTab("new");
          }}
        >
          New lineup
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "drafts"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
          onClick={() => {
            setMsg(null);
            setNotice(null);
            setTab("drafts");
          }}
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

      {msg && tab === "new" && <p className="text-sm text-red-600">{msg}</p>}
      {toast && (
        <div className="no-print fixed bottom-4 right-4 z-50 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-zinc-900">
          {toast}
        </div>
      )}

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
              <div
                data-tour="lineup-add-song"
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
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

          <div data-tour="lineup-actions" className="no-print flex flex-wrap gap-2">
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
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm font-semibold">Draft setlists</div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Drafts are saved setlists you can reopen and keep editing later.
            </p>
          </div>

          {draftsErr && <p className="text-sm text-red-600">{draftsErr}</p>}
          {draftsLoading ? (
            <p className="text-sm text-zinc-500">Loading drafts…</p>
          ) : draftList.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500 dark:border-zinc-700">
              No drafts yet. Create a new lineup and click “Save draft”.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {draftList.map((l) => (
                <li key={l.id} className="flex items-stretch">
                  <Link
                    href={`/lineups/${l.id}`}
                    className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="font-semibold">
                        {new Date(l.serviceDate).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        Draft
                      </span>
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      {l.songs.length} song{l.songs.length === 1 ? "" : "s"}
                      {l.songLeaderName ? ` · Leader: ${l.songLeaderName}` : ""}
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center border-l border-zinc-200 px-3 py-3 dark:border-zinc-800">
                    <Link
                      href={`/lineups/${l.id}`}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    >
                      Edit
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
