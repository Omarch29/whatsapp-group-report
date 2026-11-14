"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";
import { useOnce } from "@/lib/useOnce";
import styles from "./Typewriter.module.css";

type Props = {
  text: string;
  /** Milliseconds between chunks. */
  speed?: number;
};

/** Total typing time is ~4 s whatever the length: 220 chunks of ceil(len / 220) characters. */
const CHUNKS = 220;

/**
 * Types `text` once it scrolls into view; under reduced motion shows it all at once.
 * The container carries the full text as its label so assistive tech reads it once.
 */
export function Typewriter({ text, speed = 18 }: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.3);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!seen || reduced) return;
    const chunk = Math.ceil(text.length / CHUNKS);
    let n = 0;
    let id: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      n = Math.min(text.length, n + chunk);
      setCount(n);
      if (n < text.length) id = setTimeout(tick, speed);
    };
    id = setTimeout(tick, speed);
    return () => clearTimeout(id);
  }, [seen, reduced, text, speed]);

  const shown = reduced ? text : text.slice(0, count);
  return (
    <div ref={ref} className={styles.box} role="img" aria-label={text} data-testid="typewriter">
      <p className={styles.text} aria-hidden="true">
        <span>{shown}</span>
        <span className={styles.cursor} aria-hidden="true" />
      </p>
    </div>
  );
}
