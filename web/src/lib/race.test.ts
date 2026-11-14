import { describe, expect, it } from "vitest";
import { cumulative, orderAt } from "./race";

describe("cumulative", () => {
  it("sums and keeps zeros for absent months", () => {
    expect(cumulative({ a: [1, 0, 2] })).toEqual({ a: [1, 1, 3] });
  });

  it("starts at zero for people who join late", () => {
    expect(cumulative({ a: [0, 0, 4], b: [2, 2, 2] })).toEqual({ a: [0, 0, 4], b: [2, 4, 6] });
  });
});

describe("orderAt", () => {
  const cum = { a: [1, 1, 3], b: [2, 4, 6], c: [0, 5, 5] };

  it("sorts slugs by cumulative value, descending", () => {
    expect(orderAt(cum, 0)).toEqual(["b", "a", "c"]);
    expect(orderAt(cum, 1)).toEqual(["c", "b", "a"]);
  });

  it("breaks ties by slug", () => {
    expect(orderAt(cum, 2)).toEqual(["b", "c", "a"]);
    expect(orderAt({ z: [3], m: [3], a: [3] }, 0)).toEqual(["a", "m", "z"]);
  });
});
