import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../../i18n/en";
import { es } from "../../i18n/es";
import { FOREIGN, findLeaks } from "../../scripts/check-export-lang.mjs";

/** A fake `web/out`: one page and one client chunk. */
function out(html: string, chunk: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "wgr-out-"));
  mkdirSync(path.join(dir, "_next", "static", "chunks"), { recursive: true });
  writeFileSync(path.join(dir, "index.html"), html);
  writeFileSync(path.join(dir, "_next", "static", "chunks", "a.js"), chunk);
  return dir;
}

describe("check-export-lang", () => {
  it("a clean export passes", () => {
    expect(findLeaks(out("<p>Previous</p>", 'x="Chapter "'), "en")).toEqual([]);
    expect(findLeaks(out("<p>Anterior</p>", 'x="Capítulo "'), "es")).toEqual([]);
  });

  it("a word of the other language in a page or a client chunk fails, naming the file", () => {
    expect(findLeaks(out("<h1>Introducción</h1>", ""), "en")).toEqual(["index.html: Introducción"]);
    expect(findLeaks(out("", 'a="Copy link"'), "es")).toEqual([`${path.join("_next", "static", "chunks", "a.js")}: Copy link`]);
  });

  it("guards words the other language's copy really renders", () => {
    const strings = (c: unknown): string => JSON.stringify(c, (_, v) => (typeof v === "function" ? String(v) : v));
    for (const w of FOREIGN.en) expect(strings(es), w).toContain(w);
    for (const w of FOREIGN.es) expect(strings(en), w).toContain(w);
  });
});
