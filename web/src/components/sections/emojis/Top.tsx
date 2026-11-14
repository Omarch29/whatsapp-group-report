"use client";

import { gsap } from "gsap";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { copy } from "../../../../content/copy";
import { personName } from "@/lib/language";
import { useReducedMotion } from "@/lib/motion";
import type { EmojisData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./Top.module.css";

type Props = { data: EmojisData["top"]; people: Person[] };

const MIN_SIZE = 22;
const SIZE_RANGE = 58;

/** The group's top emojis as a cloud sized by use (entering in random order, like the Diccionario); tap one for who uses it most. */
export function Top({ data, people }: Props) {
  const reduced = useReducedMotion();
  const cloudRef = useRef<HTMLUListElement>(null);
  const seen = useOnce(cloudRef, 0.2);
  const baseId = useId();
  const [open, setOpen] = useState<string | null>(null);
  const max = useMemo(() => Math.max(1, ...data.map((t) => t.n)), [data]);

  useLayoutEffect(() => {
    if (!seen || reduced) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-emoji]",
        { opacity: 0, scale: 0.4, y: 10 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.55,
          ease: "back.out(2)",
          stagger: { each: 0.035, from: "random" },
          clearProps: "all",
        },
      );
    }, cloudRef);
    return () => ctx.revert();
  }, [seen, reduced]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !cloudRef.current?.contains(e.target)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  if (data.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  return (
    <ul ref={cloudRef} className={styles.cloud} aria-label={copy.emojis.cloudLabel}>
      {data.map((t, i) => {
        const detailId = `${baseId}-detail-${i}`;
        const isOpen = open === t.e;
        const size = MIN_SIZE + Math.sqrt(t.n / max) * SIZE_RANGE;
        return (
          <li
            key={t.e}
            className={styles.item}
            data-emoji
            data-hidden={!seen || undefined}
            data-open={isOpen || undefined}
          >
            <button
              type="button"
              className={styles.emoji}
              data-testid="emoji"
              aria-expanded={isOpen}
              aria-describedby={detailId}
              style={{ fontSize: `${size.toFixed(1)}px` }}
              onClick={() => setOpen(isOpen ? null : t.e)}
            >
              {t.e}
            </button>
            <span id={detailId} role="note" className={styles.detail}>
              {copy.emojis.detail(t.n, t.topUser ? personName(t.topUser, people) : null)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
