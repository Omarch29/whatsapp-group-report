"use client";

import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { MIN_GAP_DAYS } from "@/lib/census";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { fmtShortDate } from "@/lib/format";
import type { CensusData, Person } from "@/lib/schema";
import { dayIndex } from "@/lib/timeline";
import { useOnce } from "@/lib/useOnce";
import styles from "./Tenure.module.css";

type Props = {
  tenure: CensusData["tenure"];
  period: { from: string; to: string };
  people: Person[];
};

const pct = (n: number) => `${Number(Math.min(100, Math.max(0, n)).toFixed(3))}%`;
const nameOf = (slug: string, people: Person[]) =>
  people.find((p) => p.slug === slug)?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);

/** One bar per person from first to last message on the period's scale; long silences hatched. */
export function Tenure({ tenure, period, people }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.3);

  if (tenure.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  const span = Math.max(1, dayIndex(period.to, period.from));
  const at = (iso: string) => (dayIndex(iso, period.from) / span) * 100;
  // Stable sort: equal start dates keep the data's (people) order.
  const rows = [...tenure].sort((a, b) => a.from.localeCompare(b.from));
  const y0 = Number(period.from.slice(0, 4));
  const y1 = Number(period.to.slice(0, 4));
  const years = Array.from({ length: Math.max(0, y1 - y0) }, (_, k) => String(y0 + k + 1));

  return (
    <div ref={ref} className={styles.root}>
      <ol className={styles.rows} aria-label={copy.census.tenureLabel} data-seen={seen}>
        {rows.map((r, i) => {
          const name = nameOf(r.slug, people);
          const left = at(r.from);
          const right = at(r.to);
          const days = Math.max(1, dayIndex(r.to, r.from));
          const gaps = r.gaps.filter((g) => g.days > MIN_GAP_DAYS);
          const title = copy.census.tenureSpan(name, fmtShortDate(r.from), fmtShortDate(r.to));
          // role="img" hides the gap spans from screen readers, so the label names them.
          const label = [
            title,
            ...gaps.map((g) => copy.census.tenureGapSpoken(fmtShortDate(g.from), fmtShortDate(g.to), g.days)),
          ].join("; ");
          return (
            <li key={r.slug} className={styles.row} style={{ "--i": i } as CSSProperties}>
              <span className={styles.name} style={{ color: personTextColor(r.slug, people) }}>
                {name}
              </span>
              <span className={styles.lane}>
                <span
                  className={styles.bar}
                  data-testid="tenure-bar"
                  data-slug={r.slug}
                  role="img"
                  aria-label={label}
                  title={title}
                  style={{ left: pct(left), width: pct(right - left), "--c": colorForSlug(r.slug, people) } as CSSProperties}
                >
                  {gaps.map((g) => (
                    <span
                      key={g.from}
                      className={styles.gap}
                      data-testid="tenure-gap"
                      title={copy.census.tenureGap(fmtShortDate(g.from), fmtShortDate(g.to), g.days)}
                      style={{
                        left: pct((dayIndex(g.from, r.from) / days) * 100),
                        width: pct((dayIndex(g.to, g.from) / days) * 100),
                      }}
                    />
                  ))}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className={styles.axis} aria-hidden="true">
        <span />
        <span className={styles.ticks}>
          {years.map((y) => (
            <span key={y} className={`num ${styles.tick}`} style={{ left: pct(at(`${y}-01-01`)) }}>
              {y}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
