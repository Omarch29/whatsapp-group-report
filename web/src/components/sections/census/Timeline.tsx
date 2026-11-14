"use client";

import { gsap } from "gsap";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { copy } from "../../../../content/copy";
import { localHref } from "@/lib/chapters";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { fmt, fmtDate, fmtShortDate } from "@/lib/format";
import { useReducedMotion } from "@/lib/motion";
import type { CensusData, Person } from "@/lib/schema";
import { dayForX, dayIndex, layoutTimeline, type TimelineColumn } from "@/lib/timeline";
import { useOnce } from "@/lib/useOnce";
import styles from "./Timeline.module.css";

type Item = CensusData["timeline"][number];

type Props = {
  items: CensusData["timeline"];
  period: { from: string; to: string };
  people: Person[];
};

// Geometry in px (the rail scrolls, so a fixed px scale is fine on every width).
const COL = 148;
const GAP = 10;
const PX_PER_DAY = 6;
const MAX_STACK = 3;
const PAD = 16;
const CHIP_H = 64;
const STACK_GAP = 6;
/** From the track's bottom: date labels, then the axis, then a short stem, then the chips. */
const AXIS_Y = 30;
const CHIPS_Y = AXIS_Y + 14;
const YEAR_ROW = 24;
const HEIGHT = CHIPS_Y + MAX_STACK * (CHIP_H + STACK_GAP) + YEAR_ROW;

function Chip({ item, people }: { item: Item; people: Person[] }) {
  const k = item.kind;
  const who = item.slug ? people.find((p) => p.slug === item.slug) : undefined;
  const dot = item.slug ? colorForSlug(item.slug, people) : undefined;
  const isPerson = k === "join" || k === "leave";
  const body: ReactNode = (
    <>
      <span className={styles.glyph} data-kind={k} style={dot ? ({ "--c": dot } as CSSProperties) : undefined} aria-hidden="true" />
      <span className={styles.kicker}>
        {copy.census.kinds[k]}
        {who && !isPerson && k !== "departures" && (
          <>
            {" · "}
            <span style={{ color: personTextColor(who.slug, people) }}>{who.name}</span>
          </>
        )}
      </span>
      <span
        className={styles.label}
        style={isPerson && item.slug ? { color: personTextColor(item.slug, people) } : undefined}
      >
        {item.label}
      </span>
      <span className={styles.srOnly}>{`, ${fmtDate(item.when)}`}</span>
    </>
  );
  const cls = `${styles.chip} ${styles[k]}`;
  return item.href?.startsWith("/") ? (
    <Link href={localHref(item.href)} className={cls} title={item.label}>
      {body}
    </Link>
  ) : (
    <span className={cls} title={item.label}>
      {body}
    </span>
  );
}

/** A day index as a percentage of `span` days, clamped to the strip. */
const pctOf = (day: number, span: number) => `${Number(((Math.min(Math.max(day, 0), span) / span) * 100).toFixed(3))}%`;

const OVERVIEW_LANE: Record<Item["kind"], number> = { name: 0, photo: 1, join: 2, leave: 2, peak: 3, event: 3, departures: 3 };

type Layout = ReturnType<typeof layoutTimeline>;

/**
 * Fit-to-width overview of the whole period on a linear date scale: one dot per milestone
 * (lanes by kind), year buttons, and a window showing the part of the rail on screen.
 * Tapping the strip or a year scrolls the rail there.
 */
function Overview({
  items,
  period,
  people,
  layout,
  railRef,
  reduced,
}: Props & { layout: Layout; railRef: RefObject<HTMLDivElement | null>; reduced: boolean }) {
  const windowRef = useRef<HTMLSpanElement>(null);
  const span = Math.max(1, dayIndex(period.to, period.from) + 1);
  const at = (day: number) => pctOf(day, span);
  const y0 = Number(period.from.slice(0, 4));
  const y1 = Number(period.to.slice(0, 4));
  const years = Array.from({ length: Math.max(0, y1 - y0) }, (_, k) => y0 + k + 1);

  // The window follows the rail (written to the DOM, at most once per frame).
  useEffect(() => {
    const rail = railRef.current;
    const win = windowRef.current;
    if (!rail || !win) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!rail.clientWidth || !rail.scrollWidth) return;
      const d0 = dayForX(layout.points, rail.scrollLeft);
      const d1 = dayForX(layout.points, rail.scrollLeft + rail.clientWidth);
      win.style.left = pctOf(d0, span);
      win.style.width = pctOf(d1 - d0, span);
      win.hidden = false;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    rail.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      rail.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [railRef, layout, span]);

  const scrollToColumn = (c: TimelineColumn | undefined) => {
    if (!c) return;
    railRef.current?.scrollTo({ left: Math.max(0, c.x - PAD), behavior: reduced ? "auto" : "smooth" });
  };
  const dayOf = (c: TimelineColumn) => dayIndex(c.day, period.from);
  const firsts = layout.columns.filter((c) => c.first);

  const onStrip = (e: MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width) return;
    const day = ((e.clientX - box.left) / box.width) * span;
    let best = firsts[0];
    for (const c of firsts) if (Math.abs(dayOf(c) - day) < Math.abs(dayOf(best!) - day)) best = c;
    scrollToColumn(best);
  };
  const onYear = (year: number) => {
    const day = dayIndex(`${year}-01-01`, period.from);
    scrollToColumn(firsts.find((c) => dayOf(c) >= day) ?? firsts.at(-1));
  };

  return (
    <div className={styles.overview} role="group" aria-label={copy.census.overviewLabel}>
      {/* Pointer shortcut only; keyboard users get the year buttons below and the rail itself. */}
      <div className={styles.strip} data-testid="overview-track" onClick={onStrip} aria-hidden="true">
        {years.map((y) => (
          <span key={y} className={styles.stripTick} style={{ left: at(dayIndex(`${y}-01-01`, period.from)) }} />
        ))}
        {items.map((item, i) => (
          <span
            key={`${item.when}-${i}`}
            className={styles.dot}
            data-testid="overview-dot"
            data-kind={item.kind}
            style={
              {
                left: at(dayIndex(item.when, period.from)),
                top: `${OVERVIEW_LANE[item.kind] * 25 + 12.5}%`,
                "--c": item.slug ? colorForSlug(item.slug, people) : undefined,
              } as CSSProperties
            }
          />
        ))}
        <span ref={windowRef} className={styles.window} hidden />
      </div>
      <div className={styles.years} role="group" aria-label={copy.census.yearsLabel}>
        {years.map((y) => (
          <button
            key={y}
            type="button"
            className={`num ${styles.yearButton}`}
            style={{ left: at(dayIndex(`${y}-01-01`, period.from)) }}
            onClick={() => onYear(y)}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The group's history on one scrollable rail: same-day milestones stack in a column over a time axis. */
export function Timeline({ items, period, people }: Props) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const ctxRef = useRef<gsap.Context | null>(null);
  const drawn = useRef(false);
  /** The column observer and its targets; it starts observing only once the block is on screen. */
  const popRef = useRef<{ io: IntersectionObserver; lis: HTMLElement[]; started: boolean } | null>(null);
  const seen = useOnce(rootRef, 0.2);

  const layout = useMemo(
    () => layoutTimeline(items, period, { col: COL, gap: GAP, pxPerDay: PX_PER_DAY, maxStack: MAX_STACK, pad: PAD }),
    [items, period],
  );

  // Without reduced motion (and with IntersectionObserver), hide the axis and the milestones
  // before paint; once the block is on screen, each column pops the first time half of it is
  // inside the rail (an element root ignores the viewport, so observing waits for `seen`).
  useLayoutEffect(() => {
    const rail = railRef.current;
    const list = listRef.current;
    if (reduced || !rail || !list || typeof IntersectionObserver === "undefined") return;
    const lis = Array.from(list.children) as HTMLElement[];
    const ctx = gsap.context(() => {
      gsap.set(axisRef.current, { scaleX: 0, transformOrigin: "left center" });
      gsap.set(lis, { scale: 0.4, opacity: 0, transformOrigin: "left bottom" });
    }, rootRef);
    ctxRef.current = ctx;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const col = (e.target as HTMLElement).dataset.col;
          const column = lis.filter((li) => li.dataset.col === col && li.dataset.shown !== "true");
          if (column.length === 0) continue;
          for (const li of column) {
            li.dataset.shown = "true";
            io.unobserve(li);
          }
          ctx.add(() => {
            gsap.to(column, {
              scale: 1,
              opacity: 1,
              duration: 0.35,
              ease: "back.out(2)",
              stagger: 0.05,
              clearProps: "transform,opacity",
            });
          });
        }
      },
      { root: rail, threshold: 0.5 },
    );
    popRef.current = { io, lis, started: false };
    return () => {
      io.disconnect();
      popRef.current = null;
      for (const li of lis) delete li.dataset.shown;
      ctx.revert();
      ctxRef.current = null;
    };
  }, [reduced, layout]);

  // First view of the block: the rail starts popping the columns inside it.
  useEffect(() => {
    const pop = popRef.current;
    if (!seen || !pop || pop.started) return;
    pop.started = true;
    pop.lis.forEach((li) => pop.io.observe(li));
  }, [seen, layout]);

  // First view of the block: the axis draws left to right.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!seen || reduced || drawn.current || !ctx) return;
    drawn.current = true;
    ctx.add(() => {
      gsap.to(axisRef.current, { scaleX: 1, duration: 1.6, ease: "power2.inOut", clearProps: "transform" });
    });
  }, [seen, reduced]);

  if (items.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  const scroll = (dir: 1 | -1) => {
    const rail = railRef.current;
    rail?.scrollBy?.({ left: dir * rail.clientWidth * 0.8, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <Overview items={items} period={period} people={people} layout={layout} railRef={railRef} reduced={reduced} />
      <div className={styles.controls}>
        <p className={styles.hint}>{copy.census.timelineHint}</p>
        <button type="button" className={styles.nav} onClick={() => scroll(-1)} aria-label={copy.census.timelineBack}>
          ←
        </button>
        <button type="button" className={styles.nav} onClick={() => scroll(1)} aria-label={copy.census.timelineForward}>
          →
        </button>
      </div>
      <div
        ref={railRef}
        className={styles.rail}
        role="region"
        aria-label={copy.census.timelineLabel}
        tabIndex={0}
        style={{ scrollPaddingInline: PAD }}
      >
        <div className={styles.track} style={{ width: layout.width, height: HEIGHT }}>
          <div aria-hidden="true">
            {layout.ticks.map((t) => (
              <span key={t.label} className={styles.year} style={{ left: t.x }}>
                <span className={`num ${styles.yearLabel}`}>{t.label}</span>
              </span>
            ))}
            <div ref={axisRef} className={styles.axis} data-testid="timeline-axis" style={{ bottom: AXIS_Y }} />
            {layout.columns.map((c) => (
              <span key={c.x} className={styles.stem} style={{ left: c.x, bottom: AXIS_Y - 4, height: CHIPS_Y - AXIS_Y + 4 }}>
                {c.first && <span className={`num ${styles.date}`}>{fmtShortDate(c.day)}</span>}
              </span>
            ))}
            {/* The first column already carries the start date; the end of the period gets its own. */}
            <span className={`num ${styles.edge}`} style={{ left: layout.width - PAD, bottom: AXIS_Y + 6 }}>
              {fmtShortDate(period.to)}
            </span>
          </div>
          <ol ref={listRef} className={styles.list} aria-label={copy.census.timelineList}>
            {items.map((item, i) => {
              const slot = layout.slots[i]!;
              const col = layout.columns[slot.column]!;
              return (
                <li
                  key={`${item.when}-${i}`}
                  className={styles.item}
                  data-kind={item.kind}
                  data-col={slot.column}
                  style={{ left: col.x, bottom: CHIPS_Y + slot.stack * (CHIP_H + STACK_GAP), width: COL, height: CHIP_H }}
                >
                  <Chip item={item} people={people} />
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

type Names = CensusData["names"];

function NameCard({ label, span }: { label: string; span: NonNullable<Names["longest"]> }) {
  const d = copy.census.duration(span.days, span.seconds);
  return (
    <figure className={styles.nameCard}>
      <figcaption className={styles.nameKicker}>{label}</figcaption>
      <p className={styles.bubble}>{span.label}</p>
      <p className={styles.nameValue}>
        <span className={`num ${styles.gold}`}>{fmt(d.n)}</span>
        <span className={styles.unit}>{d.unit}</span>
      </p>
      <p className={styles.nameSpan}>{copy.census.nameSpan(fmtShortDate(span.from), fmtShortDate(span.to))}</p>
    </figure>
  );
}

/** Record of the timeline block: the group name that lasted longest and the one that lasted least. */
export function NameRecords({ names }: { names: Names }) {
  if (!names.longest && !names.shortest) return null;
  return (
    <div className={styles.names}>
      {names.longest && <NameCard label={copy.census.longestName} span={names.longest} />}
      {names.shortest && <NameCard label={copy.census.shortestName} span={names.shortest} />}
    </div>
  );
}
