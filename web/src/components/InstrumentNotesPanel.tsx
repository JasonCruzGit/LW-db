"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { InstrumentType } from "@/lib/types";
import { api } from "@/lib/api";
import { mentionQuery } from "@/lib/mention-query";

const LABELS: Record<InstrumentType, string> = {
  guitar: "Guitar",
  bass: "Bass",
  keys: "Keys",
  drums: "Drums",
  vocals: "Vocals",
};

export function InstrumentNotesPanel({
  songId,
  instrument,
  canEdit,
  compact,
}: {
  songId: string;
  instrument: InstrumentType;
  canEdit: boolean;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [savedBody, setSavedBody] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestErr, setSuggestErr] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setOk(null);
    api.songInstrumentNotes
      .list(songId, instrument)
      .then((items) => {
        if (cancelled) return;
        const body = items[0]?.body ?? "";
        setSavedBody(body);
        setDraft(body);
        setCaret(body.length);
      })
      .catch(() => {
        if (!cancelled) setErr("Could not load instrument notes.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [songId, instrument]);

  useEffect(() => {
    if (!canEdit) return;
    const mq = mentionQuery(draft, caret);
    if (!mq || !mq.q.trim()) {
      setSuggest([]);
      setSuggestOpen(false);
      setSuggestLoading(false);
      setSuggestErr(null);
      return;
    }
    let cancelled = false;
    setSuggestLoading(true);
    setSuggestErr(null);
    // Keep the dropdown open while we search (even if 0 results).
    setSuggestOpen(true);
    api
      .userSearch(mq.q)
      .then((u) => {
        if (cancelled) return;
        setSuggest(u);
        setSuggestOpen(true);
      })
      .catch(() => {
        if (!cancelled) {
          setSuggest([]);
          setSuggestErr("Could not search users.");
          setSuggestOpen(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [draft, caret, canEdit]);
  
  useEffect(() => {
    if (!suggestOpen) return;
    if (!suggestLoading) return;
    const t = window.setTimeout(() => setSuggestLoading(false), 8000);
    return () => window.clearTimeout(t);
  }, [suggestOpen, suggestLoading]);

  function applyMention(user: { name: string | null; email: string }) {
    const q = mentionQuery(draft, caret);
    if (!q) return;
    const handle = user.email;
    const next = draft.slice(0, q.start) + "@" + handle + " " + draft.slice(q.end);
    const pos = q.start + 1 + handle.length + 1;
    setDraft(next);
    setCaret(pos);
    setSuggestOpen(false);
    queueMicrotask(() => {
      const el = textareaRef.current;
      if (el) el.setSelectionRange(pos, pos);
    });
  }

  const dirty = useMemo(() => draft.trim() !== (savedBody ?? "").trim(), [draft, savedBody]);

  async function save() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const note = await api.songInstrumentNotes.upsert(songId, { instrument, body: draft });
      const body = note.body ?? "";
      setSavedBody(body);
      setDraft(body);
      setCaret(body.length);
      setOk("Saved.");
      window.setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      const msg =
        typeof e?.body === "string"
          ? e.body
          : typeof e?.body?.error === "string"
            ? e.body.error
            : "Could not save notes.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  const title = `Instrument notes — ${LABELS[instrument]}`;

  if (loading) {
    return (
      <section className={compact ? "rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900" : "rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"}>
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</div>
        <p className="mt-2 text-sm text-zinc-500">Loading…</p>
      </section>
    );
  }

  if (!canEdit && !savedBody.trim()) return null;

  return (
    <section className={compact ? "rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900" : "rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</div>
          <div className="mt-1 text-xs text-zinc-500">
            Tips, cues, patches, voicings, transitions.
            {canEdit && <span className="text-zinc-400"> · Use @name or @email to mention.</span>}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            disabled={busy || !dirty}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            onClick={save}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {ok && <p className="mt-2 text-sm text-emerald-600">{ok}</p>}

      {canEdit ? (
        <div className="relative z-0 mt-3">
          <textarea
            ref={textareaRef}
            className="min-h-24 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setCaret(e.target.selectionStart ?? 0);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onKeyUp={(e) => setCaret((e.currentTarget as HTMLTextAreaElement).selectionStart ?? 0)}
            onBlur={() => window.setTimeout(() => setSuggestOpen(false), 120)}
            onFocus={(e) => {
              setCaret(e.currentTarget.selectionStart ?? draft.length);
              const mq = mentionQuery(draft, e.currentTarget.selectionStart ?? draft.length);
              if (mq?.q.trim()) setSuggestOpen(true);
            }}
            placeholder="Add instrument-specific notes…"
          />
          {suggestOpen && (
            <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              {suggestLoading && <div className="px-3 py-2 text-sm text-zinc-500">Searching…</div>}
              {!suggestLoading && suggestErr && <div className="px-3 py-2 text-sm text-red-600">{suggestErr}</div>}
              {!suggestLoading && !suggestErr && suggest.length === 0 && (
                <div className="px-3 py-2 text-sm text-zinc-500">No matches.</div>
              )}
              {suggest.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMention(u)}
                >
                  <span className="font-medium">{u.name || u.email}</span>
                  <span className="text-xs text-zinc-500">{u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          {savedBody}
        </div>
      )}
    </section>
  );
}

