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
 * With no explicit threshold, the graph keeps about this many lines per person: the cutoff is the weight of
 * the `ceil(LINES_PER_PERSON * nodes)`-th strongest edge. Dense enough to read as a network, sparse enough
 * to stay legible, whatever the size of the chat.
 */
export const LINES_PER_PERSON = 1.5;

/**
 * Nodes for every person except the aggregated `resto`; links for edges whose both ends are nodes and whose
 * weight reaches `minWeight` replies, plus `keepTopFor`'s `topK` strongest edges so a low-traffic person never
 * ends up alone. Links keep the `edges` order.
 *
 * An explicit `minWeight` is used as given. When it is `undefined` the threshold comes from the data: the weight
 * of the K-th strongest valid edge, K = `ceil(LINES_PER_PERSON * nodes)`. Ties at that weight stay, so there can
 * be a few more than K links; with K or fewer valid edges, all stay.
 */
export function buildGraph(
  people: Person[],
  edges: Edge[],
  minWeight?: number,
  { keepTopFor, topK = 3 }: GraphOptions = {},
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes = people
    .filter((p) => p.slug !== "resto")
    .map((p) => ({ id: p.slug, name: p.name, msgs: p.msgs, colorIndex: p.colorIndex }));
  const ids = new Set(nodes.map((n) => n.id));
  const valid = edges.filter((e) => ids.has(e.a) && ids.has(e.b));
  const threshold = minWeight ?? derivedThreshold(valid, Math.ceil(LINES_PER_PERSON * nodes.length));
  const top = new Set(
    keepTopFor
      ? valid
          .filter((e) => e.a === keepTopFor || e.b === keepTopFor)
          .sort((x, y) => y.w - x.w)
          .slice(0, topK)
      : [],
  );
  const links = valid
    .filter((e) => e.w >= threshold || top.has(e))
    .map((e) => ({ source: e.a, target: e.b, w: e.w }));
  return { nodes, links };
}

/** Weight of the `k`-th strongest edge, or 0 (keep everything) when there are `k` or fewer. */
function derivedThreshold(valid: Edge[], k: number): number {
  if (valid.length <= k) return 0;
  return valid.map((e) => e.w).sort((x, y) => y - x)[k - 1];
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
