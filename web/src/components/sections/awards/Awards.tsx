"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "../../../../content/copy";
import { useReducedMotion } from "@/lib/motion";
import type { Nicknames } from "@/lib/nicknames";
import type { AwardsData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./Awards.module.css";
import { Envelope } from "./Envelope";

type Props = { awards: AwardsData; people: Person[]; nicknames: Nicknames };

/** Delay between two envelopes opening by themselves on desktop. */
export const OPEN_STAGGER_MS = 300;
const DESKTOP = "(hover: hover) and (min-width: 1024px)";

/**
 * The twelve awards as sealed envelopes. On desktop with a hovering pointer they open by
 * themselves once the grid is in view, one every 300 ms; on phones each opens on tap. Under
 * reduced motion they are all open. A tap always wins over the automatic opening.
 */
export function Awards({ awards, people, nicknames }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useOnce(ref, 0.15);
  const reduced = useReducedMotion();
  const [auto, setAuto] = useState<ReadonlySet<string>>(() => new Set());
  const [tapped, setTapped] = useState<Readonly<Record<string, boolean>>>({});

  useEffect(() => {
    if (!seen || reduced || typeof window.matchMedia !== "function" || !window.matchMedia(DESKTOP).matches) return;
    const timers = awards.map((a, i) =>
      setTimeout(() => setAuto((prev) => new Set(prev).add(a.id)), i * OPEN_STAGGER_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [seen, reduced, awards]);

  if (awards.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  return (
    <ol ref={ref} className={styles.grid} aria-label={copy.awards.gridLabel}>
      {awards.map((a) => {
        const open = tapped[a.id] ?? (reduced || auto.has(a.id));
        return (
          <Envelope
            key={a.id}
            award={a}
            people={people}
            nicknames={nicknames}
            open={open}
            onToggle={() => setTapped((prev) => ({ ...prev, [a.id]: !open }))}
          />
        );
      })}
    </ol>
  );
}
