"use client";

import { Joyride, STATUS, type Step } from "react-joyride";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useEffect, useMemo, useState, useContext } from "react";
import { useAuth } from "@/contexts/auth-context";

type RoutedStep = Step & { route?: string };

const TOUR_KEY = "wts_tour_v1_done";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

const TourActiveContext = createContext(false);

export function useTourActive() {
  return useContext(TourActiveContext);
}

function useTourSteps(): RoutedStep[] {
  const { user } = useAuth();

  return useMemo(() => {
    const base: RoutedStep[] = [
      {
        target: '[data-tour="nav-dashboard"]',
        content: "This is your home base. Quick access to upcoming services and recently used songs.",
        placement: "bottom",
        route: "/",
        overlayColor: "rgba(0,0,0,0.78)",
        spotlightRadius: 12,
        spotlightPadding: 10,
      },
      {
        target: '[data-tour="nav-songs"]',
        content: "Song library: search by title/artist, filter by key/BPM/tags, and open charts.",
        placement: "bottom",
        route: "/",
      },
      {
        target: '[data-tour="dashboard-upcoming"]',
        content: "Upcoming lineup cards open the Service View for Sunday.",
        placement: "bottom",
        route: "/",
      },
      {
        target: '[data-tour="dashboard-recent"]',
        content: "Recently used songs helps you jump back into charts quickly.",
        placement: "bottom",
        route: "/",
      },
      {
        target: '[data-tour="nav-songs"]',
        content: "Next, let’s open the Song Library.",
        placement: "bottom",
        route: "/",
      },
      {
        target: '[data-tour="songs-filters"]',
        content: "Use these filters to narrow down songs fast (search, key, BPM, tags).",
        placement: "bottom",
        route: "/songs",
      },
      {
        target: '[data-tour="songs-list"]',
        content: "Click a song to open charts. Key/BPM/tags are shown on the right.",
        placement: "top",
        route: "/songs",
      },
      {
        target: '[data-tour="song-favorite"]',
        content: "Save favorites for quick access on your device.",
        placement: "left",
        route: "/songs/[id]",
      },
      {
        target: '[data-tour="song-transpose"]',
        content: "Transpose changes the key for charts (guitar/bass/keys) instantly.",
        placement: "bottom",
        route: "/songs/[id]",
      },
    ];

    if (user && (user.role === "admin" || user.role === "song_leader")) {
      base.push(
        {
          target: '[data-tour="nav-new-lineup"]',
          content: "Song leaders create setlists here.",
          placement: "bottom",
          route: "/",
        },
        {
          target: '[data-tour="lineup-add-song"]',
          content: "Pick songs from the library and click Add to build the setlist.",
          placement: "bottom",
          route: "/lineups/new",
        },
        {
          target: '[data-tour="lineup-editor"]',
          content: "Drag to reorder, change keys per song, and add notes for the team.",
          placement: "top",
          route: "/lineups/new",
        },
        {
          target: '[data-tour="lineup-actions"]',
          content: "Save as draft, mark final, or publish to make it visible in Service View.",
          placement: "top",
          route: "/lineups/new",
        }
      );
    }

    if (user?.role === "admin") {
      base.push(
        {
          target: '[data-tour="nav-add-song"]',
          content: "Admins can add new songs and chord charts here.",
          placement: "bottom",
          route: "/",
        },
        {
          target: '[data-tour="nav-users"]',
          content: "Manage users and roles (admin, song leader, musician, singer).",
          placement: "bottom",
          route: "/",
        }
      );
    }

    base.push({
      target: '[data-tour="tour-help"]',
      content: "Anytime you need it, replay the tour here.",
      placement: "left",
      route: "/",
    });

    return base;
  }, [user]);
}

function normalizeRoute(pathname: string): string {
  if (pathname.startsWith("/songs/")) return "/songs/[id]";
  return pathname;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const steps = useTourSteps();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [startHint, setStartHint] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (run) document.body.classList.add("wts-tour-active");
    else document.body.classList.remove("wts-tour-active");
    return () => document.body.classList.remove("wts-tour-active");
  }, [run]);

  useEffect(() => {
    if (!run) {
      setStartHint(false);
      return;
    }
    // Brief nudge so users know what to do.
    setStartHint(true);
    const t = window.setTimeout(() => setStartHint(false), 3500);
    return () => window.clearTimeout(t);
  }, [run]);

  useEffect(() => {
    if (loading) return;
    // Only start once we know auth state (or demo mode has logged in).
    if (!user) return;
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(TOUR_KEY) === "1";
    if (!done) setRun(true);
  }, [loading, user]);

  useEffect(() => {
    // Keep the tour aligned when users navigate manually.
    if (!run) return;
    const current = normalizeRoute(pathname);
    const idx = steps.findIndex((s) => (s.route ? s.route === current : true));
    if (idx >= 0 && idx < stepIndex) {
      // don't rewind on navigation; only adjust forward jumps are handled in callback
      return;
    }
  }, [pathname, run, stepIndex, steps]);

  function startTour() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOUR_KEY);
    setStepIndex(0);
    setRun(true);
  }

  function finishTour() {
    if (typeof window !== "undefined") localStorage.setItem(TOUR_KEY, "1");
    setRun(false);
    setStepIndex(0);
  }

  function handleEvent(data: any) {
    const { status, type, index, action } = data ?? {};

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) return finishTour();
    if (type === "tour:end" || type === "tour:close") return finishTour();
    if (action === "close" || action === "skip" || action === "reset") return finishTour();

    if (type === "step:after") {
      const dir = action === "prev" ? -1 : 1;
      const target = clamp(index + dir, 0, steps.length - 1);
      const targetStep = steps[target];

      if (targetStep?.route) {
        const current = normalizeRoute(pathname);
        if (targetStep.route !== current) {
          router.push(targetStep.route === "/songs/[id]" ? "/songs" : targetStep.route);
          // If this step wants a specific song detail page, we can't guess which song;
          // so we route to /songs and the user can click any song, then tour continues.
          if (targetStep.route === "/songs/[id]") {
            setStepIndex(target);
            return;
          }
        }
      }
      setStepIndex(target);
    }

    if (type === "error:target_not_found") {
      // Skip steps that don't exist for the current role/page.
      setStepIndex(index + 1);
    }
  }

  // Expose a global helper button hook via a data attribute in AppShell.
  // (We keep it simple: click handler is attached in AppShell via window event.)
  useEffect(() => {
    function onStart() {
      startTour();
    }
    window.addEventListener("wts:start-tour", onStart as EventListener);
    return () => window.removeEventListener("wts:start-tour", onStart as EventListener);
  }, []);

  return (
    <TourActiveContext.Provider value={run}>
      {run && <div className="fixed inset-0 z-40 bg-black/75" aria-hidden />}
      {run && startHint && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[60] -translate-x-1/2">
          <div className="rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg ring-1 ring-black/10">
            Click <span className="font-semibold">Dashboard</span> to start the tour
          </div>
        </div>
      )}
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous
        scrollToFirstStep
        onEvent={handleEvent}
        locale={{
          skip: "Skip tour",
          close: "Done",
          back: "Back",
          next: "Next",
        }}
        options={{
          zIndex: 50,
          primaryColor: "#18181b",
          textColor: "#0a0a0a",
          arrowColor: "#ffffff",
          backgroundColor: "#ffffff",
          overlayColor: "rgba(0,0,0,0.80)",
          overlayClickAction: false,
          buttons: ["skip", "back", "primary", "close"],
          showProgress: true,
        }}
      />
      <div className={run ? "pointer-events-none select-none" : undefined} aria-hidden={run ? true : undefined}>
        {children}
      </div>
    </TourActiveContext.Provider>
  );
}

