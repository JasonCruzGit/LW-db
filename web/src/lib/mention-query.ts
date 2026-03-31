/**
 * Active @mention token ending at `caret` (for autocomplete while typing).
 * Matches only when `@` is at line start or after whitespace, and the query has no spaces or `@`.
 * `start` = index of `@`, `end` = caret (replace [start, end) with @email).
 */
export function mentionQuery(
  text: string,
  caret: number = text.length
): { q: string; start: number; end: number } | null {
  const i = Math.min(Math.max(0, caret), text.length);
  const before = text.slice(0, i);
  const m = /(^|\s)@([^\s@]{0,40})$/.exec(before);
  if (!m) return null;
  const q = m[2];
  const end = i;
  const start = end - q.length - 1;
  return { q, start, end };
}
