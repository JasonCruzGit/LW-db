"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type InstrumentPreset = "guitar" | "bass" | "drums";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToName(midi: number): { name: string; octave: number } {
  const m = Math.round(midi);
  const idx = ((m % 12) + 12) % 12;
  const octave = Math.floor(m / 12) - 1;
  return { name: NOTE_NAMES[idx], octave };
}

function centsOff(freq: number, midi: number): number {
  const target = midiToFreq(Math.round(midi));
  return 1200 * Math.log2(freq / target);
}

// Autocorrelation pitch detect (time-domain). Returns fundamental Hz or null.
function detectPitchACF(buf: Float32Array, sampleRate: number): number | null {
  // Remove DC offset
  let mean = 0;
  for (let i = 0; i < buf.length; i++) mean += buf[i];
  mean /= buf.length;
  for (let i = 0; i < buf.length; i++) buf[i] -= mean;

  // RMS gate to avoid noise
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return null;

  const minHz = 45; // low E1 ~ 41 Hz; keep slightly higher for stability
  const maxHz = 1200;
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.floor(sampleRate / minHz);

  let bestLag = -1;
  let best = 0;

  // Basic ACF
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < buf.length - lag; i++) sum += buf[i] * buf[i + lag];
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }

  if (bestLag <= 0) return null;

  // Parabolic interpolation around bestLag to refine.
  const lag = bestLag;
  const corrAt = (l: number) => {
    let s = 0;
    for (let i = 0; i < buf.length - l; i++) s += buf[i] * buf[i + l];
    return s;
  };
  const y1 = corrAt(Math.max(minLag, lag - 1));
  const y2 = best;
  const y3 = corrAt(Math.min(maxLag, lag + 1));
  const denom = (y1 - 2 * y2 + y3);
  const shift = denom === 0 ? 0 : 0.5 * (y1 - y3) / denom;
  const refinedLag = lag + shift;

  const hz = sampleRate / refinedLag;
  if (!Number.isFinite(hz) || hz < minHz || hz > maxHz) return null;
  return hz;
}

export function Tuner({ defaultPreset = "guitar" }: { defaultPreset?: InstrumentPreset }) {
  const [preset, setPreset] = useState<InstrumentPreset>(defaultPreset);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hz, setHz] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [refHz, setRefHz] = useState<number>(440);
  const [refOn, setRefOn] = useState(false);

  const acRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timeBufRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  const meter = useMemo(() => {
    if (!hz) return null;
    const midi = freqToMidi(hz);
    const cents = centsOff(hz, midi);
    const name = midiToName(midi);
    return {
      midi,
      cents: clamp(cents, -50, 50),
      displayCents: Math.round(cents),
      note: `${name.name}${name.octave}`,
      targetHz: midiToFreq(Math.round(midi)),
    };
  }, [hz]);

  async function ensureAC(): Promise<AudioContext> {
    if (acRef.current) return acRef.current;
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    acRef.current = ac;
    return ac;
  }

  async function startMic() {
    setErr(null);
    try {
      const ac = await ensureAC();
      if (ac.state === "suspended") await ac.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      micStreamRef.current = stream;

      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.2;
      src.connect(analyser);
      analyserRef.current = analyser;
      timeBufRef.current = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;

      setRunning(true);
    } catch (e: any) {
      setErr(typeof e?.message === "string" ? e.message : "Could not access microphone.");
      setRunning(false);
    }
  }

  function stopMic() {
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    timeBufRef.current = null;
    if (micStreamRef.current) {
      for (const t of micStreamRef.current.getTracks()) t.stop();
      micStreamRef.current = null;
    }
    setRunning(false);
    setConfidence(0);
    setHz(null);
  }

  function stopRefTone() {
    const osc = oscRef.current;
    if (osc) {
      try {
        osc.stop(0);
        osc.disconnect();
      } catch {
        /* ignore */
      }
    }
    oscRef.current = null;
    setRefOn(false);
  }

  async function startRefTone() {
    setErr(null);
    try {
      const ac = await ensureAC();
      if (ac.state === "suspended") await ac.resume();
      stopRefTone();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = clamp(refHz, 30, 2000);
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      oscRef.current = osc;
      setRefOn(true);
    } catch (e: any) {
      setErr(typeof e?.message === "string" ? e.message : "Could not start reference tone.");
      setRefOn(false);
    }
  }

  useEffect(() => {
    if (!running) return;
    const ac = acRef.current;
    const analyser = analyserRef.current;
    const buf = timeBufRef.current;
    if (!ac || !analyser || !buf) return;

    const loop = () => {
      analyser.getFloatTimeDomainData(buf);
      const pitch = detectPitchACF(buf, ac.sampleRate);
      if (!pitch) {
        setHz(null);
        setConfidence((c) => Math.max(0, c - 0.06));
      } else {
        setHz(pitch);
        setConfidence((c) => Math.min(1, c + 0.12));
      }
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running]);

  useEffect(() => {
    return () => {
      stopRefTone();
      stopMic();
      try {
        acRef.current?.close();
      } catch {
        /* ignore */
      }
      acRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title =
    preset === "guitar" ? "Tuner — Guitar" : preset === "bass" ? "Tuner — Bass" : "Tuner — Drums";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Use your mic to detect pitch. Drums mode is best with a reference tone (match the ring).
          </div>
        </div>
        <div className="flex gap-2">
          {running ? (
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
              onClick={stopMic}
            >
              Stop mic
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
              onClick={startMic}
            >
              Start mic
            </button>
          )}
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Instrument</div>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as InstrumentPreset)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="guitar">Guitar</option>
            <option value="bass">Bass guitar</option>
            <option value="drums">Drums</option>
          </select>
        </label>

        <label className="block">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reference tone (Hz)</div>
          <input
            type="number"
            min={30}
            max={2000}
            value={refHz}
            onChange={(e) => setRefHz(clamp(Number(e.target.value || 0), 30, 2000))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <div className="flex items-end gap-2">
          {refOn ? (
            <button
              type="button"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-600"
              onClick={stopRefTone}
            >
              Stop tone
            </button>
          ) : (
            <button
              type="button"
              className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
              onClick={startRefTone}
            >
              Play tone
            </button>
          )}
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-600"
            onClick={() => setRefHz(440)}
            title="Reset to A4 440Hz"
          >
            A440
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Detected</div>
          <div className="text-xs text-zinc-500">Confidence: {Math.round(confidence * 100)}%</div>
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-6">
          <div>
            <div className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {meter ? meter.note : "—"}
            </div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {hz ? `${hz.toFixed(1)} Hz` : "No signal"}
              {meter ? ` · target ${meter.targetHz.toFixed(1)} Hz` : ""}
            </div>
          </div>

          <div className="min-w-[220px] flex-1">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>-50¢</span>
              <span>0</span>
              <span>+50¢</span>
            </div>
            <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div className="absolute inset-0 opacity-40" />
              <div className="absolute left-1/2 top-0 h-3 w-0.5 -translate-x-1/2 bg-zinc-500/70" />
              <div
                className="absolute top-0 h-3 w-1.5 rounded-full bg-emerald-600 shadow"
                style={{
                  left: meter ? `calc(50% + ${meter.cents}% )` : "50%",
                  transform: "translateX(-50%)",
                  opacity: meter ? 1 : 0.25,
                }}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              {meter ? `${meter.displayCents} cents` : "—"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

