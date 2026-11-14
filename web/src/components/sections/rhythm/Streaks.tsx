"use client";

import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { personTextColor } from "@/lib/colors";
import { fmtDate } from "@/lib/format";
import { personName } from "@/lib/language";
import type { Person, RhythmData } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./Streaks.module.css";

type Props = { data: RhythmData["streaks"]; people: Person[] };

const r = copy.rhythm;
const SERIES = [
  { key: "streak", label: r.streak, color: "var(--mint)" },
  { key: "silence", label: r.silence, color: "var(--dim)" },
] as const;

/** Each person's longest streak (mint) and longest silence (dim), in days on one shared scale; bars grow on first view. */
export function Streaks({ data, people }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useOnce(ref, 0.1);
  if (data.length === 0) return <p className={styles.empty}>{copy.empty}</p>;
  const rows = [...data].sort((a, b) => b.streak.days - a.streak.days || b.silence.days - a.silence.days);
  const max = Math.max(1, ...rows.flatMap((row) => [row.streak.days, row.silence.days]));

  return (
    <div className={styles.root}>
      <ol ref={ref} className={styles.rows} aria-label={r.streaksLabel} data-seen={seen}>
        {rows.map((row, i) => {
          const name = personName(row.slug, people);
          return (
            <li key={row.slug} className={styles.row} data-slug={row.slug} style={{ "--i": i } as CSSProperties}>
              <span className={styles.name} style={{ color: personTextColor(row.slug, people) }}>
                {name}
              </span>
              <span className={styles.series}>
                {SERIES.map((s) => {
                  const span = row[s.key];
                  const title = r.spanTitle(name, s.label, span.days, fmtDate(span.from), fmtDate(span.to));
                  return (
                    <span key={s.key} className={styles.line}>
                      <span className={styles.track}>
                        <span
                          className={styles.bar}
                          data-testid={`${s.key}-bar`}
                          title={title}
                          style={{ width: `${(span.days / max) * 100}%`, "--c": s.color } as CSSProperties}
                        />
                      </span>
                      <span className={`num ${styles.value}`}>{r.days(span.days)}</span>
                    </span>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ol>
      <ul className={styles.legend} aria-label={r.streaksLegend}>
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
