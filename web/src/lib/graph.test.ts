import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fx } from "@/test/fixtures";
import { buildGraph, LINES_PER_PERSON, neighborsOf } from "./graph";
import type { Edge, GlobalData, Person } from "./schema";

const loadGlobalExample = (): GlobalData =>
  JSON.parse(readFileSync(path.join(process.cwd(), "data/example/global.json"), "utf8"));

const people = fx.global.people;
const edges = fx.global.edges;

describe("buildGraph", () => {
  it("drops weak edges and keeps all people as nodes", () => {
    const g = buildGraph(people, edges, 50);
    const profiled = people.filter((p) => p.slug !== "resto");
    expect(g.nodes).toHaveLength(profiled.length);
    expect(g.nodes).toEqual([
      { id: "bruno", name: "Bruno", msgs: 500, colorIndex: 0 },
      { id: "tomi", name: "Tomi", msgs: 300, colorIndex: 1 },
      { id: "ana", name: "Ana", msgs: 150, colorIndex: 2 },
    ]);
    expect(g.links.every((l) => l.w >= 50)).toBe(true);
    expect(g.links).toEqual([
      { source: "tomi", target: "bruno", w: 120 },
      { source: "bruno", target: "ana", w: 60 },
    ]);
  });

  it("an explicit threshold is used as given and drops edges to non-nodes", () => {
    expect(buildGraph(people, edges, 1500).links).toEqual([]);
    const extra = [
      ...edges,
      { a: "resto", b: "tomi", w: 5000 },
      { a: "tomi", b: "nadie", w: 5000 },
      { a: "ana", b: "tomi", w: 1500 },
    ];
    expect(buildGraph(people, extra, 1500).links).toEqual([{ source: "ana", target: "tomi", w: 1500 }]);
  });
});

// Eight nodes, so K = ceil(1.5 * 8) = 12.
const crowd: Person[] = Array.from({ length: 8 }, (_, i) => ({
  ...people[0],
  slug: `p${i}`,
  name: `P${i}`,
  colorIndex: i,
}));
const pair = (i: number, j: number, w: number) => ({ a: `p${i}`, b: `p${j}`, w });
/** Weights 100, 99, ... for the first n pairs, in pair order. */
const ranked = (n: number) => {
  const out: Edge[] = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) out.push(pair(i, j, 100 - out.length));
  return out.slice(0, n);
};

describe("buildGraph derived threshold", () => {
  it("keeps the K-th strongest edge and everything above it", () => {
    const all = ranked(20);
    const { links } = buildGraph(crowd, all);
    expect(links).toHaveLength(12);
    expect(Math.min(...links.map((l) => l.w))).toBe(89);
    expect(links.map((l) => l.w)).toEqual(all.slice(0, 12).map((e) => e.w));
  });

  it("keeps ties at the K-th weight, in edges order", () => {
    const all = [...ranked(11), pair(5, 6, 89), pair(5, 7, 89), pair(6, 7, 50)];
    const { links } = buildGraph(crowd, all);
    expect(links.map((l) => l.w)).toEqual([...all.slice(0, 11).map((e) => e.w), 89, 89]);
    expect(links.at(-1)).toEqual({ source: "p5", target: "p7", w: 89 });
  });

  it("keeps every edge when there are K or fewer", () => {
    expect(buildGraph(crowd, ranked(12)).links).toHaveLength(12);
    const few = [...ranked(5), pair(6, 7, 1)];
    expect(buildGraph(crowd, few).links).toHaveLength(6);
    expect(buildGraph(crowd, []).links).toEqual([]);
  });

  it("ignores edges to non-nodes when counting", () => {
    const noise = [
      { a: "resto", b: "p0", w: 9999 },
      { a: "p1", b: "nadie", w: 9999 },
    ];
    const all = [...noise, ...ranked(20)];
    const { links } = buildGraph(crowd, all);
    expect(links).toHaveLength(12);
    expect(Math.min(...links.map((l) => l.w))).toBe(89);
    // 12 valid edges plus noise would be "K or fewer" only if noise were wrongly counted.
    expect(buildGraph(crowd, [...noise, ...ranked(12)]).links).toHaveLength(12);
  });

  it("keepTopFor adds the focused node's top edges on top of the derived threshold", () => {
    // ranked(12) leaves p7 one strong edge (p0-p7); these three are far below the cutoff of 89.
    const all = [...ranked(12), pair(1, 7, 3), pair(2, 7, 2), pair(3, 7, 1)];
    expect(buildGraph(crowd, all).links.map((l) => l.w)).toEqual(ranked(12).map((e) => e.w));
    const focused = buildGraph(crowd, all, undefined, { keepTopFor: "p7", topK: 3 }).links;
    expect(focused.filter((l) => l.w < 89)).toEqual([
      { source: "p1", target: "p7", w: 3 },
      { source: "p2", target: "p7", w: 2 },
    ]);
    expect(focused).toHaveLength(14);
  });

  it("gives the committed example a readable graph", () => {
    const g = loadGlobalExample();
    const nodes = g.people.filter((p) => p.slug !== "resto");
    const built = buildGraph(g.people, g.edges);
    const k = Math.ceil(LINES_PER_PERSON * nodes.length);
    const kth = [...g.edges].map((e) => e.w).sort((x, y) => y - x)[k - 1];
    const ties = g.edges.filter((e) => e.w === kth).length - 1;
    expect(built.links.length).toBeGreaterThanOrEqual(1);
    expect(built.links.length).toBeLessThanOrEqual(k + ties);
    expect(built.nodes).toHaveLength(nodes.length);
  });
});

describe("buildGraph keepTopFor", () => {
  it("keeps the focused node's top-k edges below the threshold, strongest first", () => {
    const extra = [...edges, { a: "bruno", b: "nadie", w: 999 }];
    expect(buildGraph(people, extra, 1500, { keepTopFor: "ana" }).links).toEqual([
      { source: "bruno", target: "ana", w: 60 },
      { source: "tomi", target: "ana", w: 20 },
    ]);
    expect(buildGraph(people, edges, 1500, { keepTopFor: "ana", topK: 1 }).links).toEqual([
      { source: "bruno", target: "ana", w: 60 },
    ]);
  });

  it("still keeps every edge over the threshold and ignores unknown focus", () => {
    expect(buildGraph(people, edges, 100, { keepTopFor: "ana", topK: 1 }).links).toEqual([
      { source: "tomi", target: "bruno", w: 120 },
      { source: "bruno", target: "ana", w: 60 },
    ]);
    expect(buildGraph(people, edges, 1500, { keepTopFor: "nadie" }).links).toEqual([]);
    expect(buildGraph(people, edges, 1500, { keepTopFor: "resto" }).links).toEqual([]);
  });
});

describe("neighborsOf", () => {
  it("collects both ends of the links touching a node", () => {
    const { links } = buildGraph(people, edges, 50);
    expect(neighborsOf(links, "bruno")).toEqual(new Set(["tomi", "ana"]));
    expect(neighborsOf(links, "tomi")).toEqual(new Set(["bruno"]));
    expect(neighborsOf(links, "nadie")).toEqual(new Set());
  });
});
