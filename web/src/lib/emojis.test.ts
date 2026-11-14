import { describe, expect, it } from "vitest";
import { fx } from "@/test/fixtures";
import { mostConstant, strongestSignature, yearLeaders, yearRecord } from "./emojis";

const byYear = [
  {
    year: "2023",
    top: [
      { e: "😭", n: 75 },
      { e: "🤣", n: 27 },
    ],
  },
  {
    year: "2024",
    top: [
      { e: "❤️", n: 324 },
      { e: "😭", n: 294 },
    ],
  },
  {
    year: "2025",
    top: [
      { e: "😭", n: 246 },
      { e: "🤣", n: 215 },
    ],
  },
];

describe("emojis helpers", () => {
  it("lists each year's number one and how many years each emoji led", () => {
    expect(yearLeaders(byYear)).toEqual({
      leaders: [
        { year: "2023", e: "😭" },
        { year: "2024", e: "❤️" },
        { year: "2025", e: "😭" },
      ],
      most: { e: "😭", years: 2 },
    });
    expect(yearLeaders([]).most).toBeNull();
  });

  it("finds the emoji in the top 5 the most years (first seen wins a tie)", () => {
    expect(mostConstant(byYear)).toEqual({ e: "😭", years: 3 });
    expect(mostConstant([])).toBeNull();
  });

  it("finds the biggest single emoji-year", () => {
    expect(yearRecord(byYear)).toEqual({ e: "❤️", n: 324, year: "2024" });
    expect(yearRecord([])).toBeNull();
  });

  it("picks the strongest signature by ratio", () => {
    expect(strongestSignature(fx.emojis.signature)?.slug).toBe("bruno");
    expect(strongestSignature([])).toBeNull();
  });
});
