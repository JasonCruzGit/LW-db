"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { SongForm, formStateToPayload, songToFormState } from "@/components/SongForm";
import { api } from "@/lib/api";
import type { SongFormState } from "@/components/SongForm";

export default function EditSongPage() {
  return (
    <Protected roles={["admin"]}>
      <EditSongInner />
    </Protected>
  );
}

function EditSongInner() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const [state, setState] = useState<SongFormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.songs.get(id);
        if (!cancelled) setState(songToFormState(s));
      } catch {
        if (!cancelled) setMsg("Song not found.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function submit() {
    if (!state) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.songs.update(id, formStateToPayload(state));
      router.push(`/songs/${id}`);
    } catch {
      setMsg("Could not update song.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this song?")) return;
    try {
      await api.songs.remove(id);
      router.push("/songs");
    } catch {
      setMsg("Could not delete.");
    }
  }

  if (msg && !state) return <p className="text-red-600">{msg}</p>;
  if (!state) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={`/songs/${id}`} className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            ← Song
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit song</h1>
        </div>
        <button type="button" className="text-sm text-red-600 hover:underline" onClick={remove}>
          Delete song
        </button>
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <SongForm value={state} onChange={setState} onSubmit={submit} submitLabel={busy ? "Saving…" : "Save changes"} busy={busy} />
    </div>
  );
}
