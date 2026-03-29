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
  },
};
