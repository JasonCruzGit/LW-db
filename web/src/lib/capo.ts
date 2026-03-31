import { Note } from "tonal";

const SHAPES = ["C", "G", "D", "A", "E"] as const;

function pcMidi(note: string): number | null {
  const m = Note.midi(`${note}4`);
  return m == null ? null : m % 12;
}

export type CapoSuggestion = { capo: number; shape: (typeof SHAPES)[number] };

export function suggestCapoShapes(targetKey: string, maxCapo = 7): CapoSuggestion[] {
  const m = /^([A-G][#b]?)/.exec(targetKey.trim());
  if (!m) return [];
  const target = pcMidi(m[1]);
  if (target == null) return [];

  const out: CapoSuggestion[] = [];
  for (const shape of SHAPES) {
    const base = pcMidi(shape);
    if (base == null) continue;
    const delta = (target - base + 12) % 12;
    if (delta <= maxCapo) out.push({ capo: delta, shape });
  }
  return out.sort((a, b) => a.capo - b.capo);
}

