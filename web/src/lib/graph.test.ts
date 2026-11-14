import { describe, expect, it } from "vitest";
import { fx } from "@/test/fixtures";
import { buildGraph, neighborsOf } from "./graph";

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

  it("defaults to a 1500 threshold and drops edges to non-nodes", () => {
    expect(buildGraph(people, edges).links).toEqual([]);
    const extra = [
      ...edges,
      { a: "resto", b: "tomi", w: 5000 },
      { a: "tomi", b: "nadie", w: 5000 },
      { a: "ana", b: "tomi", w: 1500 },
    ];
    expect(buildGraph(people, extra).links).toEqual([{ source: "ana", target: "tomi", w: 1500 }]);
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
