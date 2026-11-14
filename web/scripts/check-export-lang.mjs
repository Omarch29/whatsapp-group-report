// After `next build`: lists the exported files (web/out/**/*.html and the client chunks) that still carry UI words
// of the other language than the data's global.json.lang, and exits 1 if there is any. Same data dir as
// src/lib/dataDir.ts. The nav and pager render client-side, so the chunks are where most of the chrome lives.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Words of the other language's copy (web/i18n) that never come from the chat itself, by the build's language.
 * The English ones are whole phrases: bare "Previous" or "Next" also occur in the libraries' code (motion's getPrevious).
 */
export const FOREIGN = {
  en: ["Capítulo", "Anterior", "Siguiente", "Introducción", "mensajes"],
  es: ["Copy link", "Nothing to show yet", "Back to the start", "Other chapters", "Open chapters"],
};

function* files(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else yield p;
  }
}

/** "<file>: <words>" for every page or client chunk under `outDir` that carries a word of the other language. */
export function findLeaks(outDir, lang) {
  const chunks = path.join(outDir, "_next", "static", "chunks") + path.sep;
  const leaks = [];
  for (const file of files(outDir)) {
    if (!file.endsWith(".html") && !(file.endsWith(".js") && file.startsWith(chunks))) continue;
    const text = readFileSync(file, "utf8");
    const found = FOREIGN[lang].filter((w) => text.includes(w));
    if (found.length) leaks.push(`${path.relative(outDir, file)}: ${found.join(", ")}`);
  }
  return leaks;
}

function main() {
  const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const data = path.join(web, "data");
  const dataDir = process.env.WGR_DATA_DIR
    ? path.resolve(web, process.env.WGR_DATA_DIR)
    : existsSync(path.join(data, "global.json")) ? data : path.join(data, "example");
  const out = path.join(web, "out");
  if (!existsSync(out)) {
    console.error(`${out} does not exist: run the build first`);
    process.exit(1);
  }
  const lang = JSON.parse(readFileSync(path.join(dataDir, "global.json"), "utf8")).lang === "en" ? "en" : "es";
  const leaks = findLeaks(out, lang);
  if (leaks.length) {
    console.error(`${leaks.length} file(s) of this ${lang} build carry words of the other language:\n${leaks.join("\n")}`);
    process.exit(1);
  }
  console.log(`ok: no page or chunk of this ${lang} build carries words of the other language`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
