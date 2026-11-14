"use client";

import { motion } from "motion/react";
import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { fmtShare } from "@/lib/format";
import { useReducedMotion } from "@/lib/motion";
import type { CensusData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./HourOfEach.module.css";

type Props = { data: CensusData["hourOfEach"]; people: Person[] };

const R = 44;
const RING = 48.5;
const CIRC = 2 * Math.PI * RING;
const TICKS = Array.from({ length: 24 }, (_, h) => h);
const EASE = [0.22, 1, 0.36, 1] as const;

const nameOf = (slug: string, people: Person[]) =>
  people.find((p) => p.slug === slug)?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);

/** 24-hour dial: 0 h at the top, clockwise. */
const angleOf = (hour: number) => (hour / 24) * 360;

function Face({ color, hour, share }: { color: string; hour: number; share: number }) {
  // The ring is the share of messages at that hour, centred on the hand.
  const arc = Math.max(0, Math.min(1, share)) * CIRC;
  const ringRotation = angleOf(hour) - 90 - share * 180;
  return (
    <svg viewBox="0 0 100 100" className={styles.face} aria-hidden="true">
      <circle cx="50" cy="50" r={R} className={styles.dial} />
      {TICKS.map((h) => {
        const major = h % 6 === 0;
        return (
          <line
            key={h}
            x1="50"
            y1={50 - R + 3}
            x2="50"
            y2={50 - R + (major ? 9 : 6)}
            className={major ? styles.major : styles.minor}
            transform={`rotate(${angleOf(h)} 50 50)`}
          />
        );
      })}
      <circle
        cx="50"
        cy="50"
        r={RING}
        className={styles.ring}
        stroke={color}
        strokeDasharray={`${arc} ${CIRC}`}
        transform={`rotate(${ringRotation} 50 50)`}
      />
    </svg>
  );
}

/** A row of 24-hour clocks: each person's busiest hour. Hands sweep from midnight on first view. */
export function HourOfEach({ data, people }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useOnce(ref, 0.3);
  const reduced = useReducedMotion();

  if (data.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  return (
    <ol ref={ref} className={styles.grid} aria-label={copy.census.hourLabel}>
      {data.map((d, i) => {
        const color = colorForSlug(d.slug, people);
        const deg = angleOf(d.hour);
        const hand = (
          <>
            <span className={styles.handBar} />
            <span className={styles.pivot} />
          </>
        );
        return (
          <li key={d.slug} className={styles.clock} style={{ "--c": color } as CSSProperties}>
            <span className={styles.dialWrap}>
              <Face color={color} hour={d.hour} share={d.share} />
              {reduced ? (
                <span
                  className={styles.hand}
                  data-testid="clock-hand"
                  data-hour={d.hour}
                  style={{ transform: `rotate(${deg}deg)` }}
                >
                  {hand}
                </span>
              ) : (
                <motion.span
                  className={styles.hand}
                  data-testid="clock-hand"
                  data-hour={d.hour}
                  initial={{ rotate: 0 }}
                  animate={{ rotate: seen ? deg : 0 }}
                  transition={{ duration: 1.2, ease: EASE, delay: i * 0.06 }}
                >
                  {hand}
                </motion.span>
              )}
            </span>
            <p className={styles.label} style={{ color: personTextColor(d.slug, people) }}>
              {copy.census.clock(nameOf(d.slug, people), d.hour)}
            </p>
            <p className={`num ${styles.share}`}>{fmtShare(d.share)}</p>
          </li>
        );
      })}
    </ol>
  );
}

type Share = CensusData["earlyBird"];

function ShareCard({ kind, rec, people }: { kind: "earlyBird" | "owl"; rec: NonNullable<Share>; people: Person[] }) {
  const c = copy.census[kind];
  return (
    <div className={styles.record}>
      <p className={styles.recordLabel}>{c.label}</p>
      <p className={`num ${styles.gold}`}>{fmtShare(rec.share)}</p>
      <p className={styles.recordCaption}>
        <b style={{ color: personTextColor(rec.slug, people) }}>{nameOf(rec.slug, people)}</b>
        <span>{` · ${c.caption}`}</span>
      </p>
    </div>
  );
}

/** Record of the hour block: the earliest bird and the owl, by share of their own messages. */
export function ShareRecords({ earlyBird, owl, people }: { earlyBird: Share; owl: Share; people: Person[] }) {
  if (!earlyBird && !owl) return null;
  return (
    <div className={styles.records}>
      {earlyBird && <ShareCard kind="earlyBird" rec={earlyBird} people={people} />}
      {owl && <ShareCard kind="owl" rec={owl} people={people} />}
    </div>
  );
}
