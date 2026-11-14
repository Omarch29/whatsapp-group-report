import type { LanguageData, Person } from "./schema";

// Lenguaje definitions shared by the server page (ledes, records) and the client charts.
// Kept out of the "use client" modules: a server component importing a value from one
// gets a client reference, not the value.

type Muletilla = LanguageData["muletillas"][string][number];
type Laughed = NonNullable<LanguageData["laughed"][string]>;
type Style = LanguageData["style"][number];
type Badword = LanguageData["badwords"]["byPerson"][number];

/** Muletillas: the chips start on the first person with at least this many phrases. */
export const MIN_DEFAULT_PHRASES = 6;
/** Repeated phrases in the record caption are clipped to this many characters. */
export const CAPTION_CHARS = 80;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Display name; unknown slugs get their capitalized slug. */
export function personName(slug: string, people: readonly Pick<Person, "slug" | "name">[]): string {
  return people.find((p) => p.slug === slug)?.name ?? capitalize(slug);
}

/**
 * The person a chip row starts on: the first, in `people` order, whose entry passes `ok`;
 * else the first with a non-empty entry; else the first with any entry; "" when none.
 */
export function defaultPerson<T>(
  data: Readonly<Record<string, T>>,
  people: readonly Pick<Person, "slug">[],
  ok: (entry: T) => boolean,
): string {
  const order = people.filter((p) => data[p.slug] !== undefined).map((p) => p.slug);
  const filled = (v: T) => (Array.isArray(v) ? v.length > 0 : v !== null);
  return order.find((s) => ok(data[s]!)) ?? order.find((s) => filled(data[s]!)) ?? order[0] ?? "";
}

/** The phrase for the lede: the highest own / rest ratio (the list itself is ordered by score). */
export function ledeMuletilla(list: readonly Muletilla[]): Muletilla | null {
  return list.reduce<Muletilla | null>((best, m) => (!best || m.ratio > best.ratio ? m : best), null);
}

/** The message that made the group laugh the most, across people; ties keep the first. */
export function topLaughed(laughed: LanguageData["laughed"]): (Laughed & { slug: string }) | null {
  let best: (Laughed & { slug: string }) | null = null;
  for (const [slug, l] of Object.entries(laughed)) {
    if (l && (!best || l.laughs > best.laughs)) best = { ...l, slug };
  }
  return best;
}

/** The longest average message. */
export function longestWriter(style: readonly Style[]): Style | null {
  return style.reduce<Style | null>((best, s) => (!best || s.avgChars > best.avgChars ? s : best), null);
}

/** The most swearing person, per mil of their own messages. */
export function topBadwords(byPerson: readonly Badword[]): Badword | null {
  return byPerson.reduce<Badword | null>((best, b) => (!best || b.perMil > best.perMil ? b : best), null);
}

export type LaughMix = LanguageData["laughs"]["byPerson"][number]["mix"];

export function laughTotal(mix: LaughMix): number {
  return mix.reduce((sum, c) => sum + c.n, 0);
}

/** The laugh class a person writes the most (the first in the language's order on a tie); null without laughs. */
export function topLaughClass(mix: LaughMix): LaughMix[number] | null {
  return mix.reduce<LaughMix[number] | null>((best, c) => (c.n > (best?.n ?? 0) ? c : best), null);
}

/** Clips to `max` characters, on a word boundary when there is one, with "…". */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 3 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The pipeline cuts the badwords and laughs record texts at this many characters (RECORD_CHARS in scripts/web/language.py). */
export const RECORD_CHARS = 300;

/**
 * A record text as the pipeline published it: one that reaches RECORD_CHARS was cut there,
 * possibly mid-word, so it is clipped back to a word boundary with "…"; shorter texts are whole.
 */
export function clipRecord(text: string): string {
  return text.length >= RECORD_CHARS ? clip(text, RECORD_CHARS - 1) : text;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Splits `text` into [before, match, after] around the first occurrence of `phrase`,
 * ignoring case and accents (muletillas are stored normalized); null when absent.
 */
export function splitMatch(text: string, phrase: string): [string, string, string] | null {
  // Fold char by char so indexes in the folded string map back to the original.
  const chars = Array.from(text);
  let folded = "";
  const starts: number[] = [];
  let offset = 0;
  for (const c of chars) {
    const f = fold(c);
    for (let k = 0; k < f.length; k++) starts.push(offset);
    folded += f;
    offset += c.length;
  }
  const needle = fold(phrase);
  const at = needle ? folded.indexOf(needle) : -1;
  if (at === -1) return null;
  const from = starts[at]!;
  const lastChar = starts[at + needle.length - 1]!;
  const to = lastChar + (Array.from(text.slice(lastChar))[0]?.length ?? 1);
  return [text.slice(0, from), text.slice(from, to), text.slice(to)];
}

/** Who writes the longest jaja on average. */
export function longestJaja(
  byPerson: LanguageData["laughs"]["byPerson"],
): LanguageData["laughs"]["byPerson"][number] | null {
  return byPerson.reduce<LanguageData["laughs"]["byPerson"][number] | null>(
    (best, r) => (!best || r.avgJa > best.avgJa ? r : best),
    null,
  );
}
