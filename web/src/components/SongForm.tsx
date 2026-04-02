"use client";

import { useState } from "react";
import type { AudioPlatform, ChordSection, InstrumentType, Song } from "@/lib/types";

const SECTIONS: ChordSection[] = ["verse", "chorus", "bridge", "outro"];
const INSTRUMENTS: InstrumentType[] = ["guitar", "bass", "keys", "drums", "vocals"];

export type SongFormState = {
  title: string;
  artist: string;
  key: string;
  bpm: number;
  timeSignature: string;
  message: string;
  lyrics: string;
  tags: string;
  chordSheets: { section: ChordSection; instrumentType: InstrumentType; lyricsWithChords: string }[];
  audioLinks: { platform: AudioPlatform; url: string; label: string; notes: string }[];
};

export function songToFormState(s: Song): SongFormState {
  return {
    title: s.title,
    artist: s.artist,
    key: s.key,
    bpm: s.bpm,
    timeSignature: s.timeSignature ?? "",
    message: s.message ?? "",
    lyrics: s.lyrics ?? "",
    tags: s.tags.join(", "),
    chordSheets:
      s.chordSheets?.map((c) => ({
        section: c.section,
        instrumentType: c.instrumentType,
        lyricsWithChords: c.lyricsWithChords,
      })) ?? [],
    audioLinks:
      s.audioLinks?.map((a) => ({
        platform: a.platform,
        url: a.url,
        label: a.label ?? "",
        notes: a.notes ?? "",
      })) ?? [],
  };
}

export function emptySongForm(): SongFormState {
  return {
    title: "",
    artist: "",
    key: "C",
    bpm: 72,
    timeSignature: "",
    message: "",
    lyrics: "",
    tags: "",
    chordSheets: [],
    audioLinks: [],
  };
}

export function SongForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  busy,
}: {
  value: SongFormState;
  onChange: (v: SongFormState) => void;
  onSubmit: () => void;
  submitLabel: string;
  busy?: boolean;
}) {
  const [sheetSection, setSheetSection] = useState<ChordSection>("verse");
  const [sheetInstrument, setSheetInstrument] = useState<InstrumentType>("guitar");

  function patch(p: Partial<SongFormState>) {
    onChange({ ...value, ...p });
  }

  function addSheet() {
    patch({
      chordSheets: [
        ...value.chordSheets,
        { section: sheetSection, instrumentType: sheetInstrument, lyricsWithChords: "" },
      ],
    });
  }

  function updateSheet(i: number, lyricsWithChords: string) {
    const next = [...value.chordSheets];
    next[i] = { ...next[i], lyricsWithChords };
    patch({ chordSheets: next });
  }

  function removeSheet(i: number) {
    patch({ chordSheets: value.chordSheets.filter((_, j) => j !== i) });
  }

  function addAudioLink() {
    patch({
      audioLinks: [...value.audioLinks, { platform: "youtube", url: "", label: "", notes: "" }],
    });
  }

  function updateAudioLink(i: number, p: Partial<SongFormState["audioLinks"][number]>) {
    const next = [...value.audioLinks];
    next[i] = { ...next[i], ...p };
    patch({ audioLinks: next });
  }

  function removeAudioLink(i: number) {
    patch({ audioLinks: value.audioLinks.filter((_, j) => j !== i) });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium uppercase text-zinc-500">
          Title
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={value.title}
            onChange={(e) => patch({ title: e.target.value })}
            required
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500">
          Artist / writer
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={value.artist}
            onChange={(e) => patch({ artist: e.target.value })}
            required
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500">
          Key
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={value.key}
            onChange={(e) => patch({ key: e.target.value })}
            required
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500">
          BPM
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={value.bpm}
            onChange={(e) => patch({ bpm: Number(e.target.value) })}
            min={20}
            max={300}
            required
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500">
          Time signature (optional)
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={value.timeSignature}
            onChange={(e) => patch({ timeSignature: e.target.value })}
            placeholder="4/4"
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500 sm:col-span-2">
          Tags (comma-separated)
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={value.tags}
            onChange={(e) => patch({ tags: e.target.value })}
            placeholder="praise, worship"
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500 sm:col-span-2">
          Message / theme
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            rows={2}
            value={value.message}
            onChange={(e) => patch({ message: e.target.value })}
          />
        </label>
        <label className="text-xs font-medium uppercase text-zinc-500 sm:col-span-2">
          Lyrics
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-950"
            rows={8}
            value={value.lyrics}
            onChange={(e) => patch({ lyrics: e.target.value })}
            placeholder="Full song lyrics (optional). Use [C] [G] style chords inline if you want them to transpose with the chart."
          />
        </label>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Audio links</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Add multiple versions (YouTube, Spotify, etc.).</p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-white dark:text-zinc-900"
            onClick={addAudioLink}
          >
            Add link
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {value.audioLinks.length === 0 && <p className="text-sm text-zinc-500">No audio links yet.</p>}
          {value.audioLinks.map((a, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="select-field px-2 py-1.5 pr-8"
                    value={a.platform}
                    onChange={(e) => updateAudioLink(i, { platform: e.target.value as AudioPlatform })}
                  >
                    <option value="youtube">youtube</option>
                    <option value="spotify">spotify</option>
                    <option value="other">other</option>
                  </select>
                  <div className="text-xs font-semibold uppercase text-zinc-500">Link {i + 1}</div>
                </div>
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeAudioLink(i)}>
                  Remove
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium uppercase text-zinc-500 sm:col-span-2">
                  URL
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    value={a.url}
                    onChange={(e) => updateAudioLink(i, { url: e.target.value })}
                    placeholder="https://…"
                  />
                </label>
                <label className="text-xs font-medium uppercase text-zinc-500">
                  Label (optional)
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    value={a.label}
                    onChange={(e) => updateAudioLink(i, { label: e.target.value })}
                    placeholder="Studio version / Live / Click track…"
                  />
                </label>
                <label className="text-xs font-medium uppercase text-zinc-500">
                  Notes (optional)
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    value={a.notes}
                    onChange={(e) => updateAudioLink(i, { notes: e.target.value })}
                    placeholder="e.g. starts at 0:22"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Chord sheets</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Add one block per section and instrument. Use [C] [G] style chords inline with lyrics.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="select-field px-2 py-1.5 pr-8"
            value={sheetSection}
            onChange={(e) => setSheetSection(e.target.value as ChordSection)}
          >
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="select-field px-2 py-1.5 pr-8"
            value={sheetInstrument}
            onChange={(e) => setSheetInstrument(e.target.value as InstrumentType)}
          >
            {INSTRUMENTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="button" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-white dark:text-zinc-900" onClick={addSheet}>
            Add block
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {value.chordSheets.map((c, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase text-zinc-500">
                  {c.section} · {c.instrumentType}
                </div>
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeSheet(i)}>
                  Remove
                </button>
              </div>
              <textarea
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700"
                rows={5}
                value={c.lyricsWithChords}
                onChange={(e) => updateSheet(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onSubmit}
        className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}

export function formStateToPayload(state: SongFormState) {
  return {
    title: state.title,
    artist: state.artist,
    key: state.key,
    bpm: state.bpm,
    timeSignature: state.timeSignature.trim() || null,
    message: state.message.trim() || null,
    lyrics: state.lyrics.trim() || null,
    tags: state.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    chordSheets: state.chordSheets.filter((c) => c.lyricsWithChords.trim()),
    audioLinks: state.audioLinks
      .map((a) => ({
        platform: a.platform,
        url: a.url.trim(),
        label: a.label.trim() || null,
        notes: a.notes.trim() || null,
      }))
      .filter((a) => a.url),
  };
}
