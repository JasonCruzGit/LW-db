"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function ClickTools({
  songId,
  initialBpm,
  compact,
}: {
  songId: string;
  initialBpm: number;
  compact?: boolean;
}) {
  const storageKey = `wts_song_click_${songId}`;
  const [bpm, setBpm] = useState<number>(() => initialBpm);
  const [timeSig, setTimeSig] = useState<string>("4/4");
  const [countInBars, setCountInBars] = useState<number>(1);
  const [countInNote, setCountInNote] = useState<string>("");
  const [running, setRunning] = useState(false);
  const tapsRef = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const activeOscRef = useRef<Set<OscillatorNode>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { bpm?: number; timeSig?: string; countInBars?: number; countInNote?: string };
      if (typeof parsed.bpm === "number") setBpm(clamp(Math.round(parsed.bpm), 20, 300));
      if (typeof parsed.timeSig === "string" && /^\d{1,2}\/\d{1,2}$/.test(parsed.timeSig)) setTimeSig(parsed.timeSig);
      if (typeof parsed.countInBars === "number") setCountInBars(clamp(Math.round(parsed.countInBars), 0, 8));
      if (typeof parsed.countInNote === "string") setCountInNote(parsed.countInNote);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ bpm, timeSig, countInBars, countInNote }));
    } catch {
      /* ignore */
    }
  }, [storageKey, bpm, timeSig, countInBars, countInNote]);

  const ms = useMemo(() => Math.round((60_000 / clamp(bpm, 20, 300)) * 1), [bpm]);

  function beep(ac: AudioContext, t: number, freq: number, gain = 0.12) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ac.destination);
    activeOscRef.current.add(o);
    o.onended = () => {
      activeOscRef.current.delete(o);
      try {
        o.disconnect();
        g.disconnect();
      } catch {
        /* ignore */
      }
    };
    o.start(t);
    o.stop(t + 0.03);
  }

  async function ensureAudio(): Promise<AudioContext> {
    if (audioRef.current) return audioRef.current;
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioRef.current = ac;
    return ac;
  }

  function stop() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    // Cancel any beeps already scheduled in the AudioContext timeline.
    for (const o of activeOscRef.current) {
      try {
        o.onended = null;
        o.stop(0);
      } catch {
        /* ignore */
      }
      try {
        o.disconnect();
      } catch {
        /* ignore */
      }
    }
    activeOscRef.current.clear();
    setRunning(false);
  }

  async function start() {
    stop();
    const ac = await ensureAudio();
    if (ac.state === "suspended") await ac.resume();

    const m = /^(\d{1,2})\/(\d{1,2})$/.exec(timeSig.trim());
    const beatsPerBar = clamp(m ? Number(m[1]) : 4, 1, 12);
    const totalCountInBeats = countInBars * beatsPerBar;
    let beat = 0;

    const tick = () => {
      const now = ac.currentTime;
      const isDownbeat = beat % beatsPerBar === 0;
      beep(ac, now, isDownbeat ? 1400 : 980, isDownbeat ? 0.14 : 0.11);
      beat += 1;
      timerRef.current = window.setTimeout(tick, ms);
    };

    // Count-in first (optional), then continuous click (same tick)
    setRunning(true);
    if (totalCountInBeats > 0) {
      for (let i = 0; i < totalCountInBeats; i++) {
        const now = ac.currentTime + i * (ms / 1000);
        const isDownbeat = i % beatsPerBar === 0;
        beep(ac, now, isDownbeat ? 1400 : 980, isDownbeat ? 0.14 : 0.11);
      }
      timerRef.current = window.setTimeout(() => {
        beat = totalCountInBeats;
        tick();
      }, totalCountInBeats * ms);
      return;
    }
    tick();
  }

  function tap() {
    const now = Date.now();
    const taps = tapsRef.current;
    taps.push(now);
    while (taps.length > 8) taps.shift();
    if (taps.length < 2) return;
    const diffs: number[] = [];
    for (let i = 1; i < taps.length; i++) diffs.push(taps[i] - taps[i - 1]);
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const nextBpm = clamp(Math.round(60_000 / avg), 20, 300);
    setBpm(nextBpm);
  }

  useEffect(() => () => stop(), []);

  return (
    <section
      className={
        compact
          ? "rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          : "rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Click / tempo</div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Tap tempo, set BPM, and run a simple metronome.</div>
        </div>
        <div className="flex gap-2">
          {running ? (
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
              onClick={stop}
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
              onClick={start}
            >
              Start
            </button>
          )}
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
            onClick={tap}
          >
            Tap
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">BPM</div>
          <input
            type="number"
            min={20}
            max={300}
            value={bpm}
            onChange={(e) => setBpm(clamp(Number(e.target.value || 0), 20, 300))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Time signature</div>
          <select
            value={timeSig}
            onChange={(e) => setTimeSig(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="4/4">4/4</option>
            <option value="3/4">3/4</option>
            <option value="2/4">2/4</option>
            <option value="6/8">6/8</option>
            <option value="5/4">5/4</option>
            <option value="7/8">7/8</option>
          </select>
        </label>
        <label className="block">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Count-in (bars)</div>
          <input
            type="number"
            min={0}
            max={8}
            value={countInBars}
            onChange={(e) => setCountInBars(clamp(Number(e.target.value || 0), 0, 8))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>
      <div className="mt-3">
        <label className="block">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Count-in note</div>
          <input
            value={countInNote}
            onChange={(e) => setCountInNote(e.target.value)}
            placeholder="e.g. 2 clicks then in"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>
      {countInNote.trim() && <p className="mt-2 text-xs text-zinc-500">Note: {countInNote}</p>}
    </section>
  );
}

