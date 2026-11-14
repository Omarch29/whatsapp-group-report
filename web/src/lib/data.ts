import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  awardsSchema,
  censusSchema,
  departuresSchema,
  emojisSchema,
  eventsSchema,
  factsSchema,
  globalSchema,
  languageSchema,
  loreSchema,
  mediaSchema,
  mentionsSchema,
  personDataSchema,
  pollsSchema,
  recordsSchema,
  rhythmSchema,
  type AwardsData,
  type CensusData,
  type DeparturesData,
  type EmojisData,
  type EventData,
  type Facts,
  type GlobalData,
  type LanguageData,
  type LoreTerm,
  type MediaData,
  type MentionsData,
  type PersonData,
  type PollsData,
  type RecordsData,
  type RhythmData,
} from "./schema";
import type { ChapterFlags } from "./chapters";
import { resolveDataDir, warnOnce } from "./dataDir";
import type { Nicknames } from "./nicknames";

export { resolveDataDir };

// Build-time only: reads web/data (cwd is web/ for `next build` and vitest); a fresh clone builds the example.
export const DATA_DIR = resolveDataDir(path.join(process.cwd(), "data"));

const ROOT_CONTENT = path.resolve(process.cwd(), "..", "content");

/** The files that make up a group's content; content/ is "written" as soon as it holds any of them. */
export const CONTENT_FILES = ["people.json", "nicknames.json", "badwords.txt", "conclusion.md"] as const;

/**
 * Build-time only: the editable content (nicknames.json, conclusion.md) lives at the repo root, next to web/.
 * Tests point WGR_CONTENT_DIR at tests/fixtures/content (vitest.config.ts).
 */
export const CONTENT_DIR = process.env.WGR_CONTENT_DIR ?? ROOT_CONTENT;

/**
 * A content file. WGR_CONTENT_DIR set: always <WGR_CONTENT_DIR>/<file>. Otherwise content/ is read strictly when it
 * holds any content file (a missing one is then an error, not a silent switch to the example), and the fictional
 * content/example/ is used, with a warning, only when content/ holds none of them.
 */
export function resolveContentFile(file: string, root: string = ROOT_CONTENT,
  envDir: string | null = process.env.WGR_CONTENT_DIR ?? null): string {
  if (envDir) return path.join(envDir, file);
  if (CONTENT_FILES.some((f) => existsSync(path.join(root, f)))) return path.join(root, file);
  const example = path.join(root, "example");
  warnOnce(`${root} has no content files: using the fictional ${example}; ask your AI agent to write your own (root README.md, "Six steps")`);
  return path.join(example, file);
}

/** Aggregated "everyone else" row in global.people; not a person, has no profile. */
export const RESTO_SLUG = "resto";

async function readJson<T>(rel: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await readFile(path.join(DATA_DIR, rel), "utf8");
  const parsed = schema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`${path.join(DATA_DIR, rel)} does not match its schema:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export function loadGlobal(): Promise<GlobalData> {
  return readJson("global.json", globalSchema);
}

/** The report title from report.config.json, as published in global.json. */
export async function getTitle(): Promise<string> {
  return (await loadGlobal()).title;
}

/** The report's mode from report.config.json, as published in global.json: one long page, or chapters and profiles. */
export async function loadMode(): Promise<GlobalData["mode"]> {
  return (await loadGlobal()).mode;
}

const nicknamesSchema = z.record(z.string(), z.string());

/** content/nicknames.json; no file means no nicknames. */
export async function loadNicknames(): Promise<Nicknames> {
  let raw: string;
  try {
    raw = await readFile(resolveContentFile("nicknames.json"), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
  return nicknamesSchema.parse(JSON.parse(raw));
}

export function loadPerson(slug: string): Promise<PersonData> {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return Promise.reject(new Error(`invalid person slug: ${JSON.stringify(slug)}`));
  }
  return readJson(`people/${slug}.json`, personDataSchema);
}

export function loadEvents(): Promise<EventData[]> {
  return readJson("events.json", eventsSchema);
}

export function loadRecords(): Promise<RecordsData> {
  return readJson("records.json", recordsSchema);
}

export function loadLore(): Promise<LoreTerm[]> {
  return readJson("lore.json", loreSchema);
}

export function loadDepartures(): Promise<DeparturesData> {
  return readJson("departures.json", departuresSchema);
}

export function loadFacts(): Promise<Facts> {
  return readJson("facts.json", factsSchema);
}

export function loadCensus(): Promise<CensusData> {
  return readJson("census.json", censusSchema);
}

export function loadLanguage(): Promise<LanguageData> {
  return readJson("language.json", languageSchema);
}

export function loadMedia(): Promise<MediaData> {
  return readJson("media.json", mediaSchema);
}

export function loadEmojis(): Promise<EmojisData> {
  return readJson("emojis.json", emojisSchema);
}

export function loadPolls(): Promise<PollsData> {
  return readJson("polls.json", pollsSchema);
}

export function loadRhythm(): Promise<RhythmData> {
  return readJson("rhythm.json", rhythmSchema);
}

export function loadMentions(): Promise<MentionsData> {
  return readJson("mentions.json", mentionsSchema);
}

export function loadAwards(): Promise<AwardsData> {
  return readJson("awards.json", awardsSchema);
}

/**
 * Which optional chapters (and blocks) the data has something for, from the files that decide each one.
 * scripts/check_report.py mirrors these rules to tell the skill which chapters are off: keep both in step.
 */
export function chapterFlagsOf(d: {
  departures: DeparturesData;
  polls: PollsData;
  mentions: MentionsData;
  media: MediaData;
}): ChapterFlags {
  return {
    departures: d.departures.person !== null,
    polls: d.polls.total > 0,
    mentions: d.mentions.mostMentioned !== null,
    audios: d.media.audios.byPerson.length > 0,
  };
}

/** Chapters that only exist when the data has something for them (see `chaptersFor`). */
export async function loadChapterFlags(): Promise<ChapterFlags> {
  const [departures, polls, mentions, media] = await Promise.all([
    loadDepartures(),
    loadPolls(),
    loadMentions(),
    loadMedia(),
  ]);
  return chapterFlagsOf({ departures, polls, mentions, media });
}

/** Slugs with a profile page, in global.people order, excluding `resto`. */
export async function listPeopleSlugs(): Promise<string[]> {
  const g = await loadGlobal();
  return g.people.map((p) => p.slug).filter((s) => s !== RESTO_SLUG);
}
