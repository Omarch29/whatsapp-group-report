import { describe, expect, it } from "vitest";
import { copyFor } from "../../i18n";
import { shotsFor } from "../../scripts/screenshots.mjs";

describe("screenshots", () => {
  it.each(["es", "en"] as const)("names the four shots in %s", (lang) => {
    const shots = shotsFor(lang);
    expect(shots.map((s) => s.name)).toEqual(["hero", "heatmap", "chapter", "single-mobile"]);
    expect(shots.find((s) => s.name === "single-mobile")).toMatchObject({
      mode: "single",
      path: "/",
      viewport: { width: 390, height: 844 },
    });
  });

  it("uses each language's public slugs", () => {
    expect(shotsFor("es").find((s) => s.name === "heatmap")!.path).toBe("/horas/");
    expect(shotsFor("en").find((s) => s.name === "heatmap")!.path).toBe("/hours/");
    expect(shotsFor("en").find((s) => s.name === "chapter")!.path).toBe("/census/");
  });

  it.each(["es", "en"] as const)("ties its slug map to the real copy in %s", (lang) => {
    const slug = (id: string) => `/${copyFor(lang).chapters.find((c) => c.id === id)!.slug}/`;
    const shots = shotsFor(lang);
    expect(shots.find((s) => s.name === "heatmap")!.path).toBe(slug("horas"));
    expect(shots.find((s) => s.name === "chapter")!.path).toBe(slug("censo"));
  });
});
