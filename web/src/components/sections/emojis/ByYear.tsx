"use client";

import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { mostConstant } from "@/lib/emojis";
import { fmt } from "@/lib/format";
import type { EmojisData } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./ByYear.module.css";

type Props = { data: EmojisData["byYear"] };

/** Seconds between one year's column and the next. */
const YEAR_STEP = 0.6;
const RANK_STEP = 0.07;

/**
 * Each year's top 5 as a column of short bars on one shared scale. Once seen the columns
 * fill year by year (0.6 s apart), a tiny race through time; the number one of each year is
 * gold and the emoji that stayed in the top 5 the most years is marked.
 */
export function ByYear({ data }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.2);

  if (data.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  const max = Math.max(1, ...data.flatMap((y) => y.top.map((t) => t.n)));
  const constant = mostConstant(data);
  const marked = constant && constant.years > 1 ? constant.e : null;

  return (
    <div ref={ref} className={styles.root} data-seen={seen}>
      <ol className={styles.years} aria-label={copy.emojis.byYearLabel}>
        {data.map((y, yi) => (
          <li key={y.year} className={styles.year}>
            <span className={`num ${styles.label}`}>{y.year}</span>
            <ol className={styles.top} aria-label={copy.emojis.yearLabel(y.year)}>
              {y.top.map((t, ri) => (
                <li
                  key={t.e}
                  className={styles.row}
                  data-e={t.e}
                  data-leader={ri === 0 || undefined}
                  data-constant={t.e === marked || undefined}
                  style={{ "--d": `${yi * YEAR_STEP + ri * RANK_STEP}s` } as CSSProperties}
                >
                  <span className={styles.emoji}>{t.e}</span>
                  <span className={styles.track}>
                    <span
                      className={styles.bar}
                      data-testid="year-emoji-bar"
                      style={{ width: `${(t.n / max) * 100}%` }}
                    />
                  </span>
                  <span className={`num ${styles.n}`}>{fmt(t.n)}</span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
