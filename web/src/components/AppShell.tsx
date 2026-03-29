"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import clsx from "clsx";

function ThemeToggle() {
  return (
    <button
      type="button"
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      onClick={() => {
        document.documentElement.classList.toggle("dark");
        localStorage.setItem(
          "wts_theme",
          document.documentElement.classList.contains("dark") ? "dark" : "light"
        );
      }}
      aria-label="Toggle dark mode"
    >
      Theme
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("wts_theme");
    if (stored === "dark") document.documentElement.classList.add("dark");
    if (stored === "light") document.documentElement.classList.remove("dark");
  }, []);

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/songs", label: "Songs" },
    ...(user && (user.role === "admin" || user.role === "song_leader")
      ? [{ href: "/lineups/new", label: "New lineup" }]
      : []),
    ...(user?.role === "admin"
      ? [
          { href: "/admin/songs/new", label: "Add song" },
          { href: "/admin/users", label: "Users" },
        ]
      : []),
  ];

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight text-zinc-900 dark:text-white">
            LW Worship Team App
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  pathname === l.href
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <span className="hidden text-sm text-zinc-500 sm:inline">{user.name}</span>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700"
                  onClick={() => logout()}
                >
                  Log out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>
      <nav className="border-b border-zinc-200 bg-white/95 px-2 py-2 md:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto pb-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium",
                pathname === l.href
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400"
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
