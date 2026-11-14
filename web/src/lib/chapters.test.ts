import { afterEach, describe, expect, it, vi } from "vitest";
import { copyFor } from "../../i18n";
import { CHAPTER_IDS, type ChapterId } from "@/chapters";
import {
  CHAPTERS,
  chapterById,
  chapterBySlug,
  chapterHref,
  chapterIdFromSlug,
  chapterIndex,
  chapterMetadata,
  chaptersFor,
  localHref,
  neighbors,
  PROFILE_BLOCKS,
} from "./chapters";

const ON = { departures: true, polls: true, mentions: true, audios: true };

describe("chapters registry", () => {
  it("has 18 chapters in spec order with unique slugs and hrefs", () => {
    expect(CHAPTERS.map((c) => c.slug)).toEqual(["", "censo", "carrera", "horas", "parejas", "lenguaje", "multimedia",
      "emojis", "encuestas", "ritmo", "menciones", "salidas", "eventos", "records", "diccionario", "premios", "personas", "conclusion"]);
    expect(new Set(CHAPTERS.map((c) => c.href)).size).toBe(18);
    expect(CHAPTERS[0].href).toBe("/");
    expect(CHAPTERS[1].href).toBe("/censo/");
  });

  it("neighbors are consistent at the ends", () => {
    expect(neighbors(CHAPTERS, "").prev).toBeUndefined();
    expect(neighbors(CHAPTERS, "").next?.slug).toBe("censo");
    expect(neighbors(CHAPTERS, "conclusion").next).toBeUndefined();
    expect(neighbors(CHAPTERS, "conclusion").prev?.slug).toBe("personas");
  });

  it("hides salidas and encuestas when the data says so", () => {
    const slugs = chaptersFor({ ...ON, departures: false, polls: false }).map((c) => c.slug);
    expect(slugs).not.toContain("salidas");
    expect(slugs).not.toContain("encuestas");
    expect(chaptersFor(ON).map((c) => c.slug)).toContain("salidas");
  });

  it("switches each optional chapter on its own flag and keeps reading order", () => {
    const all = CHAPTERS.map((c) => c.slug);
    expect(chaptersFor({ ...ON, polls: false }).map((c) => c.slug)).toEqual(all.filter((s) => s !== "encuestas"));
    expect(chaptersFor({ ...ON, departures: false }).map((c) => c.slug)).toEqual(all.filter((s) => s !== "salidas"));
    expect(chaptersFor(ON)).toEqual(CHAPTERS);
  });

  it("drops menciones when nobody was mentioned, keeping reading order", () => {
    const all = CHAPTERS.map((c) => c.slug);
    const slugs = chaptersFor({ ...ON, mentions: false }).map((c) => c.slug);
    expect(slugs).not.toContain("menciones");
    expect(slugs).toEqual(all.filter((s) => s !== "menciones"));
  });

  it("drops the audios block (and only it) from multimedia when the chat has no audio", () => {
    const withAudios = chaptersFor(ON).find((c) => c.slug === "multimedia")!;
    const without = chaptersFor({ ...ON, audios: false }).find((c) => c.slug === "multimedia")!;
    expect(withAudios.blocks.map((b) => b.id)).toContain("audios");
    expect(without.blocks.map((b) => b.id)).toEqual(withAudios.blocks.map((b) => b.id).filter((id) => id !== "audios"));
    expect(chaptersFor({ ...ON, audios: false })).toHaveLength(CHAPTERS.length);
  });

  it("neighbors and indexes follow the enabled chapters, not the full list", () => {
    const chapters = chaptersFor({ ...ON, departures: false, polls: false });
    expect(chapters).toHaveLength(CHAPTERS.length - 2);
    expect(neighbors(chapters, "menciones").next?.slug).toBe("eventos");
    expect(neighbors(chapters, "emojis").next?.slug).toBe("ritmo");
    expect(chapterIndex(chapters, "salidas")).toBe(-1);
    expect(chapterIndex(chapters, "conclusion")).toBe(chapters.length - 1);
  });

  it("titles a chapter route with the report's own title", () => {
    expect(chapterMetadata("carrera", "Los del Parque")).toEqual({ title: "La carrera · Los del Parque" });
    expect(chapterMetadata("salidas", "The Park Crew")).toEqual({ title: "Las salidas · The Park Crew" });
    expect(() => chapterMetadata("nope" as ChapterId, "x")).toThrow("Unknown chapter id");
  });

  it("gives every chapter its internal id: the Spanish slugs, in CHAPTER_IDS order", () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(["", ...CHAPTER_IDS]);
    expect(CHAPTER_IDS).toEqual(["censo", "carrera", "horas", "parejas", "lenguaje", "multimedia", "emojis",
      "encuestas", "ritmo", "menciones", "salidas", "eventos", "records", "diccionario", "premios", "personas", "conclusion"]);
  });

  it("maps ids to hrefs and public slugs back to ids", () => {
    expect(chapterHref("")).toBe("/");
    expect(chapterHref("censo")).toBe("/censo/");
    expect(chapterIdFromSlug("")).toBe("");
    expect(chapterIdFromSlug("menciones")).toBe("menciones");
    expect(chapterIdFromSlug("nope")).toBeUndefined();
    expect(chapterIdFromSlug("p")).toBeUndefined();
    expect(chapterById("lenguaje").title).toBe("Lenguaje");
    expect(() => chapterById("nope" as ChapterId)).toThrow("Unknown chapter id");
  });

  it("keeps the pipeline's chapter links as they are in a Spanish build", () => {
    expect(localHref("/eventos/#rail")).toBe("/eventos/#rail");
    expect(localHref("/salidas/")).toBe("/salidas/");
    expect(localHref("/p/ana/")).toBe("/p/ana/");
  });

  it("every chapter has at least one block with unique ids", () => {
    for (const c of CHAPTERS) {
      expect(c.blocks.length).toBeGreaterThan(0);
      expect(new Set(c.blocks.map((b) => b.id)).size).toBe(c.blocks.length);
    }
    expect(chapterBySlug("lenguaje")?.blocks.map((b) => b.id)).toContain("muletillas");
  });

  it("looks up by slug and index, and handles unknown slugs", () => {
    expect(chapterBySlug("")?.title).toBe("Introducción");
    expect(chapterBySlug("nope")).toBeUndefined();
    expect(chapterIndex(CHAPTERS, "")).toBe(0);
    expect(chapterIndex(CHAPTERS, "conclusion")).toBe(17);
    expect(chapterIndex(CHAPTERS, "nope")).toBe(-1);
    expect(neighbors(CHAPTERS, "nope")).toEqual({});
  });

  it("lists the profile blocks in page order with unique ids and titles", () => {
    expect(PROFILE_BLOCKS.map((b) => b.id)).toEqual([
      "race", "heatmap", "graph", "cloud", "rail",
      "muletillas", "repeated", "laughed", "laughs", "signature", "kinds", "mentions", "latency", "premios",
    ]);
    expect(PROFILE_BLOCKS.every((b) => b.title.length > 0)).toBe(true);
    expect(new Set(PROFILE_BLOCKS.map((b) => b.id)).size).toBe(PROFILE_BLOCKS.length);
  });
});

describe("chapters registry in an English build", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /** lib/chapters as an English build sees it (content/copy.ts reads NEXT_PUBLIC_WGR_LANG at import). */
  async function english() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_WGR_LANG", "en");
    return import("./chapters");
  }

  it("serves every chapter under its English slug, keeping the Spanish ids", async () => {
    const en = await english();
    const slugs = ["census", "race", "hours", "pairs", "language", "media", "emojis", "polls", "rhythm", "mentions",
      "departures", "events", "records", "dictionary", "awards", "people", "conclusion"];
    expect(copyFor("en").chapters.map((c) => c.slug)).toEqual(slugs);
    expect(en.CHAPTERS.map((c) => c.slug)).toEqual(["", ...slugs]);
    expect(en.CHAPTERS.map((c) => c.id)).toEqual(["", ...CHAPTER_IDS]);
    expect(en.CHAPTERS.map((c) => c.href)).toEqual(["/", ...slugs.map((s) => `/${s}/`)]);
    expect(en.chapterHref("censo")).toBe("/census/");
    expect(en.chapterHref("")).toBe("/");
    expect(en.chapterIdFromSlug("census")).toBe("censo");
    expect(en.chapterIdFromSlug("censo")).toBeUndefined();
    expect(en.chapterBySlug("media")?.title).toBe(copyFor("en").chapters.find((c) => c.id === "multimedia")!.title);
    expect(en.chapterIndex(en.CHAPTERS, "census")).toBe(1);
  });

  it("moves the pipeline's chapter links (by id) to the English slugs, leaving profiles alone", async () => {
    const en = await english();
    expect(en.localHref("/eventos/#rail")).toBe("/events/#rail");
    expect(en.localHref("/salidas/")).toBe("/departures/");
    expect(en.localHref("/p/ana/")).toBe("/p/ana/");
    expect(en.localHref("/")).toBe("/");
  });

  it("switches the optional chapters off by id, whatever their slug", async () => {
    const en = await english();
    const off = en.chaptersFor({ ...ON, departures: false, polls: false, mentions: false, audios: false });
    expect(off.map((c) => c.slug)).toEqual(en.CHAPTERS.map((c) => c.slug).filter((s) => !["departures", "polls", "mentions"].includes(s)));
    expect(off.find((c) => c.id === "multimedia")!.blocks.map((b) => b.id)).not.toContain("audios");
  });

  it("titles a chapter route in English", async () => {
    const en = await english();
    const race = copyFor("en").chapters.find((c) => c.id === "carrera")!.title;
    expect(en.chapterMetadata("carrera", "The Park Crew")).toEqual({ title: `${race} · The Park Crew` });
  });
});
