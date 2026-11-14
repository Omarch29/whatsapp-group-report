"use client";

import { animate } from "motion";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CopyLink, Criterion } from "@/components/report/Block";
import { blockAnchor } from "@/lib/blockAnchor";
import { colorForSlug } from "@/lib/colors";
import { copy } from "../../../content/copy";
import { fmt, fmtMonth } from "@/lib/format";
import { useReducedMotion } from "@/lib/motion";
import { cumulative, orderAt } from "@/lib/race";
import type { Person } from "@/lib/schema";
import { usePin } from "@/lib/scrollPins";
import { useOnce } from "@/lib/useOnce";
import styles from "./Race.module.css";

type Props = {
  months: string[];
  series: Record<string, number[]>;
  /** Profiled people; `resto` and anyone missing from `series` is left out. */
  people: Person[];
  highlight?: string;
  lede: string;
  /** Start playing once when the section scrolls into view (default true). */
  autoplay?: boolean;
  /** Chapter block id for this section (anchor + sidebar spy); none on profiles. */
  blockId?: string;
  /** Chapter anatomy (chapter pages, not profiles): how the chart counts, in one line under the lede. */
  criterion?: string;
  /** Chapter anatomy: a «Copiar link» button for `blockId` at the end of the section. */
  copyLink?: boolean;
};

const STEP_MS = 650;
const DURATION = 0.5;
/** Power2 in-out, as in the prototype. */
const EASE = [0.65, 0, 0.35, 1] as const;

/** Counts from the previous value to `value`; writes straight to the DOM so rows don't re-render per frame. */
function Count({ value, reduced }: { value: number; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  // React renders this text once and never touches it again; the effect owns every later update.
  const [initial] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      shown.current = value;
      el.textContent = fmt(value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration: DURATION,
      ease: EASE,
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = fmt(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduced]);

  return <span ref={ref}>{fmt(initial)}</span>;
}

/** Cumulative-messages bar race: rows reorder with a layout animation as months advance. */
export function Race({ months, series, people, highlight, lede, autoplay = true, blockId, criterion, copyLink }: Props) {
  const reduced = useReducedMotion();
  const last = Math.max(0, months.length - 1);
  const sectionRef = useRef<HTMLElement>(null);
  const seen = useOnce(sectionRef);
  usePin(sectionRef);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);

  const profiled = useMemo(
    () => people.filter((p) => p.slug !== "resto" && series[p.slug] !== undefined),
    [people, series],
  );
  const cum = useMemo(
    () => cumulative(Object.fromEntries(profiled.map((p) => [p.slug, series[p.slug] ?? []]))),
    [profiled, series],
  );
  const bySlug = useMemo(() => new Map(profiled.map((p) => [p.slug, p])), [profiled]);

  const order = orderAt(cum, cur);
  const leader = order[0] ? (cum[order[0]]?.[cur] ?? 0) : 0;
  const transition = reduced ? { duration: 0 } : { duration: DURATION, ease: EASE };

  // Playing stops by itself on the last month, which also clears the interval.
  const running = playing && cur < last;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setCur((c) => Math.min(c + 1, last)), STEP_MS);
    return () => clearInterval(id);
  }, [running, last]);

  // First time the section is seen: play (or, under reduced motion, show the final month).
  const [started, setStarted] = useState(false);
  if (autoplay && seen && !started) {
    setStarted(true);
    if (reduced) setCur(last);
    else setPlaying(true);
  }

  const toggle = () => {
    if (running) return setPlaying(false);
    if (cur >= last) setCur(0);
    setPlaying(true);
  };
  const reset = () => {
    setPlaying(false);
    setCur(0);
  };

  return (
    <section ref={sectionRef} {...blockAnchor(blockId)} className={styles.race}>
      <div className={styles.head}>
        <h2>{copy.race.title}</h2>
        <p className={styles.lede}>{lede}</p>
        {criterion && <Criterion>{criterion}</Criterion>}
      </div>

      <p className={`num ${styles.month}`} data-month={months[cur]}>
        {months[cur]}
      </p>

      <div className={styles.controls}>
        <button type="button" className={styles.btn} onClick={toggle}>
          {running ? copy.race.pause : copy.race.play}
        </button>
        <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={reset}>
          {copy.race.reset}
        </button>
        <input
          type="range"
          className={styles.scrub}
          min={0}
          max={last}
          step={1}
          value={cur}
          aria-label={copy.race.monthLabel}
          aria-valuetext={months[cur] ? fmtMonth(months[cur]) : undefined}
          onChange={(e) => {
            setPlaying(false);
            setCur(Number(e.target.value));
          }}
        />
      </div>

      <div className={styles.list} role="list">
        {order.map((slug) => {
          const person = bySlug.get(slug);
          if (!person) return null;
          const value = cum[slug]?.[cur] ?? 0;
          const zero = value === 0;
          const scale = zero || leader === 0 ? 0 : Math.max(0.004, value / leader);
          return (
            <motion.div
              key={slug}
              role="listitem"
              layout="position"
              layoutId={`race-${slug}`}
              className={styles.row}
              data-testid={`row-${slug}`}
              data-zero={zero ? "true" : "false"}
              data-highlight={slug === highlight ? "true" : undefined}
              initial={false}
              animate={{ opacity: zero ? 0.25 : 1 }}
              transition={{ layout: transition, opacity: transition }}
            >
              <span className={styles.name}>{person.name}</span>
              <div className={styles.track}>
                <motion.div
                  className={styles.bar}
                  style={{ background: colorForSlug(slug, profiled) }}
                  initial={false}
                  animate={{ scaleX: scale }}
                  transition={transition}
                />
              </div>
              <span className={styles.val}>
                <Count value={value} reduced={reduced} />
              </span>
            </motion.div>
          );
        })}
      </div>
      {copyLink && blockId && <CopyLink id={blockId} />}
    </section>
  );
}
