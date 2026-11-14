import { afterEach, describe, expect, it, vi } from "vitest";

/** format.ts as a build in `lang` sees it: the language is read once, when the copy module loads. */
async function formatIn(lang: "es" | "en") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_WGR_LANG", lang);
  return import("./format");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("format follows the build's locale", () => {
  it.each([
    ["es", "2.300", "36,3 %", "22/12/2025", "marzo de 2024", "1/9/2023", "3,2 h", "1,8 s"],
    ["en", "2,300", "36.3%", "12/22/2025", "March 2024", "9/1/2023", "3.2 h", "1.8 s"],
  ] as const)("%s", async (lang, n, share, date, month, short, hours, secs) => {
    const f = await formatIn(lang);
    expect(f.fmt(2300)).toBe(n);
    expect(f.fmtShare(0.363)).toBe(share);
    expect(f.fmtDate("2025-12-22")).toBe(date);
    expect(f.fmtDate("2025-12-22T20:17:43")).toBe(date);
    expect(f.fmtMonth("2024-03")).toBe(month);
    expect(f.fmtShortDate("2023-09-01")).toBe(short);
    expect(f.fmtHours(3.2)).toBe(hours);
    expect(f.fmtSeconds(1.8)).toBe(secs);
    expect(f.fmtSeconds(120)).toBe("2 min");
  });

  it("rejects what is not a date or a month", async () => {
    const f = await formatIn("es");
    expect(() => f.fmtDate("22/12/2020")).toThrow(/not an ISO date/);
    expect(() => f.fmtMonth("2024-13")).toThrow(/not a YYYY-MM month/);
  });
});
