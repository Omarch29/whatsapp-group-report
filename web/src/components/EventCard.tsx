"use client";

import { motion } from "motion/react";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { copy } from "../../content/copy";
import { fmt, fmtDate } from "@/lib/format";
import { useReducedMotion } from "@/lib/motion";
import type { EventData } from "@/lib/schema";
import styles from "./EventCard.module.css";

type Props = { event: EventData; rank: number };

const MAX_SAMPLES = 3;
const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;
const INSTANT = { duration: 0 } as const;

/**
 * A flip card: rank, title and numbers on the front; how it started (chat bubbles) and a
 * note on the back. Flips on mouse hover, Enter/Space and touch taps.
 * Sample text is always rendered as text nodes (escaped), never as HTML.
 */
export function EventCard({ event, rank }: Props) {
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const id = useId();
  const metaId = `${id}-meta`;
  const backId = `${id}-back`;
  // Pointer type of the press that is about to produce a click. A mouse click lands after
  // the hover already flipped the card: don't undo it. A click with no preceding press
  // (assistive tech, synthetic) leaves it null and toggles.
  const pointer = useRef<string | null>(null);

  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === "mouse") setFlipped(true);
  };
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") setFlipped(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (e.repeat) return;
    setFlipped((f) => !f);
  };

  return (
    <div
      className={styles.card}
      data-testid="event-card"
      data-kind={event.kind}
      tabIndex={0}
      role="button"
      aria-pressed={flipped}
      aria-label={event.title}
      aria-describedby={`${metaId} ${backId}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={(e) => {
        pointer.current = e.pointerType;
      }}
      onClick={() => {
        const type = pointer.current;
        pointer.current = null;
        if (type !== "mouse") setFlipped((f) => !f);
      }}
      onKeyDown={onKeyDown}
    >
      <motion.div
        className={styles.inner}
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduced ? INSTANT : SPRING}
      >
        <div className={`${styles.face} ${styles.front}`}>
          <p className={`num ${styles.rank}`}>{rank}</p>
          <h3 className={styles.title}>{event.title}</h3>
          <div id={metaId} className={styles.meta}>
            <p>
              <strong>{fmt(event.laterDays)}</strong> {copy.events.laterDays(event.laterDays)}
            </p>
            <p>
              {copy.events.kind[event.kind]} · {copy.events.origin} {fmtDate(event.originDate)}
            </p>
            <p>
              <strong>{fmt(event.originMsgs)}</strong> {copy.events.originMsgs(event.originMsgs)}
            </p>
          </div>
        </div>
        <div id={backId} className={`${styles.face} ${styles.back}`}>
          <div className={styles.bubbles}>
            {event.sampleOrigin.slice(0, MAX_SAMPLES).map((line, i) => (
              <p key={`${i}-${line}`} className={styles.bubble}>
                {line}
              </p>
            ))}
          </div>
          <p className={styles.note}>{event.note}</p>
        </div>
      </motion.div>
    </div>
  );
}
