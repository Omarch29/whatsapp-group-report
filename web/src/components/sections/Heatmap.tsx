"use client";

import { gsap } from "gsap";
import { interpolateRgb } from "d3-interpolate";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { CopyLink, Criterion } from "@/components/report/Block";
import { blockAnchor } from "@/lib/blockAnchor";
import { colorFor } from "@/lib/colors";
import { copy } from "../../../content/copy";
import { useReducedMotion } from "@/lib/motion";
import { useOnce } from "@/lib/useOnce";
import styles from "./Heatmap.module.css";

type HeatPerson = {
  slug: string;
  name: string;
  heatmap: number[][];
  colorIndex?: number;
};

type Props = {
  /** 7 weekdays (Monday first) by 24 hours. */
  group: number[][];
  /** Adds a chip row to switch between the group and one person. */
  people?: HeatPerson[];
  lede: string;
  /** Line under the grid, e.g. "El pico: los viernes a las 11 h." (the group's: hidden while a person is selected). */
  peak?: string;
  /** Chapter block id for this section (anchor + sidebar spy); none on profiles. */
  blockId?: string;
  /** Chapter anatomy (chapter pages, not profiles): how the chart counts, in one line under the lede. */
  criterion?: string;
  /** Chapter anatomy: a «Copiar link» button for `blockId` at the end of the section. */
  copyLink?: boolean;
};

/** "Lun" / "Mon": the copy's short weekday names, capitalized for the grid's row labels. */
const DAYS = copy.dowShort.map((d) => d.charAt(0).toUpperCase() + d.slice(1));
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const GROUP = "group";
const ramp = interpolateRgb("#005c4b", "#f2c94c");

const label = (d: number, h: number, v: number) => copy.heatmap.cell(DAYS[d]!, String(h).padStart(2, "0"), v);

type Tip = { text: string; x: number; y: number };

/** Weekday by hour heat grid: wave reveal on first view, tooltip on hover/touch, optional per-person chips. */
export function Heatmap({ group, people, lede, peak, blockId, criterion, copyLink }: Props) {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<gsap.Context | null>(null);
  const played = useRef(false);
  const seen = useOnce(sectionRef);
  const [sel, setSel] = useState(GROUP);
  const [tip, setTip] = useState<Tip | null>(null);

  const data =
    (sel === GROUP
      ? undefined
      : people?.find((p) => p.slug === sel)?.heatmap) ?? group;

  const { max, peakAt } = useMemo(() => {
    let best = { d: 0, h: 0, v: -1 };
    data.forEach((row, d) =>
      row.forEach((v, h) => v > best.v && (best = { d, h, v })),
    );
    return { max: Math.max(best.v, 0), peakAt: best };
  }, [data]);

  // Hide cells before paint (never under reduced motion); revert restores them on unmount or if reduced flips on.
  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.set(gridRef.current?.querySelectorAll('[role="gridcell"]') ?? [], {
        scale: 0,
        opacity: 0,
      });
    }, gridRef);
    ctxRef.current = ctx;
    return () => {
      ctx.revert();
      ctxRef.current = null;
    };
  }, [reduced]);

  // Wave from Monday 9h, once.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!seen || reduced || played.current || !ctx) return;
    played.current = true;
    ctx.add(() => {
      gsap.to(gridRef.current?.querySelectorAll('[role="gridcell"]') ?? [], {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: "back.out(2)",
        stagger: {
          each: 0.012, // [column ratio, row ratio]: origin at Monday 9h. GSAP subtracts half a cell from the origin (originX = cols*rx - .5), hence 9.5 and 0.5.
          from: [9.5 / 24, 0.5 / 7],
          grid: [7, 24],
        },
        clearProps: "transform,opacity",
      });
    });
  }, [seen, reduced]);

  const show = (e: PointerEvent<HTMLDivElement>) => {
    const el = (e.target as Element).closest<HTMLElement>('[role="gridcell"]');
    const section = sectionRef.current;
    if (!el || !section) return setTip(null);
    const box = section.getBoundingClientRect();
    // `left` is set in the layout effect below, once the tooltip's width is known.
    setTip({
      text: el.getAttribute("aria-label") ?? "",
      x: (e.clientX || 0) - box.left,
      y: (e.clientY || 0) - box.top,
    });
  };

  // Center the tooltip on the pointer, clamped inside the section; measured after render
  // because its width depends on the text and it does not exist before the first show.
  useLayoutEffect(() => {
    const el = tipRef.current;
    const section = sectionRef.current;
    if (!tip || !el || !section) return;
    const half = el.offsetWidth / 2;
    const width = section.getBoundingClientRect().width;
    el.style.left = `${Math.min(Math.max(tip.x, half), Math.max(width - half, half))}px`;
  }, [tip]);

  // A touch tooltip has no pointerleave to dismiss it: tapping anywhere else does.
  const open = tip !== null;
  useEffect(() => {
    if (!open) return;
    const away = (e: globalThis.PointerEvent) => {
      if (!gridRef.current?.contains(e.target as Node)) setTip(null);
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <section ref={sectionRef} {...blockAnchor(blockId)} className={styles.heatmap}>
      <div className={styles.head}>
        <h2>{copy.heatmap.title}</h2>
        <p className={styles.lede}>{lede}</p>
        {criterion && <Criterion>{criterion}</Criterion>}
      </div>

      {people && people.length > 0 && (
        <div className={styles.chips}>
          {[
            {
              slug: GROUP,
              name: copy.heatmap.group,
              color: undefined as string | undefined,
            },
            ...people.map((p) => ({
              slug: p.slug,
              name: p.name,
              color: colorFor(p.colorIndex ?? -1),
            })),
          ].map((c) => (
            <button
              key={c.slug}
              type="button"
              className={styles.chip}
              aria-pressed={sel === c.slug}
              onClick={() => setSel(c.slug)}
            >
              {c.color && (
                <span className={styles.dot} style={{ background: c.color }} />
              )}
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div
        ref={gridRef}
        className={styles.grid}
        role="grid"
        aria-label={copy.heatmap.gridLabel}
        onPointerMove={show}
        onPointerDown={show}
        onPointerLeave={(e) => e.pointerType !== "touch" && setTip(null)}
      >
        <div className={styles.axis} aria-hidden="true">
          {HOURS.filter((h) => h % 3 === 0).map((h) => (
            <span
              key={h}
              className={
                h % 6 === 0 ? styles.hour : `${styles.hour} ${styles.minor}`
              }
              style={{ gridColumn: `${h + 2} / span 3` }}
            >
              {h}
            </span>
          ))}
        </div>
        {DAYS.map((day, d) => (
          <div key={day} className={styles.row} role="row">
            <span className={styles.day} role="rowheader">
              {day}
            </span>
            {HOURS.map((h) => {
              const v = data[d]?.[h] ?? 0;
              const isPeak = d === peakAt.d && h === peakAt.h;
              return (
                <div
                  key={h}
                  role="gridcell"
                  className={styles.cell}
                  data-v={v}
                  data-d={d}
                  data-h={h}
                  data-peak={isPeak ? "true" : undefined}
                  aria-label={label(d, h, v)}
                  style={{ backgroundColor: ramp(max > 0 ? v / max : 0) }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {peak && sel === GROUP && <p className={styles.peak}>{peak}</p>}

      {tip && (
        <div
          ref={tipRef}
          className={styles.tip}
          data-testid="heat-tooltip"
          aria-hidden="true"
          style={{ top: tip.y }}
        >
          {tip.text}
        </div>
      )}
      {copyLink && blockId && <CopyLink id={blockId} />}
    </section>
  );
}
