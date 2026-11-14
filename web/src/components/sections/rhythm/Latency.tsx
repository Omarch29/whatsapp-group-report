"use client";

import { scaleLog } from "d3-scale";
import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { fmtDate } from "@/lib/format";
import { personName } from "@/lib/language";
import { latencyDomain, latencyTicks } from "@/lib/rhythm";
import type { Person, RhythmData } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import chat from "../language/chat.module.css";
import styles from "./Latency.module.css";

type Props = {
  data: RhythmData["latency"];
  people: Person[];
  /** Profile mode: highlights this person's dots and dims the rest (or says there is nothing to measure). */
  person?: string;
  /** The export has no seconds (`global.timeResolution === "minute"`): say the times are per minute. */
  minuteResolution?: boolean;
};

const r = copy.rhythm;

/**
 * Reply speed on a log time axis: per person a filled dot for how fast they reply and a
 * hollow one for how fast they get replied, joined by a thin line. The dots slide in from
 * the right on first view.
 */
export function Latency({ data, people, person, minuteResolution }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.15);
  if (data.length === 0) return <p className={styles.empty}>{copy.empty}</p>;
  // The pipeline leaves out only someone with no replies: dimming every row would read as a bug.
  if (person && !data.some((d) => d.slug === person)) {
    return <p className={styles.empty}>{copy.profile.latencyEmpty}</p>;
  }

  const domain = latencyDomain(data.flatMap((d) => [d.medianFromSec, d.medianToSec]));
  const x = scaleLog().domain(domain).range([0, 100]).clamp(true);
  const rows = [...data].sort((a, b) => a.medianFromSec - b.medianFromSec || a.medianToSec - b.medianToSec);

  return (
    <div ref={ref} className={styles.root} data-seen={seen}>
      <ol className={styles.rows} aria-label={r.latencyLabel}>
        {rows.map((d, i) => {
          const name = personName(d.slug, people);
          const from = x(d.medianFromSec);
          const to = x(d.medianToSec);
          return (
            <li
              key={d.slug}
              className={styles.row}
              data-slug={d.slug}
              data-active={person ? person === d.slug : undefined}
              data-dim={person && person !== d.slug ? true : undefined}
              title={r.latencyRow(name, d.medianFromSec, d.medianToSec)}
              style={{ "--c": colorForSlug(d.slug, people), "--i": i } as CSSProperties}
            >
              <span className={styles.name} style={{ color: personTextColor(d.slug, people) }}>
                {name}
              </span>
              <span className={styles.track} aria-hidden="true">
                <span
                  className={styles.link}
                  style={{ left: `${Math.min(from, to)}%`, width: `${Math.abs(to - from)}%` }}
                />
                <span className={`${styles.dot} ${styles.to}`} data-testid="dot-to" style={{ left: `${to}%` }} />
                <span className={`${styles.dot} ${styles.from}`} data-testid="dot-from" style={{ left: `${from}%` }} />
              </span>
              <span className={styles.spoken}>{r.latencyRow(name, d.medianFromSec, d.medianToSec)}</span>
            </li>
          );
        })}
      </ol>
      <div className={styles.axis} aria-label={r.latencyAxis} role="img">
        {latencyTicks(domain).map((t) => (
          <span key={t} className={styles.tick} data-testid="tick" style={{ left: `${x(t)}%` }} aria-hidden="true">
            {r.tick(t)}
          </span>
        ))}
      </div>
      <ul className={styles.legend} aria-label={r.latencyLegend}>
        <li className={styles.legendItem}>
          <span className={`${styles.key} ${styles.from}`} aria-hidden="true" />
          {r.latencyFrom}
        </li>
        <li className={styles.legendItem}>
          <span className={`${styles.key} ${styles.to}`} aria-hidden="true" />
          {r.latencyTo}
        </li>
      </ul>
      {minuteResolution && <p className={styles.note}>{r.minuteNote}</p>}
    </div>
  );
}

type PairProps = { fastest: NonNullable<RhythmData["fastest"]>; people: Person[] };

/** The fastest reply: the question lands, the gap ticks, the answer arrives. */
export function FastestPair({ fastest, people }: PairProps) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useOnce(ref, 0.4);
  const { a, b, seconds } = fastest;
  const bubble = (m: typeof a, mine: boolean) => (
    <span className={`${chat.bubble} ${mine ? styles.mine : chat.tail}`}>
      <span className={chat.name} style={{ color: personTextColor(m.who, people) }}>
        {personName(m.who, people)}
      </span>
      <span className={styles.text}>{m.text}</span>
      <span className={chat.meta}>
        <span />
        <span>{fmtDate(m.when)}</span>
      </span>
    </span>
  );
  return (
    <ol ref={ref} className={`${chat.screen} ${styles.pair}`} aria-label={r.fastest.pair} data-seen={seen}>
      <li className={styles.msg} data-step="a">
        {bubble(a, false)}
      </li>
      <li className={styles.gap} data-step="gap">
        <span className={`num ${styles.gapTag}`}>{r.fastest.gap(seconds)}</span>
      </li>
      <li className={`${styles.msg} ${styles.msgB}`} data-step="b">
        {bubble(b, true)}
      </li>
    </ol>
  );
}
