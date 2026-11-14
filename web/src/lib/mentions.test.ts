import { describe, expect, it } from "vitest";
import { fx } from "@/test/fixtures";
import { mentionCount, mentionsOf, rowMax, sampleKey, topPair } from "./mentions";

describe("mentions helpers", () => {
  const m = fx.mentions;
  it("reads a cell by from/to, 0 for unknown people", () => {
    expect(mentionCount(m, "tomi", "bruno")).toBe(20);
    expect(mentionCount(m, "bruno", "tomi")).toBe(5);
    expect(mentionCount(m, "nadie", "tomi")).toBe(0);
    expect(sampleKey("tomi", "bruno")).toBe("tomi>bruno");
    expect(rowMax(m, 1)).toBe(20);
  });

  it("lists whom a person mentions and who mentions them, desc, without zeros or themselves", () => {
    expect(mentionsOf(m, "tomi")).toEqual({
      to: [
        { slug: "bruno", n: 20 },
        { slug: "ana", n: 4 },
      ],
      by: [
        { slug: "bruno", n: 5 },
        { slug: "ana", n: 2 },
      ],
    });
    expect(mentionsOf(m, "nadie")).toEqual({ to: [], by: [] });
  });

  it("finds the biggest pair cell, null when every cell is 0", () => {
    expect(topPair(m)).toEqual({ from: "tomi", to: "bruno", n: 20 });
    expect(topPair({ ...m, matrix: m.matrix.map((r) => r.map(() => 0)) })).toBeNull();
  });
});
