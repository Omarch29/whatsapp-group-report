"use client";

import { motion } from "motion/react";
import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { personName } from "@/lib/language";
import { useReducedMotion } from "@/lib/motion";
import type { EmojisData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./Signature.module.css";

type Props = {
  data: EmojisData["signature"];
  people: Person[];
  /** Profile mode: only this person's card. */
  person?: string;
};

const e = copy.emojis;
const DROP = { type: "spring", stiffness: 520, damping: 15, mass: 0.9 } as const;

/** One card per person with their signature emoji, which drops into the card with a spring on first view (staggered). */
export function Signature({ data, people, person }: Props) {
  const ref = useRef<HTMLUListElement>(null);
  const seen = useOnce(ref, 0.1);
  const reduced = useReducedMotion();
  const cards = person === undefined ? data : data.filter((s) => s.slug === person);

  // Profile mode: the page's lede already says the person has no signature; no second empty line.
  if (cards.length === 0) return person === undefined ? <p className={styles.empty}>{copy.empty}</p> : null;

  return (
    <ul
      ref={ref}
      className={styles.cards}
      aria-label={e.signatureLabel}
      data-single={person !== undefined || undefined}
    >
      {cards.map((s, i) => {
        const name = personName(s.slug, people);
        return (
          <li
            key={s.slug}
            className={styles.card}
            data-slug={s.slug}
            style={{ "--c": colorForSlug(s.slug, people) } as CSSProperties}
          >
            <span className={styles.srOnly}>{e.signatureSpoken(name, s.e, s.own, s.ratio)}</span>
            <span className={styles.well} aria-hidden="true">
              <motion.span
                className={styles.emoji}
                data-testid="signature-emoji"
                initial={reduced ? false : { y: -56, opacity: 0, rotate: -12 }}
                animate={seen ? { y: 0, opacity: 1, rotate: 0 } : undefined}
                transition={reduced ? { duration: 0 } : { ...DROP, delay: i * 0.08 }}
              >
                {s.e}
              </motion.span>
            </span>
            <span className={styles.name} style={{ color: personTextColor(s.slug, people) }} aria-hidden="true">
              {name}
            </span>
            <span className={`num ${styles.own}`} aria-hidden="true">
              {e.signatureOwn(s.own)}
            </span>
            <span className={styles.ratio} aria-hidden="true">
              {e.signatureRatio(s.ratio)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
