"use client";

import { gsap } from "gsap";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { ModeToggle, type Mode } from "@/components/ModeToggle";
import { personTextColor } from "@/lib/colors";
import { fmt } from "@/lib/format";
import { personName } from "@/lib/language";
import { useReducedMotion } from "@/lib/motion";
import type { MediaData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./DeletedEdited.module.css";

type Props = { data: MediaData["deletedEdited"]; people: Person[] };
type Row = MediaData["deletedEdited"]["byPerson"][number];

const m = copy.media;
const SERIES = [
  { key: "deleted", label: m.deleted, color: "var(--ribbon)" },
  { key: "edited", label: m.edited, color: "var(--gold)" },
] as const;
const GHOSTS = 3;

const valueOf = (r: Row, series: "deleted" | "edited", mode: Mode) =>
  mode === "total" ? r[series] : series === "deleted" ? r.deletedPerMil : r.editedPerMil;

/**
 * Deleted and edited messages per person: two bars each on one shared scale, per mil by
 * default (the lede's measure) with a total toggle. Beside them, «Se eliminó este mensaje»
 * bubbles come and go in a loop (still under reduced motion, paused in a hidden tab).
 */
export function DeletedEdited({ data, people }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useOnce(ref, 0.1);
  const loopRef = useRef<HTMLDivElement>(null);
  const loopSeen = useOnce(loopRef, 0.3);
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>("perMil");

  useEffect(() => {
    const el = loopRef.current;
    if (!loopSeen || reduced || !el) return;
    let tl: gsap.core.Timeline | undefined;
    const ctx = gsap.context(() => {
      const ghosts = gsap.utils.toArray<HTMLElement>("[data-ghost]");
      tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
      ghosts.forEach((g, i) => {
        tl!.fromTo(g, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, i * 0.8);
      });
      tl.to(ghosts, { opacity: 0, y: -6, duration: 0.45, ease: "power2.in", stagger: 0.8 }, 0.8 * ghosts.length + 0.6);
    }, el);
    const onVisibility = () => (document.hidden ? tl?.pause() : tl?.resume());
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      ctx.revert();
    };
  }, [loopSeen, reduced]);

  if (data.byPerson.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  const rows = [...data.byPerson].sort(
    (a, b) =>
      valueOf(b, "deleted", mode) - valueOf(a, "deleted", mode) ||
      valueOf(b, "edited", mode) - valueOf(a, "edited", mode),
  );
  const max = Math.max(1e-9, ...rows.flatMap((r) => SERIES.map((s) => valueOf(r, s.key, mode))));
  const show = (v: number) => (mode === "total" ? fmt(v) : `${fmt(v)} ‰`);

  return (
    <div className={styles.root}>
      <div ref={loopRef} className={styles.loop} data-loop aria-hidden="true" data-static={reduced || undefined}>
        {Array.from({ length: GHOSTS }, (_, i) => (
          <p key={i} className={styles.ghost} data-ghost>
            <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3.6 12.4 12.4 3.6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {m.deletedBubble}
          </p>
        ))}
      </div>

      <ModeToggle value={mode} onChange={setMode} />
      <ol ref={ref} className={styles.bars} aria-label={m.deletedLabel} data-seen={seen}>
        {rows.map((r, i) => {
          const name = personName(r.slug, people);
          return (
            <motion.li
              key={r.slug}
              layout={reduced ? false : "position"}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className={styles.row}
              data-slug={r.slug}
              style={{ "--i": i } as CSSProperties}
            >
              <span className={styles.name} style={{ color: personTextColor(r.slug, people) }}>
                {name}
              </span>
              <span className={styles.series}>
                {SERIES.map((s) => {
                  const v = valueOf(r, s.key, mode);
                  return (
                    <span key={s.key} className={styles.line}>
                      <span className={styles.track}>
                        <span
                          className={styles.bar}
                          data-testid="series-bar"
                          data-series={s.key}
                          title={m.seriesTitle(name, s.label, show(v))}
                          style={{ width: `${(v / max) * 100}%`, "--c": s.color } as CSSProperties}
                        />
                      </span>
                      <span className={`num ${styles.value}`}>{show(v)}</span>
                    </span>
                  );
                })}
              </span>
            </motion.li>
          );
        })}
      </ol>
      <ul className={styles.legend} aria-label={m.deletedLegend}>
        {SERIES.map((s) => (
          <li key={s.key} className={styles.legendItem}>
            <span className={styles.dot} style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
