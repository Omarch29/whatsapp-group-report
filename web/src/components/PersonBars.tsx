"use client";

import { motion } from "motion/react";
import { useRef, type CSSProperties } from "react";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { personName } from "@/lib/language";
import { useReducedMotion } from "@/lib/motion";
import type { Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./PersonBars.module.css";

export type BarRow = {
  slug: string;
  value: number;
  /** The formatted value at the end of the row. */
  display: string;
  /** Row tooltip. */
  title?: string;
  /** Replaces the person's name (e.g. "alguien más" for `resto`). */
  name?: string;
};

type Props = {
  rows: readonly BarRow[];
  people: readonly Person[];
  /** Accessible name of the list. */
  label: string;
  /** useOnce ratio; tall lists need a small one. */
  threshold?: number;
};

/** Horizontal bars by person, in the order given, in the person's colour. Bars grow on first view and slide on re-sort. */
export function PersonBars({ rows, people, label, threshold = 0.15 }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useOnce(ref, threshold);
  const reduced = useReducedMotion();
  const max = Math.max(1e-9, ...rows.map((r) => r.value));

  return (
    <ol ref={ref} className={styles.bars} aria-label={label} data-seen={seen}>
      {rows.map((r, i) => (
        <motion.li
          key={r.slug}
          layout={reduced ? false : "position"}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className={styles.row}
          data-slug={r.slug}
          title={r.title}
          style={{ "--c": colorForSlug(r.slug, people), "--i": i } as CSSProperties}
        >
          <span className={styles.name} style={{ color: personTextColor(r.slug, people) }}>
            {r.name ?? personName(r.slug, people)}
          </span>
          <span className={styles.track}>
            <span className={styles.bar} data-testid="bar" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className={`num ${styles.value}`}>{r.display}</span>
        </motion.li>
      ))}
    </ol>
  );
}
