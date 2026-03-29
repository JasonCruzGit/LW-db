import { Chord, Note } from "tonal";

/** Transpose a chord symbol like C#m7, F/A, or Asus4 by semitones. */
export function transposeChordSymbol(chord: string, semitones: number): string {
  const t = chord.trim();
  if (!t || semitones === 0) return chord;
  const slash = t.indexOf("/");
  if (slash !== -1) {
    const left = t.slice(0, slash).trim();
    const bass = t.slice(slash + 1).trim();
    if (!left || !bass) return chord;
    return `${transposeChordSymbol(left, semitones)}/${transposeChordSymbol(bass, semitones)}`;
  }
  const m = /^([A-G][#b]?)(.*)$/.exec(t);
  if (!m) return chord;
  const [, root, rest] = m;
  try {
    const base = Note.midi(`${root}4`);
    if (base == null) return chord;
    const next = Note.fromMidi(base + semitones);
    if (!next) return chord;
    const rootOnly = next.replace(/\d/g, "");
    return `${rootOnly}${rest}`;
  } catch {
    return chord;
  }
}

/** Remove [chord] markers for vocalist-only views. */
export function stripChordMarkers(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, "");
}

function stripPunctuation(token: string): string {
  return token.replace(/^[,;.:()]+|[,;.:()]+$/g, "");
}

/** True if tonal recognizes the token as a chord (slash chords supported). */
export function isChordToken(token: string): boolean {
  const clean = stripPunctuation(token.trim());
  if (!clean || clean === "|") return false;
  const c = Chord.get(clean);
  return Boolean(c && !c.empty);
}

/**
 * Line contains only chord symbols (and |), e.g. lead-sheet rows above lyrics.
 * Skips lines with [brackets] so ChordPro-style lines are handled elsewhere.
 */
export function isChordOnlyLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.includes("[") || t.includes("]")) return false;
  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  for (const tok of tokens) {
    if (tok === "|") continue;
    const clean = stripPunctuation(tok);
    if (!clean) continue;
    if (!isChordToken(clean)) return false;
  }
  return true;
}

/** e.g. INTRO, VERSE 1, CHORUS 2 — must be followed by chord row (not lyrics). */
const LEAD_SHEET_SECTION =
  /^(INTRO|VERSE(?:\s+\d+)?|CHORUS(?:\s+\d+)?|BRIDGE|OUTRO|TAG|TURNAROUND|PRE[- ]?CHORUS|INTERLUDE|INSTRUMENTAL|VAMP|HOOK|PRELUDE|POST[- ]?CHORUS)\s*:?\s+/i;

/**
 * Lead sheet row: one or more section labels (e.g. `INTRO VERSE 1`) then chords only.
 * A line like `VERSE 1 Hear the…` does not match (lyrics after the label).
 */
export function matchLeadSheetSectionLine(line: string): { prefix: string; chordPart: string } | null {
  const leadWs = line.match(/^(\s*)/)?.[1] ?? "";
  let rest = line.slice(leadWs.length);
  let prefix = leadWs;
  let labelCount = 0;
  while (true) {
    const m = rest.match(LEAD_SHEET_SECTION);
    if (!m) break;
    prefix += m[0];
    rest = rest.slice(m[0].length);
    labelCount++;
  }
  if (labelCount === 0) return null;
  if (!rest.trim() || !isChordOnlyLine(rest)) return null;
  return { prefix, chordPart: rest };
}

function transposeChordOnlyLine(line: string, semitones: number): string {
  return line.replace(/[^\s]+/g, (token) => {
    const clean = stripPunctuation(token);
    if (clean === "|") return token;
    if (!clean || !isChordToken(clean)) return token;
    const transposed = transposeChordSymbol(clean, semitones);
    const i = token.indexOf(clean);
    if (i === -1) return token;
    return token.slice(0, i) + transposed + token.slice(i + clean.length);
  });
}

function transposeLeadSheetLine(line: string, semitones: number): string {
  if (isChordOnlyLine(line)) return transposeChordOnlyLine(line, semitones);
  const section = matchLeadSheetSectionLine(line);
  if (section) return section.prefix + transposeChordOnlyLine(section.chordPart, semitones);
  return line;
}

/** Transpose [chord] markers and chord-only lines (lead-sheet style). */
export function transposeLyricsWithChords(text: string, semitones: number): string {
  if (semitones === 0) return text;
  let withBrackets = text.replace(/\[([^\]]+)\]/g, (_, inner) => {
    return `[${transposeChordSymbol(String(inner).trim(), semitones)}]`;
  });
  const lines = withBrackets.split("\n");
  return lines.map((line) => transposeLeadSheetLine(line, semitones)).join("\n");
}

/** Semitone delta from `fromKey` to `toKey` (simple pitch-class roots, major-style). */
export function semitoneDeltaBetweenKeys(fromKey: string, toKey: string): number {
  const a = /^([A-G][#b]?)/.exec(fromKey.trim());
  const b = /^([A-G][#b]?)/.exec(toKey.trim());
  if (!a || !b) return 0;
  const ma = Note.midi(`${a[1]}4`);
  const mb = Note.midi(`${b[1]}4`);
  if (ma == null || mb == null) return 0;
  return Math.round(mb - ma);
}
