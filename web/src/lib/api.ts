/**
 * Browser: same-origin `/api/...` (proxied by Next to the Express server) avoids CORS/Safari issues.
 * Server: call Express directly. Override with NEXT_PUBLIC_API_URL when the API is on another host.
 */
function apiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
  }
  return "";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wts_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("wts_token", token);
  else localStorage.removeItem("wts_token");
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const token = options.token ?? getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    let err: unknown = await res.text();
    try {
      err = JSON.parse(err as string);
    } catch {
      /* plain text */
    }
    throw Object.assign(new Error("API error"), { status: res.status, body: err });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: import("./types").User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      token: null,
    }),

  demoLogin: () =>
    request<{ token: string; user: import("./types").User }>("/api/auth/demo", {
      method: "POST",
      token: null,
    }),

  me: () => request<import("./types").User>("/api/auth/me"),

  users: {
    list: () => request<import("./types").User[]>("/api/users"),
    create: (body: {
      email: string;
      password: string;
      name: string;
      role: import("./types").UserRole;
    }) => request<import("./types").User>("/api/users", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<{ name: string; role: import("./types").UserRole; password: string }>) =>
      request<import("./types").User>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/api/users/${id}`, { method: "DELETE" }),
  },

  songs: {
    list: (params: Record<string, string | undefined>) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") q.set(k, v);
      });
      const s = q.toString();
      return request<import("./types").Song[]>(`/api/songs${s ? `?${s}` : ""}`);
    },
    get: (id: string) => request<import("./types").Song>(`/api/songs/${id}`),
    create: (body: unknown) => request<import("./types").Song>("/api/songs", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: unknown) =>
      request<import("./types").Song>(`/api/songs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/api/songs/${id}`, { method: "DELETE" }),
    arrangements: {
      list: (songId: string) => request<import("./types").SongArrangement[]>(`/api/songs/${songId}/arrangements`),
      create: (songId: string, body: unknown) =>
        request<import("./types").SongArrangement>(`/api/songs/${songId}/arrangements`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      update: (arrangementId: string, body: unknown) =>
        request<import("./types").SongArrangement>(`/api/arrangements/${arrangementId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      remove: (arrangementId: string) => request<void>(`/api/arrangements/${arrangementId}`, { method: "DELETE" }),
    },
    audioLinks: {
      list: (songId: string) => request<import("./types").AudioLink[]>(`/api/songs/${songId}/audio-links`),
      create: (songId: string, body: unknown) =>
        request<import("./types").AudioLink>(`/api/songs/${songId}/audio-links`, { method: "POST", body: JSON.stringify(body) }),
      update: (audioLinkId: string, body: unknown) =>
        request<import("./types").AudioLink>(`/api/audio-links/${audioLinkId}`, { method: "PATCH", body: JSON.stringify(body) }),
      remove: (audioLinkId: string) => request<void>(`/api/audio-links/${audioLinkId}`, { method: "DELETE" }),
    },
  },

  lineups: {
    list: (params?: Record<string, string | undefined>) => {
      const q = new URLSearchParams();
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== "") q.set(k, v);
      });
      const s = q.toString();
      return request<import("./types").Lineup[]>(`/api/lineups${s ? `?${s}` : ""}`);
    },
    get: (id: string) => request<import("./types").Lineup>(`/api/lineups/${id}`),
    create: (body: unknown) => request<import("./types").Lineup>("/api/lineups", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: unknown) =>
      request<import("./types").Lineup>(`/api/lineups/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    publish: (id: string) =>
      request<import("./types").Lineup>(`/api/lineups/${id}/publish`, { method: "POST" }),
    remove: (id: string) => request<void>(`/api/lineups/${id}`, { method: "DELETE" }),
  },

  favorites: {
    list: () => request<import("./types").Song[]>("/api/favorites"),
    add: (songId: string) => request<{ ok: boolean }>(`/api/favorites/${songId}`, { method: "POST" }),
    remove: (songId: string) => request<void>(`/api/favorites/${songId}`, { method: "DELETE" }),
  },

  meta: {
    songFilters: () =>
      request<{ keys: string[]; tags: string[]; bpmMin: number; bpmMax: number }>("/api/meta/song-filters"),
    recentSongs: () => request<import("./types").Song[]>("/api/meta/recent-songs"),
    tagSuggestions: (text: string, limit?: number) =>
      request<{ suggestions: string[] }>("/api/meta/tag-suggestions", {
        method: "POST",
        body: JSON.stringify({ text, limit }),
      }),
  },

  comments: {
    list: (entityType: import("./types").CommentEntityType, entityId: string) =>
      request<import("./types").Comment[]>(`/api/comments?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`),
    create: (body: { entityType: import("./types").CommentEntityType; entityId: string; body: string }) =>
      request<import("./types").Comment>("/api/comments", { method: "POST", body: JSON.stringify(body) }),
  },

  mentions: {
    list: (opts?: { unread?: boolean }) =>
      request<
        Array<{
          id: string;
          readAt: string | null;
          createdAt: string;
          comment: import("./types").Comment;
        }>
      >(`/api/mentions${opts?.unread ? "?unread=true" : ""}`),
    markAllRead: () => request<{ ok: boolean }>("/api/mentions", { method: "POST" }),
  },

  userSearch: (q: string) =>
    request<Array<{ id: string; name: string | null; email: string }>>(`/api/users/search?q=${encodeURIComponent(q)}`),

  songInstrumentNotes: {
    list: (songId: string, instrument?: import("./types").InstrumentType) => {
      const q = new URLSearchParams();
      if (instrument) q.set("instrument", instrument);
      const s = q.toString();
      return request<import("./types").SongInstrumentNote[]>(`/api/songs/${songId}/instrument-notes${s ? `?${s}` : ""}`);
    },
    upsert: (songId: string, body: { instrument: import("./types").InstrumentType; body: string }) =>
      request<import("./types").SongInstrumentNote>(`/api/songs/${songId}/instrument-notes`, { method: "PUT", body: JSON.stringify(body) }),
  },
};
