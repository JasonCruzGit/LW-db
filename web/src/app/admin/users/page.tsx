"use client";

import { useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { api } from "@/lib/api";
import type { User, UserRole } from "@/lib/types";

export default function AdminUsersPage() {
  return (
    <Protected roles={["admin"]}>
      <UsersInner />
    </Protected>
  );
}

function UsersInner() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("musician");
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const list = await api.users.list();
    setUsers(list);
  }

  useEffect(() => {
    refresh().catch(() => setMsg("Failed to load users."));
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.users.create({ email, password, name, role });
      setEmail("");
      setName("");
      setPassword("");
      await refresh();
    } catch {
      setMsg("Could not create user (email in use or weak password).");
    }
  }

  async function updateRole(id: string, next: UserRole) {
    try {
      await api.users.update(id, { role: next });
      await refresh();
    } catch {
      setMsg("Could not update user.");
    }
  }

  async function removeUser(id: string) {
    if (!confirm("Delete this user?")) return;
    try {
      await api.users.remove(id);
      await refresh();
    } catch {
      setMsg("Could not delete user.");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Create accounts and assign roles.</p>
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <form onSubmit={createUser} className="grid max-w-xl gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">New user</h2>
        <input
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <select
          className="select-field w-full px-3 py-2 pr-9"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          <option value="musician">Musician (chords)</option>
          <option value="singer">Singer (lyrics only)</option>
          <option value="song_leader">Song leader</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
          Create user
        </button>
      </form>

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-sm text-zinc-500">{u.email}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="select-field min-w-[10rem] px-2 py-1.5 pr-8 text-sm"
                value={u.role}
                onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
              >
                <option value="musician">Musician (chords)</option>
                <option value="singer">Singer (lyrics only)</option>
                <option value="song_leader">Song leader</option>
                <option value="admin">Admin</option>
              </select>
              <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => removeUser(u.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
