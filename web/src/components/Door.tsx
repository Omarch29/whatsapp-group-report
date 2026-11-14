"use client";

import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/motion";
import styles from "./Door.module.css";

type Props = {
  /** How many times the leaf opens and closes. */
  swings: number;
  /** Seconds for all swings together. */
  duration: number;
  /** The swinging starts (once) when this becomes true. */
  play: boolean;
};

const OPEN_DEG = -95;
/** > 1 makes the first swings long and the last ones short. */
const ACCEL = 1.3;

/**
 * Start time of every swing, plus the end: `swings + 1` ascending values from 0 to `duration`.
 * Gaps shrink steadily, so the door starts lazy and ends frantic.
 */
export function swingTimes(swings: number, duration: number): number[] {
  return Array.from({ length: swings + 1 }, (_, i) => (1 - (1 - i / swings) ** ACCEL) * duration);
}

/** A door whose leaf swings open and shut at an accelerating cadence; decorative. */
export function Door({ swings, duration, play }: Props) {
  const reduced = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!play || reduced) return;
    const ctx = gsap.context(() => {
      const times = swingTimes(swings, duration);
      const tl = gsap.timeline();
      for (let i = 0; i < swings; i++) {
        const half = (times[i + 1]! - times[i]!) / 2;
        tl.to("[data-leaf]", { rotateY: OPEN_DEG, duration: half, ease: "power1.out" }, times[i]);
        tl.to("[data-leaf]", { rotateY: 0, duration: half, ease: "power1.in" }, times[i]! + half);
      }
    }, frameRef);
    return () => ctx.revert();
  }, [play, reduced, swings, duration]);

  return (
    <div ref={frameRef} className={styles.frame} data-testid="door" aria-hidden="true">
      <span className={styles.face}>🧔🏽</span>
      <div className={styles.leaf} data-leaf data-testid="door-leaf">
        <i className={styles.knob} />
      </div>
    </div>
  );
}
