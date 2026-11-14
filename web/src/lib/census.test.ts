import { describe, expect, it } from "vitest";
import { fx } from "@/test/fixtures";
import { topPersonYear } from "./census";

describe("topPersonYear", () => {
  it("finds the biggest single person-year across the series", () => {
    expect(topPersonYear(fx.census.byYear)).toEqual({ slug: "bruno", year: "2023", value: 500 });
    expect(topPersonYear({ years: ["2023", "2024"], series: { a: [1, 9], b: [8, 2] } })).toEqual({
      slug: "a",
      year: "2024",
      value: 9,
    });
  });

  it("is null without messages", () => {
    expect(topPersonYear({ years: [], series: {} })).toBeNull();
    expect(topPersonYear({ years: ["2023"], series: { a: [0] } })).toBeNull();
  });
});
