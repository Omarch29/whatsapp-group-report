import { PALETTE } from "./colors";
import type { MediaData } from "./schema";

// Multimedia, Emojis and Encuestas definitions shared by the server pages (ledes, records)
// and the client charts. Kept out of the "use client" modules: a server component importing
// a value from one gets a client reference, not the value.

/** `who` of a poll by someone without a profile (lib/data's RESTO_SLUG, which client code can't import: it reads files). */
export const RESTO = "resto";

/**
 * The kinds drawn as their own segment (`media` is Android's attachment of unknown type); anything else
 * (GIFs, calls, locations…) folds into «otros».
 */
export const MAIN_KINDS = ["image", "sticker", "audio", "video", "poll", "deleted", "media"] as const;
export const OTHER_KIND = "other";

/** One fixed colour per kind segment (tokens first, then palette hues). */
export const KIND_COLORS: Readonly<Record<string, string>> = {
  image: "var(--gold)",
  sticker: "var(--ribbon)",
  audio: "var(--mint)",
  video: PALETTE[3],
  poll: PALETTE[5],
  deleted: "var(--dim)",
  media: PALETTE[6],
  [OTHER_KIND]: PALETTE[4],
};

export type KindGroups = { main: string[]; other: string[] };

/** Splits the data's kinds (text excluded) into the main segments and the folded rest, keeping data order. */
export function kindGroups(kinds: readonly string[]): KindGroups {
  const list = kinds.filter((k) => k !== "text");
  const main = new Set<string>(MAIN_KINDS);
  return { main: list.filter((k) => main.has(k)), other: list.filter((k) => !main.has(k)) };
}

/** A person's segment values: each main kind, then «otros» as the sum of the folded kinds (when there are any). */
export function kindValues(
  values: Readonly<Record<string, number>>,
  groups: KindGroups,
): { kind: string; value: number }[] {
  const out = groups.main.map((kind) => ({ kind, value: values[kind] ?? 0 }));
  if (groups.other.length > 0) {
    out.push({ kind: OTHER_KIND, value: groups.other.reduce((acc, k) => acc + (values[k] ?? 0), 0) });
  }
  return out;
}

/** The group's most common kind after text, summed over people; null without kinds. */
export function topKind(data: MediaData["kinds"]): { kind: string; n: number } | null {
  let best: { kind: string; n: number } | null = null;
  for (const kind of data.kinds) {
    if (kind === "text") continue;
    const n = data.byPerson.reduce((acc, p) => acc + (p.counts[kind] ?? 0), 0);
    if (!best || n > best.n) best = { kind, n };
  }
  return best;
}

/** Index of the largest value (first on a tie), -1 for an empty list. */
export function peakIndex(values: readonly number[]): number {
  return values.reduce((best, v, i) => (best === -1 || v > values[best]! ? i : best), -1);
}

/** The row with the largest `by` (first on a tie), null for an empty list. */
export function top<T>(rows: readonly T[], by: (row: T) => number): T | null {
  return rows.reduce<T | null>((best, r) => (best === null || by(r) > by(best) ? r : best), null);
}
