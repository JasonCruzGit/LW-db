"use client";

import clsx from "clsx";
import { stripChordMarkers } from "@/lib/chords";

/** Large, readable lyrics with chord brackets removed for vocalists. */
export function LyricsOnly({ text, className }: { text: string; className?: string }) {
  const plain = stripChordMarkers(text);
  return (
    <div
      className={clsx(
        "whitespace-pre-wrap text-lg leading-relaxed tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-xl",
        className
      )}
    >
      {plain}
    </div>
  );
}
