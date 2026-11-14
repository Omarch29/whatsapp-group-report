import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// The data dir, resolved without React or Next imports: next.config.ts (plain Node) and data.ts share it.

const warned = new Set<string>();

/** console.warn once per distinct message (one line each), so a build that reads many files does not repeat itself. */
export function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/**
 * The data dir: WGR_DATA_DIR when set (tests pin it to web/data/example); else web/data when the pipeline wrote it
 * (global.json exists); else the committed fictional web/data/example, with a warning.
 */
export function resolveDataDir(webData: string, envDir: string | null = process.env.WGR_DATA_DIR ?? null): string {
  if (envDir) return envDir;
  if (existsSync(path.join(webData, "global.json"))) return webData;
  const example = path.join(webData, "example");
  warnOnce(`${webData} has no global.json: building the fictional example data (${example}); run the pipeline for your own report`);
  return example;
}

export type BuildSettings = { lang: "es" | "en"; mode: "single" | "full" };

/**
 * The build-wide choices in `<dataDir>/global.json` (next.config.ts turns them into NEXT_PUBLIC_WGR_*). A data dir
 * without global.json builds in Spanish as a full report; data.ts then reports the missing data on its own.
 */
export function buildSettings(dataDir: string): BuildSettings {
  const file = path.join(dataDir, "global.json");
  if (!existsSync(file)) return { lang: "es", mode: "full" };
  const g = JSON.parse(readFileSync(file, "utf8")) as { lang?: unknown; mode?: unknown };
  return { lang: g.lang === "en" ? "en" : "es", mode: g.mode === "single" ? "single" : "full" };
}
