"use client";

import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { personTextColor } from "@/lib/colors";
import { fmt } from "@/lib/format";
import { personName } from "@/lib/language";
import { starterRows } from "@/lib/rhythm";
import type { Person, RhythmData } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./StartersKillers.module.css";

type Props = { starters: RhythmData["starters"]; killers: RhythmData["killers"]; people: Person[] };

const r = copy.rhythm;
const SERIES = [
  { key: "kills", label: r.kills, color: "var(--ribbon)" },
  { key: "starts", label: r.starts, color: "var(--mint)" },
] as const;

/**
 * Who starts the chat after 3 h of silence (mint, to the right) and who sends the last
 * message before one (ribbon, to the left): mirrored bars on one shared scale, growing
 * out from the names in the middle on first view.
 */
export function StartersKillers({ starters, killers, people }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useOnce(ref, 0.15);
  const rows = starterRows(starters, killers);
  if (rows.length === 0) return <p className={styles.empty}>{copy.empty}</p>;
  const max = Math.max(1, ...rows.flatMap((row) => [row.starts, row.kills]));

  return (
    <div className={styles.root}>
      <ul className={styles.legend} aria-label={r.startersLegend}>
        {SERIES.map((s) => (
          <li key={s.key} className={styles.legendItem} data-series={s.key}>
            {s.key === "kills" && <span aria-hidden="true">← </span>}
            <span className={styles.dot} style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.label}
            {s.key === "starts" && <span aria-hidden="true"> →</span>}
          </li>
        ))}
      </ul>
      <ol ref={ref} className={styles.rows} aria-label={r.startersLabel} data-seen={seen}>
        {rows.map((row, i) => {
          const name = personName(row.slug, people);
          return (
            <li key={row.slug} className={styles.row} data-slug={row.slug} style={{ "--i": i } as CSSProperties}>
              {SERIES.map((s) => {
                const v = row[s.key];
                const bar = (
                  <span className={styles.track}>
                    <span
                      className={styles.bar}
                      data-testid={`${s.key}-bar`}
                      title={r.barTitle(name, s.label, v)}
                      style={{ width: `${(v / max) * 100}%`, "--c": s.color } as CSSProperties}
                    />
                  </span>
                );
                const value = <span className={`num ${styles.value}`}>{fmt(v)}</span>;
                return (
                  <span key={s.key} className={styles.side} data-side={s.key}>
                    {s.key === "kills" ? (
                      <>
                        {value}
                        {bar}
                      </>
                    ) : (
                      <>
                        {bar}
                        {value}
                      </>
                    )}
                  </span>
                );
              })}
              <span className={styles.name} style={{ color: personTextColor(row.slug, people) }}>
                {name}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
