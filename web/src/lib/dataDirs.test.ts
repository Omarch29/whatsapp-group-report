import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DATA_DIR, resolveContentFile, resolveDataDir } from "./data";
import { buildSettings } from "./dataDir";

function tmp(): string {
  return mkdtempSync(path.join(tmpdir(), "wgr-"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveDataDir", () => {
  it("WGR_DATA_DIR wins, even over a web/data the pipeline wrote", () => {
    const dir = tmp();
    writeFileSync(path.join(dir, "global.json"), "{}");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveDataDir(dir, "/pinned")).toBe("/pinned");
    expect(warn).not.toHaveBeenCalled();
  });

  it("uses web/data when the pipeline wrote global.json there", () => {
    const dir = tmp();
    writeFileSync(path.join(dir, "global.json"), "{}");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveDataDir(dir, null)).toBe(dir);
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to the committed example only when global.json is missing, and says so once", () => {
    const dir = tmp();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveDataDir(dir, null)).toBe(path.join(dir, "example"));
    expect(resolveDataDir(dir, null)).toBe(path.join(dir, "example"));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("global.json");
  });

  it("under vitest DATA_DIR is the pinned committed example, whatever sits in web/data", () => {
    expect(DATA_DIR).toBe(path.join(process.cwd(), "data", "example"));
  });
});

describe("buildSettings", () => {
  it("reads the build's language and mode from global.json", () => {
    const dir = tmp();
    writeFileSync(path.join(dir, "global.json"), JSON.stringify({ lang: "en", mode: "single", gate: false }));
    expect(buildSettings(dir)).toEqual({ lang: "en", mode: "single" });
  });

  it("the committed example builds in Spanish, as a full report", () => {
    expect(buildSettings(path.join(process.cwd(), "data", "example"))).toEqual({ lang: "es", mode: "full" });
  });

  it("never crashes on a data dir without global.json: Spanish, full", () => {
    expect(buildSettings(tmp())).toEqual({ lang: "es", mode: "full" });
  });
});

describe("resolveContentFile", () => {
  it("WGR_CONTENT_DIR wins and is strict: no fallback for a file it does not have", () => {
    const root = tmp();
    mkdirSync(path.join(root, "example"));
    writeFileSync(path.join(root, "example", "conclusion.md"), "x");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveContentFile("conclusion.md", root, "/elsewhere")).toBe(path.join("/elsewhere", "conclusion.md"));
    expect(warn).not.toHaveBeenCalled();
  });

  it("a content/ with some content files is read strictly: a missing one points at content/, not the example", () => {
    const root = tmp();
    mkdirSync(path.join(root, "example"));
    writeFileSync(path.join(root, "example", "conclusion.md"), "x");
    writeFileSync(path.join(root, "nicknames.json"), "{}");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveContentFile("nicknames.json", root, null)).toBe(path.join(root, "nicknames.json"));
    expect(resolveContentFile("conclusion.md", root, null)).toBe(path.join(root, "conclusion.md"));
    expect(warn).not.toHaveBeenCalled();
  });

  it("a content/ with none of the content files falls back to content/example, warning once", () => {
    const root = tmp();
    mkdirSync(path.join(root, "example"));
    writeFileSync(path.join(root, "events.json"), "[]"); // not one of the four content files
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveContentFile("nicknames.json", root, null)).toBe(path.join(root, "example", "nicknames.json"));
    expect(resolveContentFile("conclusion.md", root, null)).toBe(path.join(root, "example", "conclusion.md"));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(root);
  });
});
