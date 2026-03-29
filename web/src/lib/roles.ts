import type { UserRole } from "./types";

export function isSinger(role: UserRole | undefined): boolean {
  return role === "singer";
}

/** Chord sheets, transpose, and instrument tabs — hidden for vocalist accounts. */
export function showsChordCharts(role: UserRole | undefined): boolean {
  return role !== "singer";
}
