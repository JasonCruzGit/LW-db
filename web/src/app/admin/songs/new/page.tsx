"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Protected } from "@/components/Protected";
import { SongForm, emptySongForm, formStateToPayload } from "@/components/SongForm";
import { api } from "@/lib/api";

export default function NewSongPage() {
  return (
    <Protected roles={["admin"]}>
      <NewSongInner />
    </Protected>
  );
}

function NewSongInner() {
  const router = useRouter();
  const [state, setState] = useState(emptySongForm);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const song = await api.songs.create(formStateToPayload(state));
      router.push(`/songs/${song.id}?created=1`);
    } catch {
      setMsg("Could not save song.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/songs" className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← Songs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New song</h1>
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <SongForm value={state} onChange={setState} onSubmit={submit} submitLabel={busy ? "Saving…" : "Save song"} busy={busy} />
    </div>
  );
}
