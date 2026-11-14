import { describe, expect, it } from "vitest";
import { fx } from "@/test/fixtures";
import { fmtSeconds } from "./format";
import { latencyDomain, latencyTicks, longestSilence, longestStreak, starterRows } from "./rhythm";

describe("rhythm helpers", () => {
  it("formats seconds in their natural unit", () => {
    expect(fmtSeconds(1.8)).toBe("1,8 s");
    expect(fmtSeconds(10)).toBe("10 s");
    expect(fmtSeconds(120)).toBe("2 min");
    expect(fmtSeconds(90)).toBe("1,5 min");
  });

  it("pads the latency domain out to the nearest ticks, and thins ticks on a wide domain", () => {
    expect(latencyDomain([10, 21])).toEqual([5, 30]);
    expect(latencyTicks([5, 30])).toEqual([5, 10, 15, 20, 30]);
    expect(latencyDomain([6, 500])).toEqual([5, 600]);
    expect(latencyTicks([5, 600])).toEqual([5, 10, 30, 60, 120, 300, 600]);
    expect(latencyDomain([])).toEqual([1, 600]);
  });

  it("joins starters and killers per person, starters order first", () => {
    expect(starterRows(fx.rhythm.starters, fx.rhythm.killers)).toEqual([
      { slug: "tomi", starts: 30, kills: 9 },
      { slug: "bruno", starts: 12, kills: 0 },
      { slug: "ana", starts: 0, kills: 25 },
    ]);
  });

  it("finds the longest streak and the longest silence", () => {
    const streaks = [
      ...fx.rhythm.streaks,
      {
        slug: "tomi",
        streak: { days: 9, from: "2023-09-01", to: "2023-09-09" },
        silence: { days: 40, from: "2023-09-10", to: "2023-10-20" },
      },
    ];
    expect(longestStreak(streaks)?.slug).toBe("bruno");
    expect(longestSilence(streaks)?.slug).toBe("tomi");
    expect(longestStreak([])).toBeNull();
  });
});
