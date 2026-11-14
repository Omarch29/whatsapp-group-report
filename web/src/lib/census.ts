import type { CensusData } from "./schema";

// Census definitions shared by the server page (criteria copy) and the client charts.
// Kept out of the "use client" modules: a server component importing a value from one
// gets a client reference, not the value.

/** Silences longer than this many days are drawn as hatched gaps in the tenure bars. */
export const MIN_GAP_DAYS = 30;

/** Madrugador 6–9 h, búho 0–6 h (plan constraints; scripts/web/census.py uses the same windows). */
export const EARLY_HOURS = [6, 9] as const;
export const OWL_HOURS = [0, 6] as const;

/** The biggest single person-year in `byYear`; null when nobody wrote anything. */
export function topPersonYear(
  byYear: CensusData["byYear"],
): { slug: string; year: string; value: number } | null {
  let best: { slug: string; year: string; value: number } | null = null;
  for (const [slug, values] of Object.entries(byYear.series)) {
    values.forEach((value, i) => {
      const year = byYear.years[i];
      if (year !== undefined && value > 0 && (!best || value > best.value)) best = { slug, year, value };
    });
  }
  return best;
}
