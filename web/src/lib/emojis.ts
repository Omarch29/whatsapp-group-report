import { top } from "./media";
import type { EmojisData } from "./schema";

// Emojis definitions shared by the server page and the client charts (see lib/media.ts).

type ByYear = EmojisData["byYear"];

/** Each year's number one, and the emoji that led the most years (first seen wins a tie); null without years. */
export function yearLeaders(byYear: ByYear): {
  leaders: { year: string; e: string }[];
  most: { e: string; years: number } | null;
} {
  const leaders = byYear.flatMap((y) => (y.top[0] ? [{ year: y.year, e: y.top[0].e }] : []));
  return { leaders, most: mostOften(leaders.map((l) => l.e)) };
}

/** The emoji that made the top 5 the most years (first seen wins a tie); null without years. */
export function mostConstant(byYear: ByYear): { e: string; years: number } | null {
  return mostOften(byYear.flatMap((y) => [...new Set(y.top.map((t) => t.e))]));
}

/** The biggest single count of one emoji in one year; null without years. */
export function yearRecord(byYear: ByYear): { e: string; n: number; year: string } | null {
  return top(
    byYear.flatMap((y) => y.top.map((t) => ({ ...t, year: y.year }))),
    (r) => r.n,
  );
}

/** The signature with the highest own / rest ratio. */
export function strongestSignature(signature: EmojisData["signature"]): EmojisData["signature"][number] | null {
  return top(signature, (s) => s.ratio);
}

function mostOften(list: readonly string[]): { e: string; years: number } | null {
  const counts = new Map<string, number>();
  for (const e of list) counts.set(e, (counts.get(e) ?? 0) + 1);
  return top(
    [...counts].map(([e, years]) => ({ e, years })),
    (r) => r.years,
  );
}
