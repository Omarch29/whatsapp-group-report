import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// web/data/synth/<lang>[-android]/ is written by pytest (tests/conftest.py, synth_data): the full pipeline on the
// 8,000-line synthetic chat in each language. Gitignored; when pytest has not run, there is nothing to check.
const SYNTH = path.join(process.cwd(), "data", "synth");
const dirs = existsSync(SYNTH)
  ? readdirSync(SYNTH, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  : [];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** data.ts with DATA_DIR pinned to `dir` (DATA_DIR is resolved once, at import). */
async function loadersFor(dir: string): Promise<typeof import("./data")> {
  vi.resetModules();
  vi.stubEnv("WGR_DATA_DIR", dir);
  return import("./data");
}

describe.skipIf(dirs.length === 0)("synthetic pipeline output (web/data/synth)", () => {
  it.each(dirs)("%s: every loader in data.ts parses it", async (name) => {
    const dir = path.join(SYNTH, name);
    const data = await loadersFor(dir);
    expect(data.DATA_DIR).toBe(dir);
    const g = await data.loadGlobal();
    expect(g.lang).toBe(name.split("-")[0]);
    expect(g.platform).toBe(name.endsWith("-android") ? "android" : "ios");
    const slugs = await data.listPeopleSlugs();
    expect(slugs.length).toBeGreaterThanOrEqual(9);
    for (const slug of slugs) expect((await data.loadPerson(slug)).slug).toBe(slug);
    await Promise.all([
      data.getTitle(),
      data.loadEvents(),
      data.loadRecords(),
      data.loadLore(),
      data.loadDepartures(),
      data.loadFacts(),
      data.loadCensus(),
      data.loadLanguage(),
      data.loadMedia(),
      data.loadEmojis(),
      data.loadPolls(),
      data.loadRhythm(),
      data.loadMentions(),
      data.loadAwards(),
    ]);
    const audios = !name.endsWith("-android");
    expect(await data.loadChapterFlags()).toEqual({ departures: true, polls: true, mentions: true, audios });
  });
});
