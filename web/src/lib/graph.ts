import type { Edge, Person } from "./schema";

export type GraphNode = { id: string; name: string; msgs: number; colorIndex: number };
/** Undirected: `source`/`target` keep the edge's `a`/`b` order. */
export type GraphLink = { source: string; target: string; w: number };

export type GraphOptions = {
  /** Also keep this node's `topK` strongest edges, even below `minWeight` (a focused profile). */
  keepTopFor?: string;
  topK?: number;
};

/**
 * Nodes for every person except the aggregated `resto`; links for edges of at least
 * `minWeight` replies whose both ends are nodes, plus `keepTopFor`'s `topK` strongest
 * edges so a low-traffic person never ends up alone. Links keep the `edges` order.
 */
export function buildGraph(
  people: Person[],
  edges: Edge[],
  minWeight = 1500,
  { keepTopFor, topK = 3 }: GraphOptions = {},
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes = people
    .filter((p) => p.slug !== "resto")
    .map((p) => ({ id: p.slug, name: p.name, msgs: p.msgs, colorIndex: p.colorIndex }));
  const ids = new Set(nodes.map((n) => n.id));
  const valid = edges.filter((e) => ids.has(e.a) && ids.has(e.b));
  const top = new Set(
    keepTopFor
      ? valid
          .filter((e) => e.a === keepTopFor || e.b === keepTopFor)
          .sort((x, y) => y.w - x.w)
          .slice(0, topK)
      : [],
  );
  const links = valid
    .filter((e) => e.w >= minWeight || top.has(e))
    .map((e) => ({ source: e.a, target: e.b, w: e.w }));
  return { nodes, links };
}

/** Ids linked to `id`, in either direction. */
export function neighborsOf(links: readonly GraphLink[], id: string): Set<string> {
  const out = new Set<string>();
  for (const l of links) {
    if (l.source === id) out.add(l.target);
    else if (l.target === id) out.add(l.source);
  }
  return out;
}
