import type { Person } from "./schema";

/** Categorical palette in fixed order; a person keeps the same color everywhere. */
export const PALETTE = [
  "#ff5ca8",
  "#f2c94c",
  "#25d366",
  "#53bdeb",
  "#ff7a59",
  "#b388ff",
  "#7fd6c2",
  "#ffb3c7",
  "#b5e655",
  "#06d6a0",
  "#82aaff",
  "#f4a261",
] as const satisfies readonly string[];

/** 13th+ person, `resto`, and anyone without a profile. */
export const FALLBACK_COLOR = "#55656f";

export function colorFor(colorIndex: number): string {
  return Number.isInteger(colorIndex) && colorIndex >= 0 && colorIndex < PALETTE.length
    ? PALETTE[colorIndex]
    : FALLBACK_COLOR;
}

/** Color by slug; unknown slugs (e.g. lore's `pipo`) get the gray fallback. */
export function colorForSlug(
  slug: string,
  people: readonly Pick<Person, "slug" | "colorIndex">[],
): string {
  const p = people.find((x) => x.slug === slug);
  return p ? colorFor(p.colorIndex) : FALLBACK_COLOR;
}

/** Text color for a person: their palette color, or the paper color when they have none (the gray fallback reads badly as text). */
export function personTextColor(
  slug: string,
  people: readonly Pick<Person, "slug" | "colorIndex">[],
): string {
  const p = people.find((x) => x.slug === slug);
  return p && p.colorIndex >= 0 ? colorFor(p.colorIndex) : "var(--paper)";
}
