import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fx } from "@/test/fixtures";
import {
  chapterFlagsOf,
  DATA_DIR,
  getTitle,
  listPeopleSlugs,
  loadAwards,
  loadCensus,
  loadChapterFlags,
  loadDepartures,
  loadEmojis,
  loadEvents,
  loadFacts,
  loadGlobal,
  loadLanguage,
  loadLore,
  loadMedia,
  loadMentions,
  loadPerson,
  loadPolls,
  loadRecords,
  loadRhythm,
} from "./data";
import { fmt, fmtDate, fmtHours } from "./format";
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
} from "./schema";

describe("data loaders (real web/data files)", () => {
  it("validates real JSON files", async () => {
    const g = await loadGlobal();
    expect(g.people[0].msgs).toBeGreaterThan(0);
    expect(g.people.filter((p) => p.slug !== "resto")).toHaveLength(9);
    const slugs = await listPeopleSlugs();
    expect(slugs).not.toContain("resto");
    expect(slugs).toHaveLength(9);
    const p = await loadPerson(slugs[0]);
    expect(p.heatmap).toHaveLength(7);
  });

  it("lists exactly the people that have a profile file, without resto", async () => {
    const files = await readdir(path.join(DATA_DIR, "people"));
    const onDisk = files.map((f) => f.replace(/\.json$/, "")).sort();
    const slugs = await listPeopleSlugs();
    expect([...slugs].sort()).toEqual(onDisk);
    for (const slug of slugs) {
      const p = await loadPerson(slug);
      expect(p.slug).toBe(slug);
      expect(p.heatmap.every((row) => row.length === 24)).toBe(true);
    }
  });

  it("loads events, records, lore, departures and facts", async () => {
    const [events, records, lore, departures, facts] = await Promise.all([
      loadEvents(),
      loadRecords(),
      loadLore(),
      loadDepartures(),
      loadFacts(),
    ]);
    // web/data/example is the 8,000-line synthetic chat (scripts/synth_chat.py, seed 7, es, iOS).
    expect(events.map((e) => e.id)).toEqual(["el-asado", "la-final", "cumple-caro"]);
    expect(records.funniest.length).toBeGreaterThan(0);
    expect(lore.length).toBeGreaterThanOrEqual(8);
    expect(lore.map((t) => t.w)).toContain("zorzalear");
    // Names are never lore: no alias, short name or nickname word.
    for (const name of ["brujo", "bruno", "tomate", "rulo", "carola", "capitana"]) expect(lore.map((t) => t.w)).not.toContain(name);
    expect(departures.person).toEqual({ slug: "bruno", name: "Bruno" });
    expect(departures.reentries).toBe(3);
    expect(facts.totalMsgs).toBe((await loadGlobal()).totals.msgs);
  });

  it("validates every real chapter file", async () => {
    const [census, language, media, emojis, polls, rhythm, mentions, awards] = await Promise.all([
      loadCensus(),
      loadLanguage(),
      loadMedia(),
      loadEmojis(),
      loadPolls(),
      loadRhythm(),
      loadMentions(),
      loadAwards(),
    ]);
    expect(awards).toHaveLength(12);
    expect(census.timeline.length).toBeGreaterThan(0);
    expect(Object.keys(language.muletillas).length).toBeGreaterThan(0);
    expect(media.audios.byHour).toHaveLength(24);
    expect(emojis.top[0]).toEqual({ e: "😂", n: 190, topUser: "flor" });
    expect(emojis.signature.length).toBeGreaterThan(0);
    expect(emojis.byYear.length).toBeGreaterThan(0);
    expect(polls.total).toBe(6);
    expect(rhythm.rings.dow).toHaveLength(7);
    expect(mentions.matrix).toHaveLength(mentions.slugs.length);
  });

  it("reads the report title and the chapter flags from the data", async () => {
    expect(await getTitle()).toBe("Los del Parque");
    expect((await loadGlobal()).lang).toBe("es");
    // The synthetic chat has a departer, six polls, a most mentioned person and audios (iOS).
    expect(await loadChapterFlags()).toEqual({ departures: true, polls: true, mentions: true, audios: true });
  });

  it("derives each optional-chapter flag from its own file", () => {
    const { departures, polls, mentions, media } = fx;
    expect(chapterFlagsOf({ departures, polls, mentions, media })).toEqual({
      departures: true, polls: true, mentions: true, audios: true,
    });
    const noAudio = { ...media, audios: { byPerson: [], byHour: Array.from({ length: 24 }, () => 0), byYear: { years: [], n: [] } } };
    const none = { ...mentions, mostMentioned: null, topTagger: null };
    expect(chapterFlagsOf({ departures: { ...departures, person: null }, polls: { ...polls, total: 0 }, mentions: none, media: noAudio }))
      .toEqual({ departures: false, polls: false, mentions: false, audios: false });
  });

  it("rejects slugs that are not plain lowercase identifiers", async () => {
    await expect(loadPerson("../global")).rejects.toThrow();
  });
});

describe("schemas", () => {
  it("throw on a shape mismatch", () => {
    const broken = { ...fx.facts, peakHour: "11" };
    expect(() => factsSchema.parse(broken)).toThrow();
  });

  it("accept null poll and latestNight", () => {
    expect(() =>
      recordsSchema.parse({ ...fx.records, poll: null, latestNight: null }),
    ).not.toThrow();
  });

  const noDeparter = {
    person: null,
    reentries: 0,
    byMonth: [],
    medianOutHours: 0,
    under10Min: 0,
    over1Day: 0,
    maxDays: 0,
    addedBy: [],
    scenes: { days: 0, withExit: 0, byYear: {} },
    complaints: [],
    complaintLabel: 'veces escribió "No me invitó"',
    complaintCount: 0,
    quotesRepeated: [],
    quotesAttributed: [],
  };

  it("accept a report with no departer and no polls", () => {
    expect(() => departuresSchema.parse(noDeparter)).not.toThrow();
    const facts = { ...fx.facts, departerOvertakeMonth: null, departerMonthsToTop: null, departerPeakMonths: [] };
    expect(() => factsSchema.parse(facts)).not.toThrow();
    const noPolls = { byPerson: [], total: 0, mostVoted: [], unanimous: [], divided: [] };
    expect(() => pollsSchema.parse(noPolls)).not.toThrow();
  });

  it("reject an empty departer name, an unknown language, an unknown timeline kind and a facts file without the departer keys", () => {
    expect(() => departuresSchema.parse({ ...noDeparter, person: { slug: "x", name: "" } })).toThrow();
    expect(() => globalSchema.parse({ ...fx.global, lang: "fr" })).toThrow();
    expect(() => globalSchema.parse({ ...fx.global, title: "" })).toThrow();
    const census = { ...fx.census, timeline: [{ ...fx.census.timeline[0], kind: "unknown" }] };
    expect(() => censusSchema.parse(census)).toThrow();
    const old: Record<string, unknown> = { ...fx.facts };
    delete old.departerPeakMonths;
    expect(() => factsSchema.parse(old)).toThrow();
  });

  it("validate every fixture", () => {
    expect(() => globalSchema.parse(fx.global)).not.toThrow();
    expect(() => personDataSchema.parse(fx.person)).not.toThrow();
    expect(() => eventsSchema.parse(fx.events)).not.toThrow();
    expect(() => recordsSchema.parse(fx.records)).not.toThrow();
    expect(() => loreSchema.parse(fx.lore)).not.toThrow();
    expect(() => departuresSchema.parse(fx.departures)).not.toThrow();
    expect(() => factsSchema.parse(fx.facts)).not.toThrow();
    expect(() => censusSchema.parse(fx.census)).not.toThrow();
    expect(() => languageSchema.parse(fx.language)).not.toThrow();
    expect(() => mediaSchema.parse(fx.media)).not.toThrow();
    expect(() => emojisSchema.parse(fx.emojis)).not.toThrow();
    expect(() => pollsSchema.parse(fx.polls)).not.toThrow();
    expect(() => rhythmSchema.parse(fx.rhythm)).not.toThrow();
    expect(() => mentionsSchema.parse(fx.mentions)).not.toThrow();
    expect(() => awardsSchema.parse(fx.awards)).not.toThrow();
  });

  it("accept laugh classes as a list, the multimedia kind, platform fields and a chat without audio", () => {
    const en = [{ key: "haha", label: "haha", n: 3 }, { key: "emoji", label: "😂", n: 1 }];
    const language = { ...fx.language, laughs: { ...fx.language.laughs, byPerson: [{ slug: "tomi", mix: en, avgJa: 0 }] } };
    expect(() => languageSchema.parse(language)).not.toThrow();
    expect(() => globalSchema.parse({ ...fx.global, platform: "android", timeResolution: "minute" })).not.toThrow();
    const kinds = { ...fx.media.kinds, kinds: [...fx.media.kinds.kinds, "media"] };
    expect(() => mediaSchema.parse({ ...fx.media, kinds })).not.toThrow();
    const noAudio = { byPerson: [], byHour: Array.from({ length: 24 }, () => 0), byYear: { years: [], n: [] } };
    expect(() => mediaSchema.parse({ ...fx.media, audios: noAudio })).not.toThrow();
  });

  it("accept mode and gate, and reject an unknown mode, a missing gate and a colour index past the 12-colour palette", () => {
    expect(() => globalSchema.parse({ ...fx.global, mode: "single", gate: false })).not.toThrow();
    expect(() => globalSchema.parse({ ...fx.global, mode: "both" })).toThrow();
    const noGate = Object.fromEntries(Object.entries(fx.global).filter(([k]) => k !== "gate"));
    expect(() => globalSchema.parse(noGate)).toThrow();
    const person = (colorIndex: number) => ({ ...fx.global.people[0], colorIndex });
    expect(() => globalSchema.parse({ ...fx.global, people: [person(11)] })).not.toThrow();
    expect(() => globalSchema.parse({ ...fx.global, people: [person(12)] })).toThrow();
  });

  it("reject the old strict laugh mix, an empty mix, an unknown platform and a departures file without the chip fields", () => {
    const row = { slug: "tomi", avgJa: 0 };
    const withMix = (mix: unknown) => ({ ...fx.language, laughs: { ...fx.language.laughs, byPerson: [{ ...row, mix }] } });
    expect(() => languageSchema.parse(withMix({ jaja: 1, jsjs: 0, jeje: 0, jiji: 0, xd: 0, emoji: 0 }))).toThrow();
    expect(() => languageSchema.parse(withMix([]))).toThrow();
    expect(() => languageSchema.parse(withMix([{ key: "haha", label: "", n: 1 }]))).toThrow();
    expect(() => globalSchema.parse({ ...fx.global, platform: "windows" })).toThrow();
    expect(() => globalSchema.parse({ ...fx.global, timeResolution: "hour" })).toThrow();
    const without = (key: string) => Object.fromEntries(Object.entries(fx.departures).filter(([k]) => k !== key));
    expect(() => departuresSchema.parse(without("complaintLabel"))).toThrow();
    expect(() => departuresSchema.parse(without("complaintCount"))).toThrow();
  });

  it("accept the nullable edges of the new chapters", () => {
    expect(() =>
      censusSchema.parse({ ...fx.census, names: { longest: null, shortest: null }, absence: null, earlyBird: null, owl: null }),
    ).not.toThrow();
    expect(() => rhythmSchema.parse({ ...fx.rhythm, fastest: null })).not.toThrow();
    expect(() => mentionsSchema.parse({ ...fx.mentions, mostMentioned: null, topTagger: null })).not.toThrow();
  });

  it("reject inconsistent series, matrices and award ids", () => {
    const years = fx.census.byYear.years;
    expect(() =>
      censusSchema.parse({ ...fx.census, byYear: { years, series: { tomi: [1] } } }),
    ).toThrow();
    expect(() =>
      mentionsSchema.parse({ ...fx.mentions, matrix: fx.mentions.matrix.slice(1) }),
    ).toThrow();
    expect(() =>
      mentionsSchema.parse({ ...fx.mentions, matrix: fx.mentions.matrix.map((r) => r.slice(1)) }),
    ).toThrow();
    expect(() => awardsSchema.parse([...fx.awards].reverse())).toThrow();
    expect(() => awardsSchema.parse(fx.awards.slice(1))).toThrow();
    const withoutMsgs = fx.awards.filter((a) => a.id !== "msgs");
    expect(() => awardsSchema.parse(withoutMsgs)).toThrow();
  });

  it("accept the 11 awards of a minute-resolution chat (no fastest)", () => {
    const eleven = fx.awards.filter((a) => a.id !== "fastest");
    expect(eleven).toHaveLength(11);
    expect(() => awardsSchema.parse(eleven)).not.toThrow();
    expect(() => factsSchema.parse({ ...fx.facts, fastest: null, awardsCount: 11 })).not.toThrow();
  });

  it("keeps the language fixture shaped for empty-state tests", () => {
    expect(fx.language.muletillas.tomi).toHaveLength(10);
    expect(fx.language.muletillas.ana).toHaveLength(3);
    expect(fx.language.muletillas.nico).toHaveLength(0);
    expect(fx.awards).toHaveLength(12);
    expect(fx.awards.filter((a) => a.winner === null)).toHaveLength(1);
  });
});

describe("format", () => {
  it("fmt uses es-AR grouping", () => {
    expect(fmt(12345)).toBe("12.345");
    expect(fmtHours(3.2)).toBe("3,2 h");
  });

  it("groups four-digit numbers too", () => {
    expect(fmt(4860)).toBe("4.860");
    expect(fmt(12)).toBe("12");
  });

  it("fmtDate renders dd/mm/yyyy from a date or datetime", () => {
    expect(fmtDate("2025-12-22")).toBe("22/12/2025");
    expect(fmtDate("2026-03-09T20:17:43")).toBe("09/03/2026");
  });
});
