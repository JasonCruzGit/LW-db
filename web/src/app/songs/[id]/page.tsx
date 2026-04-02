"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChordLines } from "@/components/ChordLines";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { LyricsOnly } from "@/components/LyricsOnly";
import { CommentsPanel } from "@/components/CommentsPanel";
import { InstrumentNotesPanel } from "@/components/InstrumentNotesPanel";
import { ClickTools } from "@/components/ClickTools";
import { transposeChordSymbol, transposeLyricsWithChords } from "@/lib/chords";
import { showsChordCharts } from "@/lib/roles";
import type { ChordSection, InstrumentType, Song } from "@/lib/types";

const SECTION_ORDER: ChordSection[] = ["verse", "chorus", "bridge", "outro"];

export default function SongDetailPage() {
  return (
    <Protected>
      <SongDetailInner />
    </Protected>
  );
}

function SongDetailInner() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const search = useSearchParams();
  const { user } = useAuth();
  const charts = showsChordCharts(user?.role);
  const canEditNotes = user?.role === "admin" || user?.role === "song_leader" || user?.role === "musician" || user?.role === "singer";
  const [song, setSong] = useState<Song | null>(null);
  const [semi, setSemi] = useState(0);
  const [instrument, setInstrument] = useState<InstrumentType>("guitar");
  const [fav, setFav] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.songs.get(id);
        if (!cancelled) setSong(s);
      } catch {
        if (!cancelled) setErr("Song not found.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const created = search.get("created");
    if (created !== "1") return;
    setToast("Song saved.");
    const t = window.setTimeout(() => setToast(null), 1800);
    // Remove the query param so it doesn't show again on refresh.
    router.replace(`/songs/${id}`);
    return () => window.clearTimeout(t);
  }, [search, router, id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.favorites.list();
        if (!cancelled) setFav(list.some((s) => s.id === id));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const displayKey = useMemo(() => {
    if (!song) return "";
    return transposeChordSymbol(song.key, semi);
  }, [song, semi]);

  const sheets = useMemo(() => {
    if (!song?.chordSheets) return [];
    return song.chordSheets.filter((c) => c.instrumentType === instrument);
  }, [song, instrument]);

  const grouped = useMemo(() => {
    const map = new Map<ChordSection, typeof sheets>();
    for (const s of sheets) {
      if (!map.has(s.section)) map.set(s.section, []);
      map.get(s.section)!.push(s);
    }
    return SECTION_ORDER.filter((sec) => map.has(sec)).map((sec) => ({
      section: sec,
      lines: map.get(sec)!,
    }));
  }, [sheets]);

  async function toggleFavorite() {
    try {
      if (fav) {
        await api.favorites.remove(id);
        setFav(false);
      } else {
        await api.favorites.add(id);
        setFav(true);
      }
    } catch {
      /* ignore */
    }
  }

  if (err) {
    return <p className="text-red-600">{err}</p>;
  }

  if (!song) {
    return <p className="text-zinc-500">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div className="sticky top-3 z-30">
          <div className="mx-auto w-fit rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/songs" className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            ← Songs
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{song.title}</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{song.artist}</p>
          {song.message && <p className="mt-3 max-w-2xl text-zinc-700 dark:text-zinc-300">{song.message}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">Original key: {song.key}</span>
            <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">BPM: {song.bpm}</span>
            {song.timeSignature && (
              <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">Time: {song.timeSignature}</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {song.tags.map((t) => (
              <span key={t} className="rounded-full border border-zinc-200 px-3 py-0.5 text-xs dark:border-zinc-700">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            data-tour="song-favorite"
            onClick={toggleFavorite}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
          >
            {fav ? "★ Saved" : "☆ Favorite"}
          </button>
          {user?.role === "admin" && (
            <Link href={`/admin/songs/${song.id}`} className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400">
              Edit song
            </Link>
          )}
        </div>
      </div>

      {!charts && (
        <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
          Vocal account — lyrics only. Chord charts are hidden.
        </p>
      )}

      {charts && (
        <div
          data-tour="song-transpose"
          className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Transpose</div>
            <div className="mt-1 text-lg font-semibold">Current key: {displayKey}</div>
            <div className="text-sm text-zinc-500">Adjusts guitar, bass, and keys together.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
              onClick={() => setSemi((s) => s - 1)}
            >
              −1
            </button>
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
              onClick={() => setSemi((s) => s + 1)}
            >
              +1
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              onClick={() => setSemi(0)}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {song.audioLinks && song.audioLinks.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Audio links</h2>
          <div className="mt-4 space-y-3">
            {song.audioLinks.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-zinc-200 p-3 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {(a.label && a.label.trim()) || a.url}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{a.platform}</div>
                </div>
                {a.notes?.trim() && <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{a.notes}</div>}
                <div className="mt-2 text-xs text-zinc-500 break-all">{a.url}</div>
              </a>
            ))}
          </div>
        </section>
      )}

      <InstrumentNotesPanel songId={song.id} instrument={instrument} canEdit={!!canEditNotes} />

      {charts && <ClickTools songId={song.id} initialBpm={song.bpm} />}

      {charts && song.lyrics?.trim() && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Lyrics</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Transpose applies to [chord] markers, chord-only rows, and rows that start with one or more section labels
            (e.g. INTRO VERSE 1) followed only by chords and bar marks.
          </p>
          <div className="mt-4">
            <ChordLines
              text={transposeLyricsWithChords(song.lyrics, semi)}
              chordClassName="text-lg sm:text-xl"
              className="text-base sm:text-lg"
            />
          </div>
        </section>
      )}

      {!charts && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Lyrics</h2>
          {song.lyrics?.trim() ? (
            <LyricsOnly text={song.lyrics} className="mt-4" />
          ) : (
            <p className="mt-3 text-zinc-500">No lyrics for this song yet.</p>
          )}
        </section>
      )}

      {charts && (
        <>
          <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
            {(["guitar", "bass", "keys", "drums", "vocals"] as InstrumentType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${
                  instrument === t
                    ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                    : "border-transparent text-zinc-500"
                }`}
                onClick={() => setInstrument(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-8">
            {grouped.length === 0 && (
              <p className="text-zinc-500">No chart for this instrument — try another tab or ask an admin to add parts.</p>
            )}
            {grouped.map(({ section, lines }) => (
              <section key={section}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{section}</h2>
                <div className="space-y-4">
                  {lines.map((line) => (
                    <ChordLines
                      key={line.id}
                      text={transposeLyricsWithChords(line.lyricsWithChords, semi)}
                      chordClassName="text-lg sm:text-xl"
                      className="text-base sm:text-lg"
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      <CommentsPanel entityType="song" entityId={song.id} />
    </div>
  );
}
