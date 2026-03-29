"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { isChordOnlyLine, isChordToken, matchLeadSheetSectionLine } from "@/lib/chords";

/** Renders lyric lines with [chord] tokens emphasized for stage reading. */
export function ChordLines({
  text,
  className,
  chordClassName,
}: {
  text: string;
  className?: string;
  chordClassName?: string;
}) {
  const lines = text.split("\n");
  return (
    <div className={clsx("whitespace-pre-wrap font-mono text-[0.95rem] leading-relaxed", className)}>
      {lines.map((line, i) => (
        <p key={i} className="mb-1">
          <LineParts line={line} chordClassName={chordClassName} />
        </p>
      ))}
    </div>
  );
}

function stripEdgePunct(token: string): string {
  return token.replace(/^[,;.:()]+|[,;.:()]+$/g, "");
}

/** Lead-sheet row: only chords (and |) — highlight each symbol. */
function ChordOnlyLineParts({ line, chordClassName }: { line: string; chordClassName?: string }) {
  const pieces = line.split(/(\s+)/);
  return (
    <>
      {pieces.map((piece, idx) => {
        if (/^\s+$/.test(piece)) {
          return <span key={idx}>{piece}</span>;
        }
        const clean = stripEdgePunct(piece);
        if (clean === "|" || !isChordToken(clean)) {
          return <span key={idx}>{piece}</span>;
        }
        const i = piece.indexOf(clean);
        if (i === -1) {
          return <span key={idx}>{piece}</span>;
        }
        return (
          <span key={idx}>
            {piece.slice(0, i)}
            <span className={clsx("font-semibold text-emerald-700 dark:text-emerald-400", chordClassName)}>{clean}</span>
            {piece.slice(i + clean.length)}
          </span>
        );
      })}
    </>
  );
}

function LineParts({ line, chordClassName }: { line: string; chordClassName?: string }) {
  const sectionRow = matchLeadSheetSectionLine(line);
  if (sectionRow) {
    return (
      <>
        <span>{sectionRow.prefix}</span>
        <ChordOnlyLineParts line={sectionRow.chordPart} chordClassName={chordClassName} />
      </>
    );
  }
  if (isChordOnlyLine(line)) {
    return <ChordOnlyLineParts line={line} chordClassName={chordClassName} />;
  }

  const parts: ReactNode[] = [];
  let last = 0;
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      parts.push(<span key={`t-${last}`}>{line.slice(last, m.index)}</span>);
    }
    parts.push(
      <span
        key={`c-${m.index}`}
        className={clsx(
          "font-semibold text-emerald-700 dark:text-emerald-400",
          chordClassName
        )}
      >
        [{m[1]}]
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) {
    parts.push(<span key={`t-end`}>{line.slice(last)}</span>);
  }
  return <>{parts}</>;
}
