"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { mentionQuery } from "@/lib/mention-query";
import type { Comment, CommentEntityType } from "@/lib/types";

export function CommentsPanel({
  entityType,
  entityId,
}: {
  entityType: CommentEntityType;
  entityId: string;
}) {
  const [items, setItems] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [caret, setCaret] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.comments
      .list(entityType, entityId)
      .then((c) => {
        if (!cancelled) setItems(c);
      })
      .catch(() => {
        if (!cancelled) setErr("Could not load comments.");
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  useEffect(() => {
    const mq = mentionQuery(body, caret);
    if (!mq || !mq.q.trim()) {
      setSuggest([]);
      setSuggestOpen(false);
      return;
    }
    let cancelled = false;
    api
      .userSearch(mq.q)
      .then((u) => {
        if (cancelled) return;
        setSuggest(u);
        setSuggestOpen(u.length > 0);
      })
      .catch(() => {
        if (!cancelled) {
          setSuggest([]);
          setSuggestOpen(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [body, caret]);

  function applyMention(user: { name: string | null; email: string }) {
    const q = mentionQuery(body, caret);
    if (!q) return;
    const handle = user.email;
    const next = body.slice(0, q.start) + "@" + handle + " " + body.slice(q.end);
    const pos = q.start + 1 + handle.length + 1;
    setBody(next);
    setCaret(pos);
    setSuggestOpen(false);
    queueMicrotask(() => {
      const el = textareaRef.current;
      if (el) el.setSelectionRange(pos, pos);
    });
  }

  async function submit() {
    const text = body.trim();
    if (!text) return;
    setErr(null);
    setBusy(true);
    try {
      const c = await api.comments.create({ entityType, entityId, body: text });
      setItems((prev) => [...prev, c]);
      setBody("");
      setCaret(0);
    } catch (e: any) {
      const status = typeof e?.status === "number" ? e.status : null;
      const msg =
        typeof e?.body === "string"
          ? e.body
          : typeof e?.body?.error === "string"
            ? e.body.error
            : status
              ? `Could not post comment. (${status})`
              : "Could not post comment.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Comments</h2>
        <div className="text-xs text-zinc-500">Use @name or @email to mention</div>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-4 space-y-3">
        {items.length === 0 && <p className="text-sm text-zinc-500">No comments yet.</p>}
        {items.map((c) => (
          <div key={c.id} className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                {c.author?.name || c.author?.email || "User"}{" "}
                <span className="font-normal text-zinc-500">
                  · {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{c.body}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative z-0 flex-1">
          <textarea
            ref={textareaRef}
            className="min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="Add a comment…"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setCaret(e.target.selectionStart ?? 0);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onKeyUp={(e) => setCaret((e.currentTarget as HTMLTextAreaElement).selectionStart ?? 0)}
            onBlur={() => window.setTimeout(() => setSuggestOpen(false), 120)}
            onFocus={(e) => {
              setCaret(e.currentTarget.selectionStart ?? body.length);
              const mq = mentionQuery(body, e.currentTarget.selectionStart ?? body.length);
              if (mq?.q.trim() && suggest.length) setSuggestOpen(true);
            }}
          />
          {suggestOpen && suggest.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
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
        <button
          type="button"
          disabled={busy || !body.trim()}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          onClick={submit}
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </section>
  );
}

