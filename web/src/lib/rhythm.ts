import type { RhythmData } from "./schema";

// Ritmo definitions shared by the server page (ledes, records) and the client charts.
// Kept out of the "use client" modules so the page gets values, not client references.

/** Candidate ticks of the latency axis, in seconds. */
const TICKS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600] as const;
/** Ticks kept when the domain spans more than this ratio (15 s and 20 s would crowd the low end). */
const WIDE = 10;

/** Log domain padded out to the nearest ticks around the medians; [1, 600] without any. */
export function latencyDomain(values: readonly number[]): [number, number] {
  const pos = values.filter((v) => v > 0);
  if (pos.length === 0) return [TICKS[0], TICKS[TICKS.length - 1]!];
  const lo = Math.min(...pos) * 0.95;
  const hi = Math.max(...pos) * 1.05;
  const floor = [...TICKS].reverse().find((t) => t <= lo) ?? TICKS[0];
  const ceil = TICKS.find((t) => t >= hi) ?? Math.ceil(hi);
  return [floor, ceil];
}

/** The ticks inside the domain; a wide domain drops 1–2–5 style crowding (2, 15, 20). */
export function latencyTicks([lo, hi]: readonly [number, number]): number[] {
  const wide = hi / lo > WIDE;
  return TICKS.filter((t) => t >= lo && t <= hi && !(wide && (t === 2 || t === 15 || t === 20)));
}

export type StarterRow = { slug: string; starts: number; kills: number };

/** One row per person in starters ∪ killers: starters order first, then killers-only people. */
export function starterRows(starters: RhythmData["starters"], killers: RhythmData["killers"]): StarterRow[] {
  const kills = new Map(killers.map((k) => [k.slug, k.n]));
  const rows = starters.map((s) => ({ slug: s.slug, starts: s.n, kills: kills.get(s.slug) ?? 0 }));
  const seen = new Set(rows.map((r) => r.slug));
  for (const k of killers) if (!seen.has(k.slug)) rows.push({ slug: k.slug, starts: 0, kills: k.n });
  return rows;
}

type Streak = RhythmData["streaks"][number];
const longest = (rows: readonly Streak[], key: "streak" | "silence") =>
  rows.reduce<Streak | null>((best, r) => (best === null || r[key].days > best[key].days ? r : best), null);

/** The person with the longest run of days writing (first on a tie); null without rows. */
export const longestStreak = (rows: readonly Streak[]) => longest(rows, "streak");
/** The person with the longest silence (first on a tie); null without rows. */
export const longestSilence = (rows: readonly Streak[]) => longest(rows, "silence");
