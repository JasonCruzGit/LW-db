"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { SongForm, formStateToPayload, songToFormState } from "@/components/SongForm";
import { api } from "@/lib/api";
import type { SongFormState } from "@/components/SongForm";
import type { AudioLink, AudioPlatform, Song, SongArrangement } from "@/lib/types";

export default function EditSongPage() {
  return (
    <Protected roles={["admin"]}>
      <EditSongInner />
    </Protected>
  );
}

function EditSongInner() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const [song, setSong] = useState<Song | null>(null);
  const [state, setState] = useState<SongFormState | null>(null);
  const [tab, setTab] = useState<"song" | "arrangements" | "audio">("song");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [arrangements, setArrangements] = useState<SongArrangement[]>([]);
  const [arrBusy, setArrBusy] = useState(false);
  const [arrMsg, setArrMsg] = useState<string | null>(null);
  const [selectedArrangementId, setSelectedArrangementId] = useState<string | null>(null);

  const [audioLinks, setAudioLinks] = useState<AudioLink[]>([]);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioMsg, setAudioMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.songs.get(id);
        if (!cancelled) {
          setSong(s);
          setState(songToFormState(s));
          setArrangements(s.arrangements ?? []);
          setAudioLinks(s.audioLinks ?? []);
        }
      } catch {
        if (!cancelled) setMsg("Song not found.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function submit() {
    if (!state) return;
    setBusy(true);
    setMsg(null);
    setNotice(null);
    try {
      await api.songs.update(id, formStateToPayload(state));
      setNotice("Saved.");
    } catch {
      setMsg("Could not update song.");
    } finally {
      setBusy(false);
    }
  }

  async function suggestTags() {
    if (!state) return;
    setMsg(null);
    setNotice(null);
    try {
      const text = `${state.message}\n\n${state.lyrics}`.trim();
      const { suggestions } = await api.meta.tagSuggestions(text, 8);
      if (suggestions.length === 0) {
        setNotice("No tag suggestions found.");
        return;
      }
      const existing = new Set(
        state.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => t.toLowerCase())
      );
      const merged = [
        ...state.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ...suggestions.filter((t) => !existing.has(t.toLowerCase())),
      ];
      setState({ ...state, tags: merged.join(", ") });
      setNotice(`Suggested tags: ${suggestions.join(", ")}`);
    } catch {
      setMsg("Could not suggest tags.");
    }
  }

  async function createArrangementFromSong() {
    if (!song || !state) return;
    setArrMsg(null);
    setNotice(null);
    setArrBusy(true);
    try {
      const created = await api.songs.arrangements.create(song.id, {
        name: `Default (${state.key})`,
        key: state.key,
        bpm: state.bpm,
        timeSignature: state.timeSignature.trim() || null,
        message: state.message.trim() || null,
        lyrics: state.lyrics.trim() || null,
        structure: null,
        chordSheets: state.chordSheets,
      });
      setArrangements((prev) => [created, ...prev]);
      setSelectedArrangementId(created.id);
      setNotice("Arrangement created.");
    } catch {
      setArrMsg("Could not create arrangement.");
    } finally {
      setArrBusy(false);
    }
  }

  function selectedArrangement(): SongArrangement | null {
    if (!selectedArrangementId) return null;
    return arrangements.find((a) => a.id === selectedArrangementId) ?? null;
  }

  async function saveArrangement(patch: Partial<SongArrangement> & { chordSheets?: any[] }) {
    const a = selectedArrangement();
    if (!a) return;
    setArrMsg(null);
    setNotice(null);
    setArrBusy(true);
    try {
      const updated = await api.songs.arrangements.update(a.id, patch);
      setArrangements((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setNotice("Arrangement saved.");
    } catch {
      setArrMsg("Could not save arrangement.");
    } finally {
      setArrBusy(false);
    }
  }

  async function deleteArrangement() {
    const a = selectedArrangement();
    if (!a) return;
    if (!confirm(`Delete arrangement “${a.name}”?`)) return;
    setArrMsg(null);
    setNotice(null);
    setArrBusy(true);
    try {
      await api.songs.arrangements.remove(a.id);
      setArrangements((prev) => prev.filter((x) => x.id !== a.id));
      setSelectedArrangementId(null);
      setNotice("Arrangement deleted.");
    } catch {
      setArrMsg("Could not delete arrangement.");
    } finally {
      setArrBusy(false);
    }
  }

  async function addAudioLink(link: {
    platform: AudioPlatform;
    url: string;
    label?: string | null;
    notes?: string | null;
    timestamps?: Array<{ label: string; timeSeconds: number }>;
  }) {
    if (!song) return;
    setAudioMsg(null);
    setNotice(null);
    setAudioBusy(true);
    try {
      const created = await api.songs.audioLinks.create(song.id, link);
      setAudioLinks((prev) => [created, ...prev]);
      setNotice("Audio link added.");
    } catch {
      setAudioMsg("Could not add audio link.");
    } finally {
      setAudioBusy(false);
    }
  }

  async function removeAudioLink(id: string) {
    if (!confirm("Remove this audio link?")) return;
    setAudioMsg(null);
    setNotice(null);
    setAudioBusy(true);
    try {
      await api.songs.audioLinks.remove(id);
      setAudioLinks((prev) => prev.filter((x) => x.id !== id));
      setNotice("Audio link removed.");
    } catch {
      setAudioMsg("Could not remove audio link.");
    } finally {
      setAudioBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this song?")) return;
    try {
      await api.songs.remove(id);
      router.push("/songs");
    } catch {
      setMsg("Could not delete.");
    }
  }

  if (msg && !state) return <p className="text-red-600">{msg}</p>;
  if (!state) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={`/songs/${id}`} className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            ← Song
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit song</h1>
        </div>
        <button type="button" className="text-sm text-red-600 hover:underline" onClick={remove}>
          Delete song
        </button>
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {notice && <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      <div className="no-print flex flex-wrap gap-2">
        {(["song", "arrangements", "audio"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "song" ? "Song" : t === "arrangements" ? "Arrangements" : "Audio links"}
          </button>
        ))}
      </div>

      {tab === "song" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-zinc-500">Edit the base song fields and chord sheets.</div>
            <button
              type="button"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              onClick={suggestTags}
              disabled={busy}
            >
              Suggest tags from lyrics
            </button>
          </div>
          <SongForm value={state} onChange={setState} onSubmit={submit} submitLabel={busy ? "Saving…" : "Save changes"} busy={busy} />
        </div>
      )}

      {tab === "arrangements" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Arrangements</div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Different keys/structures for different teams. (v1: create/edit/delete)
                </div>
              </div>
              <button
                type="button"
                disabled={arrBusy || !song}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                onClick={createArrangementFromSong}
              >
                {arrBusy ? "Working…" : "New arrangement from song"}
              </button>
            </div>
            {arrMsg && <p className="mt-3 text-sm text-red-600">{arrMsg}</p>}
          </div>

          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Your arrangements</div>
              <div className="mt-2 space-y-1">
                {arrangements.length === 0 && <div className="text-sm text-zinc-500">No arrangements yet.</div>}
                {arrangements.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedArrangementId === a.id
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    }`}
                    onClick={() => setSelectedArrangementId(a.id)}
                  >
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs opacity-80">
                      {a.key} · {a.bpm} BPM
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              {!selectedArrangement() ? (
                <p className="text-sm text-zinc-500">Select an arrangement to edit.</p>
              ) : (
                <ArrangementEditor
                  value={selectedArrangement()!}
                  busy={arrBusy}
                  onSave={saveArrangement}
                  onDelete={deleteArrangement}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "audio" && (
        <AudioLinksEditor
          links={audioLinks}
          busy={audioBusy}
          error={audioMsg}
          onAdd={addAudioLink}
          onRemove={removeAudioLink}
        />
      )}
    </div>
  );
}

function ArrangementEditor({
  value,
  busy,
  onSave,
  onDelete,
}: {
  value: SongArrangement;
  busy: boolean;
  onSave: (patch: any) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<{
    name: string;
    key: string;
    bpm: number;
    timeSignature: string;
    structure: string;
    lyrics: string;
    chordSheets: Array<{
      id?: string;
      arrangementId?: string;
      section: "verse" | "chorus" | "bridge" | "outro";
      instrumentType: "guitar" | "bass" | "keys";
      lyricsWithChords: string;
    }>;
  }>(() => ({
    name: value.name,
    key: value.key,
    bpm: value.bpm,
    timeSignature: value.timeSignature ?? "",
    structure: value.structure ?? "",
    lyrics: value.lyrics ?? "",
    chordSheets: (value.chordSheets as any[]) ?? [],
  }));

  useEffect(() => {
    setDraft({
      name: value.name,
      key: value.key,
      bpm: value.bpm,
      timeSignature: value.timeSignature ?? "",
      structure: value.structure ?? "",
      lyrics: value.lyrics ?? "",
      chordSheets: (value.chordSheets as any[]) ?? [],
    });
  }, [value.id, value.name, value.key, value.bpm, value.timeSignature, value.structure, value.lyrics, value.chordSheets]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">Edit arrangement</div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={() => onDelete()}
          >
            Delete
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-emerald-700"
            onClick={() =>
              onSave({
                name: draft.name,
                key: draft.key,
                bpm: Number(draft.bpm),
                timeSignature: draft.timeSignature.trim() || null,
                structure: draft.structure.trim() || null,
                lyrics: draft.lyrics.trim() || null,
                chordSheets: draft.chordSheets,
              })
            }
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium uppercase text-zinc-500">
          Name
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500">
          Key
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={draft.key}
            onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500">
          BPM
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={draft.bpm}
            onChange={(e) => setDraft((d) => ({ ...d, bpm: Number(e.target.value) }))}
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500">
          Time signature
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={draft.timeSignature}
            onChange={(e) => setDraft((d) => ({ ...d, timeSignature: e.target.value }))}
            placeholder="4/4"
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500 sm:col-span-2">
          Structure (optional)
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            rows={2}
            value={draft.structure}
            onChange={(e) => setDraft((d) => ({ ...d, structure: e.target.value }))}
            placeholder="Intro → Verse → Chorus → Verse → Bridge → Chorus"
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500 sm:col-span-2">
          Lyrics (optional)
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-950"
            rows={6}
            value={draft.lyrics}
            onChange={(e) => setDraft((d) => ({ ...d, lyrics: e.target.value }))}
          />
        </label>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Arrangement chord sheets</div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Same idea as song chord sheets, but specific to this arrangement.</p>
        <div className="mt-3 space-y-3">
          {draft.chordSheets.length === 0 && <p className="text-sm text-zinc-500">No blocks yet.</p>}
          {draft.chordSheets.map((c: any, i: number) => (
            <div key={c.id ?? i} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase text-zinc-500">
                  {c.section} · {c.instrumentType}
                </div>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => setDraft((d) => ({ ...d, chordSheets: d.chordSheets.filter((_: any, j: number) => j !== i) }))}
                >
                  Remove
                </button>
              </div>
              <textarea
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700"
                rows={4}
                value={c.lyricsWithChords}
                onChange={(e) =>
                  setDraft((d) => {
                    const next = [...d.chordSheets];
                    next[i] = { ...next[i], lyricsWithChords: e.target.value };
                    return { ...d, chordSheets: next };
                  })
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                chordSheets: [...d.chordSheets, { section: "verse", instrumentType: "guitar", lyricsWithChords: "" }],
              }))
            }
          >
            Add block
          </button>
        </div>
      </div>
    </div>
  );
}

function parseTimestampLines(text: string): Array<{ label: string; timeSeconds: number }> {
  // lines like: 1:23 intro riff
  const out: Array<{ label: string; timeSeconds: number }> = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const m = /^(\d{1,2}):(\d{2})\s+(.+)$/.exec(t);
    if (!m) continue;
    const mm = Number(m[1]);
    const ss = Number(m[2]);
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss > 59) continue;
    out.push({ timeSeconds: mm * 60 + ss, label: m[3].trim() });
  }
  return out;
}

function AudioLinksEditor({
  links,
  busy,
  error,
  onAdd,
  onRemove,
}: {
  links: AudioLink[];
  busy: boolean;
  error: string | null;
  onAdd: (link: { platform: AudioPlatform; url: string; label?: string | null; notes?: string | null; timestamps?: Array<{ label: string; timeSeconds: number }> }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [platform, setPlatform] = useState<AudioPlatform>("youtube");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [timestamps, setTimestamps] = useState("");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm font-semibold">Audio links</div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Attach YouTube/Spotify links plus rehearsal timestamps.</p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium uppercase text-zinc-500">
            Platform
            <select
              className="select-field mt-1 w-full px-3 py-2 pr-9"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as AudioPlatform)}
            >
              <option value="youtube">YouTube</option>
              <option value="spotify">Spotify</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-xs font-medium uppercase text-zinc-500">
            URL
            <input
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label className="text-xs font-medium uppercase text-zinc-500 sm:col-span-2">
            Label (optional)
            <input
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Official video / rehearsal recording"
            />
          </label>
          <label className="text-xs font-medium uppercase text-zinc-500 sm:col-span-2">
            Notes (optional)
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. watch chorus dynamics"
            />
          </label>
          <label className="text-xs font-medium uppercase text-zinc-500 sm:col-span-2">
            Timestamps (optional)
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
              rows={3}
              value={timestamps}
              onChange={(e) => setTimestamps(e.target.value)}
              placeholder={"1:23 intro riff\n2:10 chorus 1 starts"}
            />
          </label>
        </div>

        <button
          type="button"
          disabled={busy || !url.trim()}
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          onClick={async () => {
            await onAdd({
              platform,
              url: url.trim(),
              label: label.trim() || null,
              notes: notes.trim() || null,
              timestamps: timestamps.trim() ? parseTimestampLines(timestamps) : undefined,
            });
            setUrl("");
            setLabel("");
            setNotes("");
            setTimestamps("");
          }}
        >
          {busy ? "Adding…" : "Add link"}
        </button>
      </div>

      <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {links.length === 0 && <div className="p-4 text-sm text-zinc-500">No audio links yet.</div>}
        {links.map((l) => (
          <div key={l.id} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {l.label || l.platform.toUpperCase()}{" "}
                <a className="underline" href={l.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              </div>
              {l.notes && <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{l.notes}</div>}
            </div>
            <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => onRemove(l.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
