"use client";

import { gsap } from "gsap";
import { useEffect, useRef, type CSSProperties } from "react";
import { fmt } from "@/lib/format";
import { PALETTE } from "@/lib/colors";
import { useReducedMotion } from "@/lib/motion";
import type { RecordsData } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./PollBars.module.css";

type Props = {
  poll: NonNullable<RecordsData["poll"]>;
};

const STAGGER = 0.12;

/** The question in bold and one bar per option, most voted first; the winner is gold. */
export function PollBars({ poll }: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.3);

  useEffect(() => {
    if (!seen || reduced) return;
    const ctx = gsap.context(() => {
      gsap.to("[data-fill]", { scaleX: 1, duration: 0.9, ease: "power3.out", stagger: STAGGER });
    }, ref);
    return () => ctx.revert();
  }, [seen, reduced]);

  const options = [...poll.options].sort((a, b) => b.votes - a.votes);
  const max = Math.max(1, ...options.map((o) => o.votes));

  return (
    <div ref={ref} className={styles.poll} data-static={reduced || undefined}>
      <p className={styles.question}>
        <b>{poll.question}</b>
      </p>
      <ul className={styles.rows}>
        {options.map((o, i) => {
          const winner = i === 0;
          return (
            <li
              key={o.label}
              className={styles.row}
              data-testid={winner ? "poll-winner" : undefined}
              data-winner={winner || undefined}
            >
              <span className={styles.label}>{o.label}</span>
              <span className={styles.track}>
                <i
                  className={styles.fill}
                  style={
                    {
                      width: `${(o.votes / max) * 100}%`,
                      "--fill": winner ? "var(--gold)" : PALETTE[3],
                    } as CSSProperties
                  }
                  data-fill
                  data-testid="poll-bar"
                />
              </span>
              <span className={`num ${styles.votes}`}>{fmt(o.votes)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
