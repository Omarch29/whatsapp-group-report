import type { MentionsData } from "./schema";

type SlugN = { slug: string; n: number };

/** Key of `samples`: "from>to". */
export const sampleKey = (from: string, to: string) => `${from}>${to}`;

/** Mentions from `from` to `to`; 0 when either has no row. */
export function mentionCount(m: MentionsData, from: string, to: string): number {
  const i = m.slugs.indexOf(from);
  const j = m.slugs.indexOf(to);
  return i < 0 || j < 0 ? 0 : (m.matrix[i]?.[j] ?? 0);
}

/** The largest cell of row `i` (at least 1, to divide by). */
export const rowMax = (m: MentionsData, i: number) => Math.max(1, ...(m.matrix[i] ?? []));

/** Whom `slug` mentions (their row) and who mentions them (their column), desc, without zeros or themselves. */
export function mentionsOf(m: MentionsData, slug: string): { to: SlugN[]; by: SlugN[] } {
  if (!m.slugs.includes(slug)) return { to: [], by: [] };
  const others = m.slugs.filter((s) => s !== slug);
  const list = (n: (other: string) => number) =>
    others
      .map((other) => ({ slug: other, n: n(other) }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n);
  return { to: list((o) => mentionCount(m, slug, o)), by: list((o) => mentionCount(m, o, slug)) };
}

/** The biggest cell off the diagonal: who tags whom the most (first on a tie); null when every cell is 0. */
export function topPair(m: MentionsData): { from: string; to: string; n: number } | null {
  let best: { from: string; to: string; n: number } | null = null;
  m.matrix.forEach((row, i) =>
    row.forEach((n, j) => {
      if (i !== j && n > 0 && (best === null || n > best.n)) best = { from: m.slugs[i]!, to: m.slugs[j]!, n };
    }),
  );
  return best;
}
