"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { PersonChips } from "@/components/PersonChips";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { fmtDate } from "@/lib/format";
import { defaultPerson, personName } from "@/lib/language";
import { useReducedMotion } from "@/lib/motion";
import type { LanguageData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import chat from "./chat.module.css";
import styles from "./Repeated.module.css";

type Props = {
  data: LanguageData["repeated"];
  people: Person[];
  /** Fixes the person (profiles): no chips. */
  person?: string;
};

const POP = { type: "spring", stiffness: 480, damping: 30 } as const;
/** Seconds between phrases, and between the echoes of one phrase. */
const ITEM_GAP = 0.16;
const ECHO_GAP = 0.06;

/**
 * Phrases of one person that others wrote later, word for word: the original bubble in
 * the person's color, the repliers stacking in under it, one small bubble each.
 */
export function Repeated({ data, people, person }: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.05);
  const order = people.filter((p) => data[p.slug] !== undefined);
  const [picked, setPicked] = useState(() => defaultPerson(data, people, (l) => l.length > 0));
  const sel = person ?? picked;
  const list = data[sel] ?? [];
  const name = personName(sel, people);
  const state = seen ? "in" : "out";

  return (
    <div className={styles.root}>
      {!person && <PersonChips people={order} value={sel} onChange={setPicked} label={copy.language.chips} />}
      <div ref={ref} className={chat.screen}>
        <AnimatePresence mode="wait" initial={false}>
          {list.length > 0 ? (
            <motion.ol
              key={sel}
              className={styles.list}
              aria-label={copy.language.repeatedLabel(name)}
              exit={reduced ? undefined : { opacity: 0, y: -10, transition: { duration: 0.18 } }}
            >
              {list.map((r, i) => {
                const base = i * ITEM_GAP;
                return (
                  <li key={`${r.when}:${r.text}`} className={styles.item} data-testid="repeated" data-seen={seen}>
                    <motion.figure
                      className={`${chat.bubble} ${chat.tail} ${styles.original}`}
                      initial={reduced ? false : "out"}
                      animate={state}
                      variants={{ out: { opacity: 0, y: 16, scale: 0.96 }, in: { opacity: 1, y: 0, scale: 1 } }}
                      transition={reduced ? { duration: 0 } : { ...POP, delay: base }}
                    >
                      <span className={chat.name} style={{ color: personTextColor(sel, people) }} aria-hidden="true">
                        {name}
                      </span>
                      <blockquote className={styles.text}>{r.text}</blockquote>
                      <figcaption className={chat.meta}>
                        <span className={styles.count}>{copy.language.repeatedMeta(r.times, r.people)}</span>
                        <span>{fmtDate(r.when)}</span>
                      </figcaption>
                    </motion.figure>
                    <ul className={styles.echoes} aria-label={copy.language.repeatedBy}>
                      {r.by.map((slug, j) => (
                        <motion.li
                          key={slug}
                          className={styles.echo}
                          style={
                            {
                              "--c": colorForSlug(slug, people),
                              "--ct": personTextColor(slug, people),
                            } as CSSProperties
                          }
                          initial={reduced ? false : "out"}
                          animate={state}
                          variants={{ out: { opacity: 0, y: -10, scale: 0.7 }, in: { opacity: 1, y: 0, scale: 1 } }}
                          transition={reduced ? { duration: 0 } : { ...POP, delay: base + 0.22 + j * ECHO_GAP }}
                        >
                          {personName(slug, people)}
                        </motion.li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </motion.ol>
          ) : (
            <motion.p
              key={`empty:${sel}`}
              className={chat.system}
              exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
            >
              {copy.empty}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
