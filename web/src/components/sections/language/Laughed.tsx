"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { copy } from "../../../../content/copy";
import { PersonChips } from "@/components/PersonChips";
import { personTextColor } from "@/lib/colors";
import { fmtDate } from "@/lib/format";
import { defaultPerson, personName } from "@/lib/language";
import { useReducedMotion } from "@/lib/motion";
import type { LanguageData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import chat from "./chat.module.css";
import styles from "./Laughed.module.css";

type Props = {
  data: LanguageData["laughed"];
  people: Person[];
  /** Fixes the person (profiles): no chips. */
  person?: string;
};

/** Laugh bubbles drawn around the message; the label keeps the real count. */
export const MAX_LAUGH_BUBBLES = 12;
const LAUGHS = ["jajaja", "JAJAJA", "jaja", "😂", "jsjs", "jajajaja", "🤣", "JAJAJ", "jaja", "😂", "ajaja", "JAJAJA"];
const POP = { type: "spring", stiffness: 520, damping: 18 } as const;

/** Spots around the bubble: alternating above and below, spread across, two rows each, tilted. */
function spots(n: number) {
  const above = Math.ceil(n / 2);
  return Array.from({ length: n }, (_, i) => {
    const up = i % 2 === 0;
    const k = Math.floor(i / 2);
    const count = up ? above : n - above;
    return { up, x: 7 + ((k + 0.5) / count) * 86, outer: k % 2 === 1, rotate: ((i * 37) % 19) - 9 };
  });
}

/** Each person's message that got the most laughs: the bubble lands, the laughs pop around it. */
export function Laughed({ data, people, person }: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.3);
  const order = people.filter((p) => data[p.slug] !== undefined);
  const [picked, setPicked] = useState(() => defaultPerson(data, people, (l) => l !== null));
  const sel = person ?? picked;
  const msg = data[sel] ?? null;
  const name = personName(sel, people);
  const state = seen ? "in" : "out";
  const n = msg ? Math.min(msg.laughs, MAX_LAUGH_BUBBLES) : 0;

  return (
    <div className={styles.root}>
      {!person && <PersonChips people={order} value={sel} onChange={setPicked} label={copy.language.chips} />}
      <div ref={ref} className={`${chat.screen} ${styles.screen}`}>
        <AnimatePresence mode="wait" initial={false}>
          {msg ? (
            <motion.figure
              key={sel}
              className={styles.figure}
              exit={reduced ? undefined : { opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
            >
              <div className={styles.stage}>
                <motion.div
                  className={`${chat.bubble} ${chat.tail} ${styles.bubble}`}
                  initial={reduced ? false : "out"}
                  animate={state}
                  variants={{ out: { opacity: 0, y: 14, scale: 0.88 }, in: { opacity: 1, y: 0, scale: 1 } }}
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 28 }}
                >
                  <span className={chat.name} style={{ color: personTextColor(sel, people) }}>
                    {name}
                  </span>
                  <blockquote className={styles.text}>{msg.text}</blockquote>
                  <span className={chat.meta}>
                    <span />
                    <span>{fmtDate(msg.when)}</span>
                  </span>
                </motion.div>
                {spots(n).map((s, i) => (
                  <motion.span
                    key={i}
                    className={styles.laugh}
                    data-testid="laugh"
                    data-up={s.up}
                    data-outer={s.outer}
                    aria-hidden="true"
                    style={{ left: `${s.x}%`, x: "-50%" }}
                    initial={reduced ? false : "out"}
                    animate={state}
                    variants={{
                      out: { opacity: 0, scale: 0, rotate: 0, y: s.up ? 18 : -18 },
                      in: { opacity: 1, scale: 1, rotate: s.rotate, y: 0 },
                    }}
                    transition={reduced ? { duration: 0 } : { ...POP, delay: 0.35 + i * 0.07 }}
                  >
                    {LAUGHS[i % LAUGHS.length]}
                  </motion.span>
                ))}
              </div>
              <figcaption className={styles.count}>{copy.language.laughsLabel(msg.laughs, msg.people)}</figcaption>
            </motion.figure>
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
