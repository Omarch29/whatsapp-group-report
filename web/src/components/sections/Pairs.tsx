"use client";

import { extent, max } from "d3-array";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  type ForceRadial,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { scaleLinear, scaleSqrt } from "d3-scale";
import { motion } from "motion/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { CopyLink, Criterion } from "@/components/report/Block";
import { blockAnchor } from "@/lib/blockAnchor";
import { colorFor } from "@/lib/colors";
import { copy } from "../../../content/copy";
import { buildGraph, neighborsOf, type GraphLink, type GraphNode } from "@/lib/graph";
import { useReducedMotion } from "@/lib/motion";
import type { Edge, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./Pairs.module.css";

type Props = {
  people: Person[];
  edges: Edge[];
  /** Slug to focus on mount (profiles); later changes to the prop refocus too. */
  focus?: string;
  lede: string;
  /** Chapter block id for this section (anchor + sidebar spy); none on profiles. */
  blockId?: string;
  /** Chapter anatomy (chapter pages, not profiles): how the chart counts, in one line under the lede. */
  criterion?: string;
  /** Chapter anatomy: a «Copiar link» button for `blockId` at the end of the section. */
  copyLink?: boolean;
};

type SimNode = GraphNode & SimulationNodeDatum & { r: number };
type SimLink = SimulationLinkDatum<SimNode> & { w: number };
type Pos = Record<string, { x: number; y: number }>;
type Ctx = {
  sim: Simulation<SimNode, SimLink>;
  byId: Map<string, SimNode>;
  W: number;
  clamp: (n: SimNode) => void;
  publish: () => void;
  /** Focus currently applied to the simulation (its node is held with fx/fy); undefined until first applied. */
  focused?: string | null;
};
type Drag = { id: string; pointerId: number; x0: number; y0: number; moved: boolean };

const H = 440;
const FALLBACK_W = 700;
const IDLE_MS = 2500;
const SPRING = { type: "spring", stiffness: 260, damping: 14 } as const;
/** Radial targets around the focused node at >= 700 px wide, scaled down on narrower graphs. */
const FULL_W = 700;
const NEAR_R = 110;
const FAR_R = 230;

/** d3-force's own phyllotaxis start, made explicit so server and client render the same seed. */
function seed(nodes: readonly GraphNode[], W: number): Pos {
  const angle = Math.PI * (3 - Math.sqrt(5));
  return Object.fromEntries(
    nodes.map((n, i) => {
      const rad = 10 * Math.sqrt(0.5 + i);
      return [n.id, { x: W / 2 + rad * Math.cos(i * angle), y: H / 2 + rad * Math.sin(i * angle) }];
    }),
  );
}

/** Who replies to whom: a d3-force layout rendered by React; hover or tap a person to pull their partners in. */
export function Pairs({ people, edges, focus: focusProp, lede, blockId, criterion, copyLink }: Props) {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ctxRef = useRef<Ctx | null>(null);
  const lastRef = useRef<{ W: number; pos: Pos } | null>(null);
  const focusRef = useRef<string | null>(focusProp ?? null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const seen = useOnce(sectionRef);

  // A profile's person keeps their strongest links even when they all fall under the threshold.
  const graph = useMemo(
    () => buildGraph(people, edges, undefined, { keepTopFor: focusProp }),
    [people, edges, focusProp],
  );
  const [width, setWidth] = useState(FALLBACK_W);
  const [pos, setPos] = useState<Pos>(() => seed(graph.nodes, FALLBACK_W));

  // Pinned by click/Enter (or the prop); hover only previews on top of it.
  const [pinned, setPinned] = useState<string | null>(focusProp ?? null);
  const [prevProp, setPrevProp] = useState(focusProp);
  if (focusProp !== prevProp) {
    setPrevProp(focusProp);
    setPinned(focusProp ?? null);
  }
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover ?? pinned;

  const radius = useMemo(
    () => scaleSqrt().domain([0, max(graph.nodes, (n) => n.msgs) ?? 1]).range([8, 42]),
    [graph.nodes],
  );
  const lw = useMemo(() => {
    const [lo = 0, hi = 1] = extent(graph.links, (l) => l.w);
    return scaleLinear().domain([lo, hi]).range([1, 14]);
  }, [graph.links]);
  const near = useMemo(() => (focus ? neighborsOf(graph.links, focus) : null), [graph.links, focus]);

  // Container width (the SVG keeps a 1:1 viewBox so text stays at its CSS size).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The simulation: rebuilt when the data, width or motion preference changes, carrying positions over.
  useEffect(() => {
    const W = width;
    const prev = lastRef.current;
    const start = prev ? null : seed(graph.nodes, W);
    const nodes: SimNode[] = graph.nodes.map((n) => {
      const p = prev?.pos[n.id];
      const s = p ? { x: (p.x * W) / prev.W, y: p.y } : (start?.[n.id] ?? { x: W / 2, y: H / 2 });
      return { ...n, r: radius(n.msgs), x: s.x, y: s.y };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = graph.links.map((l: GraphLink) => ({ ...l }));

    const clamp = (n: SimNode) => {
      const mx = Math.max(n.r, 30) + 4;
      const my = n.r + 4;
      n.x = W > 2 * mx ? Math.min(Math.max(n.x ?? W / 2, mx), W - mx) : W / 2;
      n.y = Math.min(Math.max(n.y ?? H / 2, my), H - my);
    };
    const snapshot = (): Pos =>
      Object.fromEntries(nodes.map((n) => [n.id, { x: n.x ?? W / 2, y: n.y ?? H / 2 }]));

    // At most one React update per animation frame.
    let raf: number | null = null;
    const publish = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        setPos(snapshot());
      });
    };

    const sim = forceSimulation<SimNode, SimLink>(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((l) => 160 - lw(l.w) * 6)
          .strength((l) => 0.2 + lw(l.w) / 40),
      )
      .force("charge", forceManyBody<SimNode>().strength(-420))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<SimNode>((d) => d.r + 10));
    const ctx: Ctx = { sim, byId, W, clamp, publish };
    ctxRef.current = ctx;

    let idle: ReturnType<typeof setInterval> | undefined;
    let io: IntersectionObserver | undefined;
    if (reduced) {
      // Static layout: settle synchronously, render once, never move by itself.
      sim.stop();
      sim.tick(300);
      nodes.forEach(clamp);
      publish();
    } else {
      applyFocus(ctx, focusRef.current, graph.links, null);
      sim.on("tick", () => {
        nodes.forEach(clamp);
        publish();
      });
      // Gentle re-heat so it breathes, only while visible and nobody is focused or dragged.
      let visible = true;
      const el = wrapRef.current;
      if (el && typeof IntersectionObserver !== "undefined") {
        io = new IntersectionObserver(([e]) => {
          visible = e?.isIntersecting ?? true;
        });
        io.observe(el);
      }
      idle = setInterval(() => {
        if (
          visible &&
          !document.hidden &&
          !focusRef.current &&
          !dragRef.current &&
          sim.alpha() < 0.08
        ) {
          sim.alpha(0.08).restart();
        }
      }, IDLE_MS);
    }

    return () => {
      sim.stop();
      sim.on("tick", null);
      if (raf !== null) cancelAnimationFrame(raf);
      if (idle) clearInterval(idle);
      io?.disconnect();
      lastRef.current = { W, pos: snapshot() };
      if (ctxRef.current === ctx) ctxRef.current = null;
    };
  }, [graph, width, reduced, radius, lw]);

  // Focus pulls neighbours in and pushes the rest out (no movement under reduced motion).
  useEffect(() => {
    focusRef.current = focus;
    const ctx = ctxRef.current;
    if (!ctx || reduced) return;
    // Already applied (mount, or the simulation was just rebuilt with this focus): no extra kick.
    if (ctx.focused === focus) return;
    applyFocus(ctx, focus, graph.links, dragRef.current?.id ?? null);
    ctx.sim.alpha(0.6).restart();
  }, [focus, reduced, graph.links]);

  const toSvg = (e: PointerEvent): { x: number; y: number } | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      x: ((e.clientX - rect.left) * width) / rect.width,
      y: ((e.clientY - rect.top) * H) / rect.height,
    };
  };

  const onDown = (id: string) => (e: PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    const n = ctxRef.current?.byId.get(id);
    if (!n) return;
    const el = e.currentTarget;
    if (typeof el.setPointerCapture === "function") el.setPointerCapture(e.pointerId);
    dragRef.current = { id, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
    suppressClick.current = false;
    n.fx = n.x;
    n.fy = n.y;
    if (!reduced) ctxRef.current?.sim.alphaTarget(0.3).restart();
  };

  const onMove = (e: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    const ctx = ctxRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !ctx) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 3) drag.moved = true;
    const p = toSvg(e);
    const n = ctx.byId.get(drag.id);
    if (!p || !n) return;
    n.x = p.x;
    n.y = p.y;
    ctx.clamp(n);
    n.fx = n.x;
    n.fy = n.y;
    // Dragging the focused node carries its neighbours' orbit with it.
    if (ctx.focused === n.id) {
      const pull = ctx.sim.force("pull") as ForceRadial<SimNode> | undefined;
      pull?.x(n.x).y(n.y);
    }
    // With the simulation stopped (reduced motion) only the dragged node follows the pointer.
    if (reduced) ctx.publish();
  };

  const onUp = (e: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    // Swallow only the click this drag produces (dispatched right after pointerup, before any timer).
    suppressClick.current = drag.moved;
    if (drag.moved) setTimeout(() => (suppressClick.current = false), 0);
    const el = e.currentTarget;
    if (typeof el.hasPointerCapture === "function" && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    const ctx = ctxRef.current;
    const n = ctx?.byId.get(drag.id);
    // The focused node stays held where it was dropped.
    if (n && ctx?.focused !== n.id) {
      n.fx = null;
      n.fy = null;
    }
    if (!reduced) ctx?.sim.alphaTarget(0);
  };

  const toggle = (id: string) => setPinned((p) => (p === id ? null : id));

  const onClick = (id: string) => () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    toggle(id);
  };

  const onKey = (id: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggle(id);
  };

  // Touch has no hover: a tap is a click (pin); only a mouse previews.
  const onEnter = (id: string) => (e: PointerEvent) => {
    if (e.pointerType === "mouse" && !dragRef.current) setHover(id);
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && !dragRef.current) setHover(null);
  };

  const at = (id: string) => pos[id] ?? { x: width / 2, y: H / 2 };
  const focusColor = focus
    ? colorFor(graph.nodes.find((n) => n.id === focus)?.colorIndex ?? -1)
    : undefined;

  return (
    <section ref={sectionRef} {...blockAnchor(blockId)} className={styles.pairs}>
      <div className={styles.head}>
        <h2>{copy.pairs.title}</h2>
        <p className={styles.lede}>{lede}</p>
        {criterion && <Criterion>{criterion}</Criterion>}
      </div>

      <div ref={wrapRef} className={styles.wrap}>
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={`0 0 ${width} ${H}`}
          role="group"
          aria-label={copy.pairs.title}
          data-testid="graph"
          data-focus={focus ?? ""}
        >
          <g aria-hidden="true">
            {graph.links.map((l) => {
              const a = at(l.source);
              const b = at(l.target);
              const mine = focus !== null && (l.source === focus || l.target === focus);
              return (
                <line
                  key={`${l.source}-${l.target}`}
                  className={styles.link}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeWidth={lw(l.w)}
                  style={{
                    stroke: mine ? focusColor : "var(--paper)",
                    strokeOpacity: mine ? 0.75 : focus ? 0.03 : 0.08,
                  }}
                />
              );
            })}
          </g>
          <g>
            {graph.nodes.map((n, i) => {
              const p = at(n.id);
              const r = radius(n.msgs);
              const dim = focus !== null && n.id !== focus && !near?.has(n.id);
              return (
                <g
                  key={n.id}
                  className={styles.node}
                  role="button"
                  tabIndex={0}
                  aria-label={n.name}
                  aria-pressed={pinned === n.id}
                  data-testid={`node-${n.id}`}
                  transform={`translate(${p.x},${p.y})`}
                  style={{ opacity: dim ? 0.25 : 1 }}
                  onPointerEnter={onEnter(n.id)}
                  onPointerLeave={onLeave}
                  onPointerDown={onDown(n.id)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  onClick={onClick(n.id)}
                  onKeyDown={onKey(n.id)}
                >
                  <motion.circle
                    className={styles.dot}
                    fill={colorFor(n.colorIndex)}
                    initial={reduced ? false : { r: 0 }}
                    animate={{ r: seen || reduced ? r : 0 }}
                    transition={reduced ? { duration: 0 } : { ...SPRING, delay: i * 0.06 }}
                  />
                  <text className={styles.name} dy=".35em" fontSize={r > 18 ? 12 : 10}>
                    {n.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      {copyLink && blockId && <CopyLink id={blockId} />}
    </section>
  );
}

/**
 * Holds the focused node where it is (so a hovered node stays under the cursor) and pulls its
 * neighbours to a ring around it while pushing the rest further out. Releases the previous
 * focused node unless it is being dragged.
 */
function applyFocus(
  ctx: Ctx,
  id: string | null,
  links: readonly GraphLink[],
  dragging: string | null,
): void {
  const prev = ctx.focused ? ctx.byId.get(ctx.focused) : undefined;
  if (prev && prev.id !== id && prev.id !== dragging) {
    prev.fx = null;
    prev.fy = null;
  }
  ctx.focused = id;
  const n = id ? ctx.byId.get(id) : undefined;
  if (!n) {
    ctx.sim.force("pull", null);
    return;
  }
  n.fx = n.x;
  n.fy = n.y;
  const near = neighborsOf(links, n.id);
  const k = Math.min(1, ctx.W / FULL_W);
  ctx.sim.force(
    "pull",
    forceRadial<SimNode>(
      (d) => (d.id === n.id ? 0 : near.has(d.id) ? NEAR_R * k : FAR_R * k),
      n.x ?? ctx.W / 2,
      n.y ?? H / 2,
    ).strength(0.35),
  );
}
