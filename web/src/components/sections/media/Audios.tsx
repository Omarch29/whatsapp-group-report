"use client";

import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { PersonBars } from "@/components/PersonBars";
import { fmt } from "@/lib/format";
import { personName } from "@/lib/language";
import { peakIndex } from "@/lib/media";
import type { MediaData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./Audios.module.css";

type Props = { data: MediaData["audios"]; people: Person[] };

const m = copy.media;
// Waveform geometry (viewBox units): 24 bars of BAR_W with GAP between them, HEIGHT tall.
const BAR_W = 6;
const GAP = 4;
const HEIGHT = 80;
const MIN_H = 2;
const HOUR_TICKS = [0, 6, 12, 18, 23];

/** Audios by person (bars), by hour of day (a voice-note waveform that grows from the baseline) and by year. */
export function Audios({ data, people }: Props) {
  const waveRef = useRef<SVGSVGElement>(null);
  const waveSeen = useOnce(waveRef, 0.3);
  const yearsRef = useRef<HTMLOListElement>(null);
  const yearsSeen = useOnce(yearsRef, 0.3);

  const hourMax = Math.max(0, ...data.byHour);
  if (data.byPerson.length === 0 && hourMax === 0) return <p className={styles.empty}>{copy.empty}</p>;

  const peak = peakIndex(data.byHour);
  const yearMax = Math.max(1, ...data.byYear.n);
  const width = data.byHour.length * (BAR_W + GAP);

  return (
    <div className={styles.root}>
      <PersonBars
        label={m.audiosByPerson}
        people={people}
        rows={data.byPerson.map((p) => ({
          slug: p.slug,
          value: p.n,
          display: fmt(p.n),
          title: m.perMilTitle(personName(p.slug, people), p.perMil),
        }))}
      />

      <figure className={styles.wave}>
        <svg
          ref={waveRef}
          className={styles.waveSvg}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={m.audiosByHour}
          data-seen={waveSeen}
        >
          {data.byHour.map((n, h) => {
            const hgt = hourMax > 0 ? Math.max(MIN_H, (n / hourMax) * HEIGHT) : MIN_H;
            return (
              <rect
                key={h}
                className={styles.waveBar}
                data-testid="wave-bar"
                data-peak={h === peak || undefined}
                x={h * (BAR_W + GAP) + GAP / 2}
                y={HEIGHT - hgt}
                width={BAR_W}
                height={hgt}
                rx={BAR_W / 2}
                style={{ "--i": h } as CSSProperties}
              >
                <title>{m.hourBar(h, n)}</title>
              </rect>
            );
          })}
        </svg>
        <div className={styles.hours} aria-hidden="true">
          {HOUR_TICKS.map((h) => (
            <span key={h} style={{ left: `${((h * (BAR_W + GAP) + GAP / 2 + BAR_W / 2) / width) * 100}%` }}>
              {`${h} h`}
            </span>
          ))}
        </div>
      </figure>

      {data.byYear.years.length > 0 && (
        <ol ref={yearsRef} className={styles.years} aria-label={m.audiosByYear} data-seen={yearsSeen}>
          {data.byYear.years.map((y, i) => {
            const n = data.byYear.n[i] ?? 0;
            return (
              <li key={y} className={styles.year} style={{ "--i": i } as CSSProperties}>
                {/* Year first for screen readers; the grid draws it under the bar. */}
                <span className={`num ${styles.yearLabel}`}>{y}</span>
                <span className={`num ${styles.yearN}`}>{fmt(n)}</span>
                <span className={styles.yearPlot}>
                  <span className={styles.yearBar} style={{ height: `${(n / yearMax) * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
