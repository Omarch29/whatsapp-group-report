"use client";

import { gsap } from "gsap";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { copy } from "../../../content/copy";
import { blockAnchor } from "@/lib/blockAnchor";
import { useReducedMotion } from "@/lib/motion";
import { BubbleRain } from "../BubbleRain";
import { Ticker } from "../Ticker";
import styles from "./Hero.module.css";

type Props = {
  total: number;
  daysActive: number;
  bubbles: string[];
  person?: { name: string; nick?: string };
  /** Chapter block id for this section (anchor + sidebar spy); none on profiles. */
  blockId?: string;
  /** Shown under the lede (the Introducción's "Empezar"). */
  children?: ReactNode;
};

const STAGGER = 0.55;
const TYPING = 1.1;

/** Chat bubbles arrive one by one, the third after a typing indicator; then the total counts up. */
export function Hero({ total, daysActive, bubbles, person, blockId, children }: Props) {
  const reduced = useReducedMotion();
  const chatRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const done = reduced || revealed;

  useEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.to("[data-bubble]", {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.45,
        ease: "back.out(1.6)",
        stagger: STAGGER,
      });
      // The third bubble starts typing at 2 * STAGGER; its text lands TYPING seconds later,
      // and the total starts counting right then.
      tl.call(() => setRevealed(true), [], 2 * STAGGER + TYPING);
    }, chatRef);
    return () => ctx.revert();
  }, [reduced]);

  const [first = "", second = "", third = ""] = bubbles;

  return (
    <section {...blockAnchor(blockId)} className={styles.hero}>
      <div className={styles.glow} aria-hidden="true" />
      <BubbleRain />
      <div className={styles.content}>
        <div ref={chatRef} className={styles.chat} data-static={reduced || undefined}>
          <p className={styles.bubble} data-bubble>
            {first}
          </p>
          <p className={`${styles.bubble} ${styles.mine}`} data-bubble>
            {second}
          </p>
          <div className={styles.bubble} data-bubble>
            {done ? (
              person ? (
                <>
                  <span>{person.name}</span>
                  {person.nick ? <small className={styles.nick}>{person.nick}</small> : null}
                </>
              ) : (
                <span>{third}</span>
              )
            ) : (
              <span className={styles.typing} data-testid="typing" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            )}
          </div>
        </div>

        <div className={styles.bottom}>
          <h1 className={`num ${styles.total}`} data-testid="total">
            {done ? <Ticker value={total} /> : <span aria-hidden="true">0</span>}
          </h1>
          <p className={styles.lede}>{copy.hero.lede(total, daysActive)}</p>
          {children}
        </div>
      </div>
    </section>
  );
}
