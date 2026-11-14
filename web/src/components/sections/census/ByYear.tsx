"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { colorForSlug } from "@/lib/colors";
import { fmt } from "@/lib/format";
import type { CensusData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./ByYear.module.css";

type Mode = "total" | "perMil";

type Props = {
  data: CensusData["byYear"];
  /** Global people, in the order the stacks are drawn (bottom first); anyone not in `series` is skipped. */
  people: Person[];
};

/** Per mil of each person's own messages: year / (sum of that person's years) × 1000. */
export function perMilSeries(series: Record<string, number[]>): Record<string, number[]> {
  return Object.fromEntries(
    Object.entries(series).map(([slug, values]) => {
      const total = values.reduce((a, b) => a + b, 0);
      return [slug, values.map((v) => (total > 0 ? (v / total) * 1000 : 0))];
    }),
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Messages per year stacked by person, with a total / per-mil toggle. Bars rise on first view. */
export function ByYear({ data, people }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.3);
  const [mode, setMode] = useState<Mode>("total");
  const perMil = useMemo(() => perMilSeries(data.series), [data.series]);
  const order = useMemo(() => people.filter((p) => data.series[p.slug] !== undefined), [people, data.series]);

  if (data.years.length === 0 || order.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  const series = mode === "total" ? data.series : perMil;
  const sums = data.years.map((_, yi) => order.reduce((acc, p) => acc + (series[p.slug]?.[yi] ?? 0), 0));
  const max = Math.max(1, ...sums);
  const show = (v: number) => (mode === "total" ? fmt(v) : `${fmt(round1(v))} ‰`);

  return (
    <div ref={ref} className={styles.root}>
      <div className={styles.toggle} role="group" aria-label={copy.census.modeLabel}>
        {(["total", "perMil"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={styles.chip}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {m === "total" ? copy.census.total : copy.census.perMil}
          </button>
        ))}
      </div>

      <ol className={styles.bars} aria-label={copy.census.byYearLabel} data-seen={seen}>
        {data.years.map((year, yi) => {
          const sum = sums[yi] ?? 0;
          return (
            <li key={year} className={styles.col} data-testid="year-bar" style={{ "--i": yi } as CSSProperties}>
              {/* A sum of per-mils means nothing, so per mil keeps only the segment titles. */}
              {mode === "total" ? (
                <span className={`num ${styles.total}`} data-testid="year-total">
                  {fmt(Math.round(sum))}
                </span>
              ) : (
                <span className={`num ${styles.total}`} aria-hidden="true">
                  {"\u00a0"}
                </span>
              )}
              <span className={styles.plot}>
                <span className={styles.stack} style={{ height: `${(sum / max) * 100}%` }}>
                  {order.map((p) => {
                    const v = series[p.slug]?.[yi] ?? 0;
                    if (v <= 0) return null;
                    return (
                      <span
                        key={p.slug}
                        className={styles.seg}
                        data-testid="year-seg"
                        data-slug={p.slug}
                        title={copy.census.yearSeg(p.name, year, show(v))}
                        style={{ height: `${(v / sum) * 100}%`, backgroundColor: colorForSlug(p.slug, people) }}
                      />
                    );
                  })}
                </span>
              </span>
              <span className={`num ${styles.year}`}>{year}</span>
            </li>
          );
        })}
      </ol>

      <ul className={styles.legend} aria-label={copy.census.legendLabel}>
        {order.map((p) => (
          <li key={p.slug} className={styles.legendItem}>
            <span className={styles.dot} style={{ backgroundColor: colorForSlug(p.slug, people) }} aria-hidden="true" />
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
