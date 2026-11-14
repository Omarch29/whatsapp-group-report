import { describe, expect, it } from "vitest";
import { fx } from "@/test/fixtures";
import { KIND_COLORS, OTHER_KIND, kindGroups, kindValues, peakIndex, top, topKind } from "./media";

describe("media helpers", () => {
  it("keeps the usual kinds apart and folds the rare ones into «otros», in data order", () => {
    expect(kindGroups(["image", "sticker", "gif", "audio", "location", "call"])).toEqual({
      main: ["image", "sticker", "audio"],
      other: ["gif", "location", "call"],
    });
    expect(kindGroups(["text", "image"])).toEqual({ main: ["image"], other: [] });
  });

  it("gives every main kind and «otros» a fixed colour", () => {
    for (const k of ["image", "sticker", "audio", "video", "poll", "deleted", "media", OTHER_KIND]) {
      expect(KIND_COLORS[k], k).toBeTruthy();
    }
  });

  it("sums the folded kinds of a person, total or per mil", () => {
    const counts = { text: 9, image: 4, gif: 1, call: 2 };
    expect(kindValues(counts, { main: ["image"], other: ["gif", "call"] })).toEqual([
      { kind: "image", value: 4 },
      { kind: OTHER_KIND, value: 3 },
    ]);
  });

  it("picks the group's most common kind after text", () => {
    // Bruno 20 + Tomi 15 images against 13 stickers and 12 audios.
    expect(topKind(fx.media.kinds)).toEqual({ kind: "image", n: 35 });
    expect(topKind({ kinds: [], byPerson: [] })).toBeNull();
  });

  it("finds the peak index and the top row (first wins a tie)", () => {
    expect(peakIndex(fx.media.audios.byHour)).toBe(21);
    expect(peakIndex([])).toBe(-1);
    expect(top([{ n: 2 }, { n: 5 }, { n: 5 }], (r) => r.n)).toEqual({ n: 5 });
    expect(top([], (r: { n: number }) => r.n)).toBeNull();
  });
});
