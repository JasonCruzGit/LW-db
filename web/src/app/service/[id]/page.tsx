"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChordLines } from "@/components/ChordLines";
import { LyricsOnly } from "@/components/LyricsOnly";
import { Protected } from "@/components/Protected";
import { CommentsPanel } from "@/components/CommentsPanel";
import { InstrumentNotesPanel } from "@/components/InstrumentNotesPanel";
import { ClickTools } from "@/components/ClickTools";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { showsChordCharts } from "@/lib/roles";
import { semitoneDeltaBetweenKeys, transposeChordSymbol, transposeLyricsWithChords } from "@/lib/chords";
import type { ChordSection, InstrumentType, Lineup } from "@/lib/types";

const SECTION_ORDER: ChordSection[] = ["verse", "chorus", "bridge", "outro"];

export default function ServicePage() {
  return (
    <Protected>
      <ServiceInner />
    </Protected>
  );
}

function ServiceInner() {
  const params = useParams();
  const id = String(params.id);
  const { user } = useAuth();
  /** Service view: song leaders see lyrics only (like vocalists); musicians see charts; admins see both. */
  const serviceCharts = showsChordCharts(user?.role) && user?.role !== "song_leader";
  const canEditNotes = user?.role === "admin" || user?.role === "song_leader" || user?.role === "musician" || user?.role === "singer";
  /** Musicians see chord charts only — not the full song lyrics block. */
  const musicianChartsOnly = user?.role === "musician";
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [instrument, setInstrument] = useState<InstrumentType>("guitar");
  const [semi, setSemi] = useState(0);
  const [songSemi, setSongSemi] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const l = await api.lineups.get(id);
        if (!cancelled) {
          setLineup(l);
          setSongSemi((prev) => {
            // Ensure we only keep per-song transposes that still exist.
            const next: Record<string, number> = {};
            for (const ls of l.songs) next[ls.id] = prev[ls.id] ?? 0;
            return next;
          });
        }
      } catch {
        if (!cancelled) setErr("Lineup not found.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const title = useMemo(() => {
    if (!lineup) return "";
    return new Date(lineup.serviceDate).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [lineup]);

  if (err) return <p className="text-red-600">{err}</p>;
  if (!lineup) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="no-print flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sunday service</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{title}</p>
          {lineup.songLeaderName && (
            <p className="mt-2 text-base font-medium text-zinc-800 dark:text-zinc-200">
              Song leader: {lineup.songLeaderName}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            onClick={() => window.print()}
          >
            Print / PDF
          </button>
          <Link href={`/lineups/${lineup.id}`} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600">
            Lineup details
          </Link>
        </div>
      </div>

      {!serviceCharts && (
        <p className="no-print rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
          {user?.role === "song_leader"
            ? "Song leader view — lyrics only. Musicians use chord charts on their account."
            : "Vocal account — lyrics only for this service."}
        </p>
      )}

      {lineup.changeNote?.trim() && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Service announcement</div>
          <div className="mt-1 whitespace-pre-wrap">{lineup.changeNote}</div>
        </div>
      )}

      {serviceCharts && (
        <div className="no-print flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Stage transpose</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Adds to each song’s service key.</div>
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

      {serviceCharts && (
        <div className="no-print flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
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
      )}

      <ol className="space-y-12">
        {lineup.songs.map((ls, idx) => (
          <li key={ls.id} className="break-inside-avoid">
            <ServiceSongBlock
              index={idx + 1}
              selectedKey={ls.selectedKey}
              notes={ls.notes}
              song={ls.song}
              instrument={instrument}
              extraSemi={semi}
              songExtraSemi={songSemi[ls.id] ?? 0}
              onSongExtraSemiChange={(next) =>
                setSongSemi((m) => ({
                  ...m,
                  [ls.id]: next,
                }))
              }
              canEditNotes={!!canEditNotes}
              lyricsOnly={!serviceCharts}
              hideLyrics={musicianChartsOnly}
            />
          </li>
        ))}
      </ol>

      <CommentsPanel entityType="lineup" entityId={lineup.id} />
    </div>
  );
}

function ServiceSongBlock({
  index,
  selectedKey,
  notes,
  song,
  instrument,
  extraSemi,
  songExtraSemi,
  onSongExtraSemiChange,
  canEditNotes,
  lyricsOnly,
  hideLyrics,
}: {
  index: number;
  selectedKey: string;
  notes: string | null;
  song: Lineup["songs"][number]["song"];
  instrument: InstrumentType;
  extraSemi: number;
  songExtraSemi: number;
  onSongExtraSemiChange: (semi: number) => void;
  canEditNotes: boolean;
  lyricsOnly: boolean;
  /** When true (musicians), show chord charts only — omit full lyrics. */
  hideLyrics: boolean;
}) {
  const baseSemi = semitoneDeltaBetweenKeys(song.key, selectedKey);
  const totalSemi = baseSemi + extraSemi + songExtraSemi;
  const displayKey = lyricsOnly ? selectedKey : transposeChordSymbol(selectedKey, extraSemi + songExtraSemi);

  const sheets = (song.chordSheets || []).filter((c) => c.instrumentType === instrument);
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

  const audio = song.audioLinks?.[0];

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <header className="border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div className="text-sm font-medium text-zinc-500">Song {index}</div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{song.title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-base sm:text-lg">
          <span className="rounded-md bg-zinc-100 px-3 py-1 font-mono dark:bg-zinc-800">Key: {displayKey}</span>
          <span className="rounded-md bg-zinc-100 px-3 py-1 font-mono dark:bg-zinc-800">{song.bpm} BPM</span>
          {audio?.url && (
            <a
              href={audio.url}
              target="_blank"
              rel="noreferrer"
              className="no-print inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              title={audio.label || audio.url}
            >
              {audio.platform === "youtube" ? "YouTube" : audio.platform === "spotify" ? "Spotify" : "Audio"}
            </a>
          )}
          {!lyricsOnly && (
            <div className="no-print flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Song transpose</span>
              <div className="flex items-center overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-600">
                <button
                  type="button"
                  className="px-3 py-1 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => onSongExtraSemiChange(songExtraSemi - 1)}
                  aria-label="Transpose this song down one semitone"
                >
                  −1
                </button>
                <div className="min-w-10 border-x border-zinc-300 px-2 py-1 text-center text-sm font-medium tabular-nums dark:border-zinc-600">
                  {songExtraSemi}
                </div>
                <button
                  type="button"
                  className="px-3 py-1 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => onSongExtraSemiChange(songExtraSemi + 1)}
                  aria-label="Transpose this song up one semitone"
                >
                  +1
                </button>
              </div>
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                onClick={() => onSongExtraSemiChange(0)}
              >
                Reset
              </button>
            </div>
          )}
        </div>
        {notes && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-base text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            {notes}
          </p>
        )}
      </header>
      <div className="mt-4 no-print">
        <InstrumentNotesPanel
          songId={song.id}
          instrument={instrument}
          canEdit={canEditNotes}
          compact
        />
      </div>
      {!lyricsOnly && (
        <div className="mt-4 no-print">
          <ClickTools songId={song.id} initialBpm={song.bpm} compact />
        </div>
      )}
      {lyricsOnly && (
        <section className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Lyrics</h3>
          {song.lyrics?.trim() ? (
            <LyricsOnly text={song.lyrics} />
          ) : (
            <p className="text-zinc-500">No lyrics for this song.</p>
          )}
        </section>
      )}
      {!lyricsOnly && !hideLyrics && song.lyrics?.trim() && (
        <section className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Lyrics</h3>
          <ChordLines
            text={transposeLyricsWithChords(song.lyrics, totalSemi)}
            chordClassName="text-lg sm:text-2xl md:text-3xl"
            className="text-lg sm:text-xl md:text-2xl"
          />
        </section>
      )}
      {!lyricsOnly && (
        <div className="mt-6 space-y-8">
          {grouped.length === 0 && (
            <p className="text-zinc-500">No {instrument} chart — check another tab.</p>
          )}
          {grouped.map(({ section, lines }) => (
            <section key={section}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{section}</h3>
              <div className="space-y-4">
                {lines.map((line) => (
                  <ChordLines
                    key={line.id}
                    text={transposeLyricsWithChords(line.lyricsWithChords, totalSemi)}
                    chordClassName="text-lg sm:text-2xl md:text-3xl"
                    className="text-lg sm:text-xl md:text-2xl"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
