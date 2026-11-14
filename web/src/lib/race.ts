/** Running totals per person: [1, 0, 2] -> [1, 1, 3]. */
export function cumulative(series: Record<string, number[]>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [slug, values] of Object.entries(series)) {
    let acc = 0;
    out[slug] = values.map((v) => (acc += v));
  }
  return out;
}

/** Slugs sorted by cumulative value at month `i`, descending; ties by slug. */
export function orderAt(cum: Record<string, number[]>, i: number): string[] {
  const at = (s: string) => cum[s]?.[i] ?? 0;
  return Object.keys(cum).sort((a, b) => at(b) - at(a) || (a < b ? -1 : a > b ? 1 : 0));
}
