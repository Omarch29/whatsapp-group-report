import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAFT_WARNING, loadConclusion, parseConclusion, warnIfDraft } from "./conclusion";

afterEach(() => vi.restoreAllMocks());

describe("conclusion", () => {
  it("splits on blank lines, joins wrapped lines and drops HTML comments", () => {
    const md = "<!-- BORRADOR: hay que reescribirlo -->\n\nUno\nsigue.\n\n\nDos.\n\n— Ana\n";
    expect(parseConclusion(md)).toEqual(["Uno sigue.", "Dos.", "— Ana"]);
  });

  it("warns at build time while the text is still the draft, and stays quiet once rewritten", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnIfDraft("<!-- BORRADOR: hay que reescribirlo -->\n\nTexto.");
    expect(warn).toHaveBeenCalledWith(DRAFT_WARNING);
    expect(DRAFT_WARNING).toBe("content/conclusion.md is still a draft (it says BORRADOR or DRAFT): rewrite it before publishing");
    warn.mockClear();
    warnIfDraft("DRAFT\nhello");
    expect(warn).toHaveBeenCalledWith(DRAFT_WARNING);
    warn.mockClear();
    warnIfDraft("Texto final.\n\n— Ana");
    expect(warn).not.toHaveBeenCalled();
  });

  it("reads content/conclusion.md: the final text signed by Ana, no draft warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const paragraphs = await loadConclusion();
    expect(warn).not.toHaveBeenCalled();
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(paragraphs.at(-1)).toBe("— Ana");
    expect(paragraphs.join(" ")).not.toContain("BORRADOR");
  });
});
