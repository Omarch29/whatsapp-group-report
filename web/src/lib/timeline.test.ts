import { describe, expect, it } from "vitest";
import { fmtShortDate } from "./format";
import { dayForX, dayIndex, layoutTimeline, xForDay } from "./timeline";

const item = (when: string, label = "x") => ({ when, kind: "name" as const, label, slug: null, href: null });
const period = { from: "2023-09-01", to: "2023-12-31" };
const opts = { col: 100, gap: 10, pxPerDay: 2, maxStack: 2, pad: 20 };

describe("fmtShortDate", () => {
  it("drops leading zeros: 2023-09-01 -> 1/9/2023", () => {
    expect(fmtShortDate("2023-09-01")).toBe("1/9/2023");
    expect(fmtShortDate("2026-11-09T00:17:45")).toBe("9/11/2026");
  });
});

describe("dayIndex", () => {
  it("counts whole UTC days from the start, ignoring the time of day", () => {
    expect(dayIndex("2023-09-01T23:59:00", "2023-09-01")).toBe(0);
    expect(dayIndex("2023-09-02", "2023-09-01")).toBe(1);
    expect(dayIndex("2024-09-01", "2023-09-01")).toBe(366);
  });
});

describe("layoutTimeline", () => {
  it("groups same-day items in one column, stacked, and splits a day over maxStack", () => {
    const l = layoutTimeline(
      [item("2023-09-01T01:00"), item("2023-09-01T02:00"), item("2023-09-01T03:00"), item("2023-10-01")],
      period,
      opts,
    );
    expect(l.columns).toHaveLength(3);
    expect(l.columns[0]).toMatchObject({ x: 20, first: true, items: [0, 1] });
    // Same day, overflow column: pushed right by col + gap, not a new date label.
    expect(l.columns[1]).toMatchObject({ x: 130, first: false, items: [2] });
    // 30 days later at 2 px/day would be x=80, but it must clear the previous column.
    expect(l.columns[2]).toMatchObject({ x: 240, first: true, items: [3] });
    expect(l.slots).toEqual([
      { column: 0, stack: 0 },
      { column: 0, stack: 1 },
      { column: 1, stack: 0 },
      { column: 2, stack: 0 },
    ]);
  });

  it("keeps date positions when there is room, and places year ticks between columns", () => {
    const l = layoutTimeline([item("2023-09-01"), item("2024-03-01")], { from: "2023-09-01", to: "2024-08-31" }, opts);
    const days = dayIndex("2024-03-01", "2023-09-01");
    expect(l.columns[1]?.x).toBe(20 + days * 2);
    const tick = l.ticks.find((t) => t.label === "2024");
    expect(tick).toBeDefined();
    // Jan 1 falls in the empty stretch after the first column and before the second.
    expect(tick!.x).toBeGreaterThan(20 + 100);
    expect(tick!.x).toBeLessThan(l.columns[1]!.x);
    expect(l.width).toBeGreaterThan(l.columns[1]!.x + 100);
  });

  it("returns an empty layout for no items", () => {
    const l = layoutTimeline([], period, opts);
    expect(l.columns).toEqual([]);
    expect(l.slots).toEqual([]);
    expect(l.width).toBeGreaterThan(0);
  });
});

describe("xForDay / dayForX", () => {
  it("map days to rail x and back, monotonically", () => {
    const l = layoutTimeline([item("2023-09-01"), item("2024-03-01")], { from: "2023-09-01", to: "2024-08-31" }, opts);
    const d = dayIndex("2024-03-01", "2023-09-01");
    expect(xForDay(l.points, d)).toBe(l.columns[1]!.x);
    expect(dayForX(l.points, l.columns[1]!.x)).toBe(d);
    expect(dayForX(l.points, 0)).toBe(0);
    expect(dayForX(l.points, l.width * 2)).toBe(l.points.at(-1)![0]);
    const mid = dayForX(l.points, 200);
    expect(xForDay(l.points, mid)).toBeCloseTo(200);
  });
});
