"use client";

import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { fmt } from "@/lib/format";
import { peakIndex } from "@/lib/media";
import type { RhythmData } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./Rings.module.css";

type Props = { data: RhythmData["rings"] };

const r = copy.rhythm;
const SIZE = 220;
const C = SIZE / 2;
const R = 70;
const LABEL_R = R + 25;
const CIRC = 2 * Math.PI * R;
/** Degrees left empty between slots. */
const GAP = 3;

type RingProps = { label: string; values: readonly number[]; names: readonly string[]; seen: boolean };

/**
 * One slot per day (or month) around the ring; each slot's arc fills in proportion to the
 * busiest one, which is gold. Arcs sweep in (stroke-dashoffset) one after another.
 */
function Ring({ label, values, names, seen }: RingProps) {
  const n = values.length;
  const slot = 360 / n;
  const slotLen = (CIRC * (slot - GAP)) / 360;
  const max = Math.max(1, ...values);
  const peak = peakIndex(values);

  return (
    <figure className={styles.ring} aria-label={label}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={styles.svg} aria-hidden="true">
        {values.map((v, i) => {
          const start = -90 + i * slot + GAP / 2;
          const len = (slotLen * v) / max;
          const mid = ((start + (slot - GAP) / 2) * Math.PI) / 180;
          return (
            <g key={i}>
              <circle
                cx={C}
                cy={C}
                r={R}
                className={styles.track}
                strokeDasharray={`${slotLen} ${CIRC}`}
                transform={`rotate(${start} ${C} ${C})`}
              />
              <circle
                cx={C}
                cy={C}
                r={R}
                className={styles.seg}
                data-testid="segment"
                data-label={names[i]}
                data-peak={i === peak}
                strokeDasharray={`${len} ${CIRC}`}
                transform={`rotate(${start} ${C} ${C})`}
                style={{ strokeDashoffset: seen ? 0 : len, "--i": i } as CSSProperties}
              >
                <title>{r.segment(names[i]!, v)}</title>
              </circle>
              <text
                x={C + LABEL_R * Math.cos(mid)}
                y={C + LABEL_R * Math.sin(mid)}
                className={styles.label}
                data-peak={i === peak}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {names[i]}
              </text>
            </g>
          );
        })}
        {peak >= 0 && (
          <>
            <text x={C} y={C - 9} className={styles.centerName} textAnchor="middle" dominantBaseline="central">
              {names[peak]}
            </text>
            <text x={C} y={C + 12} className={styles.centerValue} textAnchor="middle" dominantBaseline="central">
              {fmt(values[peak]!)}
            </text>
          </>
        )}
      </svg>
      <figcaption className={styles.caption}>{label}</figcaption>
      <ol className={styles.spoken}>
        {values.map((v, i) => (
          <li key={i}>{r.segment(names[i]!, v)}</li>
        ))}
      </ol>
    </figure>
  );
}

/** Messages by weekday and by month of the year, as two rings. */
export function Rings({ data }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.3);
  return (
    <div ref={ref} className={styles.root} data-seen={seen}>
      <Ring label={r.dowLabel} values={data.dow} names={copy.dowShort} seen={seen} />
      <Ring label={r.monthLabel} values={data.month} names={copy.monthsShort} seen={seen} />
    </div>
  );
}
