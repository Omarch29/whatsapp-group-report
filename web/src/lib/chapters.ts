import type { Metadata } from "next";
import { copy } from "../../content/copy";
import type { ChapterId } from "@/chapters";

/** A navigable block inside a chapter; `id` doubles as DOM id, anchor and data key. */
export type BlockRef = { id: string; title: string };

/**
 * One chapter of the report. `id` is fixed (the Spanish slug; code and data use it), `slug` is the public URL
 * segment in the build's language. Introducción has id and slug "" and href "/".
 */
export type Chapter = { id: ChapterId; slug: string; title: string; href: string; blocks: readonly BlockRef[] };

function chapter(id: ChapterId, slug: string, title: string, blocks: readonly BlockRef[]): Chapter {
  // trailingSlash: true in next.config, so every non-root href ends with "/"
  return { id, slug, title, href: slug === "" ? "/" : `/${slug}/`, blocks };
}

const b = (id: string, title: string): BlockRef => ({ id, title });

/** Which optional chapters the data has something for (`loadChapterFlags` in data.ts). */
export type ChapterFlags = { departures: boolean; polls: boolean; mentions: boolean; audios: boolean };

/**
 * The chapters of a report, in reading order; salidas, encuestas and menciones only when the data has them, and
 * multimedia without its audios block when the chat has no audio.
 */
export function chaptersFor(flags: ChapterFlags): Chapter[] {
  return ALL_CHAPTERS.filter(
    (c) =>
      (c.id !== "salidas" || flags.departures) &&
      (c.id !== "encuestas" || flags.polls) &&
      (c.id !== "menciones" || flags.mentions),
  ).map((c) =>
    c.id === "multimedia" && !flags.audios ? { ...c, blocks: c.blocks.filter((blk) => blk.id !== "audios") } : c,
  );
}

/** Introducción, then every chapter of the copy (titles and blocks in the build's language). */
const ALL_CHAPTERS: readonly Chapter[] = [
  chapter("", "", copy.intro.title, [b("intro", copy.intro.title)]),
  // copy ids are CHAPTER_IDS (chapters.test.ts checks it).
  ...copy.chapters.map((c) => chapter(c.id as ChapterId, c.slug, c.title, c.blocks)),
];

/**
 * The one param the chapter and profile routes generate in single mode, where they have no page: Next 16 refuses an
 * empty `generateStaticParams` under `output: "export"`. It is neither a chapter slug nor a person slug (those are
 * [a-z0-9-]), so both routes answer it with notFound().
 */
export const SINGLE_PLACEHOLDER = "_";

/** Every chapter, for tests and static typing; the running site uses `chaptersFor(flags)`. */
export const CHAPTERS: readonly Chapter[] = chaptersFor({ departures: true, polls: true, mentions: true, audios: true });

/**
 * Every anchored block of a profile (/p/[slug]/), in page order: the sidebar's «Este perfil» anchors.
 * Each title is the block's heading on the page (the v1 sections keep their copy.*.title).
 */
export const PROFILE_BLOCKS: readonly BlockRef[] = copy.profile.blocks;

/** 0-based position of the public `slug` in `chapters`, or -1 when it is not there (unknown, or switched off). */
export function chapterIndex(chapters: readonly Chapter[], slug: string): number {
  return chapters.findIndex((c) => c.slug === slug);
}

/** A chapter's title and blocks by public slug; static, so independent of which chapters are switched on. */
export function chapterBySlug(slug: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.slug === slug);
}

/** A chapter by id; static, like `chapterBySlug`. Throws on an id that is not a chapter. */
export function chapterById(id: ChapterId): Chapter {
  const chapter = CHAPTERS.find((c) => c.id === id);
  if (!chapter) throw new Error(`Unknown chapter id: ${id}`);
  return chapter;
}

/** Where a chapter lives in this build's language: "censo" → "/censo/" in es, "/census/" in en; "" → "/". */
export function chapterHref(id: ChapterId): string {
  return chapterById(id).href;
}

/** The chapter id behind a public slug of this build ("census" → "censo" in en), or undefined. */
export function chapterIdFromSlug(slug: string): ChapterId | undefined {
  return chapterBySlug(slug)?.id;
}

/** Previous and next chapters in `chapters`; either is undefined at the ends (or for a slug not in it). */
export function neighbors(chapters: readonly Chapter[], slug: string): { prev?: Chapter; next?: Chapter } {
  const i = chapterIndex(chapters, slug);
  if (i === -1) return {};
  return { prev: chapters[i - 1], next: chapters[i + 1] };
}

/**
 * A link written by the pipeline, which names chapters by id ("/eventos/#rail"), in this build's slugs
 * ("/events/#rail" in en). Profiles and anything that is not a chapter pass through unchanged.
 */
export function localHref(href: string): string {
  const m = /^\/([^/#?]+)\/(.*)$/.exec(href);
  const chapter = m ? CHAPTERS.find((c) => c.id === m[1]) : undefined;
  return m && chapter ? `${chapter.href}${m[2]}` : href;
}

/** `<title>` of a chapter route: "La carrera · Los del Parque". */
export function chapterMetadata(id: ChapterId, title: string): Metadata {
  return { title: `${chapterById(id).title} · ${title}` };
}
