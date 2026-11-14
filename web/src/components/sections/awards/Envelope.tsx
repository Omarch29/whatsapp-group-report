"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { copy } from "../../../../content/copy";
import { Ticker } from "@/components/Ticker";
import { personTextColor } from "@/lib/colors";
import { fmt } from "@/lib/format";
import { personName } from "@/lib/language";
import { useReducedMotion } from "@/lib/motion";
import { nicknameFor, type Nicknames } from "@/lib/nicknames";
import type { Award, Person } from "@/lib/schema";
import chat from "../language/chat.module.css";
import styles from "./Envelope.module.css";

type Props = { award: Award; people: Person[]; nicknames: Nicknames; open: boolean; onToggle: () => void };

const a = copy.awards;
const unitLabel = (unit: string) => a.units[unit] ?? unit;

/**
 * One award as a sealed envelope: the closed card shows the title and a big «?» on the seal.
 * Opening it swings the flap back (rotateX 0 → -180°, in 3D), drops the front away and
 * raises the letter: criterion, winner (colour and nickname), the value counting up, the
 * phrase for the muletilla, and the two finalists.
 */
export function Envelope({ award, people, nicknames, open, onToggle }: Props) {
  const reduced = useReducedMotion();
  const id = useId();
  const { winner } = award;
  const unit = winner ? unitLabel(winner.unit) : "";
  const winnerName = winner ? personName(winner.slug, people) : "";
  const nick = winner ? nicknameFor(nicknames, winnerName) : undefined;

  return (
    <li className={styles.card} data-open={open || undefined} data-award={award.id}>
      <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className={styles.title}>{award.title}</span>
        <span className={styles.seal} aria-hidden="true">
          {a.closed}
        </span>
      </button>
      <span className={styles.envelope} aria-hidden="true">
        <span className={styles.front} />
        <span className={styles.flap} />
      </span>
      <div id={id} className={styles.slot}>
        {open && (
          <motion.div
            className={styles.letter}
            initial={reduced ? false : { opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { delay: 0.3, type: "spring", stiffness: 240, damping: 26 }}
          >
            <p className={styles.criterion}>{award.criterion}</p>
            {winner ? (
              <>
                <p className={styles.winner}>
                  <b style={{ color: personTextColor(winner.slug, people) }}>{winnerName}</b>
                  {nick && <span className={styles.nick}>{a.nickname(nick)}</span>}
                </p>
                <p className={styles.value}>
                  <span className="num">
                    <Ticker value={winner.value} duration={1.6} testId="award-value" />
                  </span>
                  <span className={styles.unit}>{unit}</span>
                </p>
                {winner.text && <p className={`${chat.bubble} ${chat.tail} ${styles.phrase}`}>{copy.quote(winner.text)}</p>}
                {award.runnersUp.length > 0 && (
                  <div className={styles.runners}>
                    <p className={styles.runnersTitle}>{a.runnersUp}</p>
                    <ol className={styles.runnerList} aria-label={a.runnersUp}>
                      {award.runnersUp.map((r) => (
                        <li key={r.slug} className={styles.runner}>
                          <span className={styles.runnerName} style={{ color: personTextColor(r.slug, people) }}>
                            {personName(r.slug, people)}
                          </span>
                          <span className={`num ${styles.runnerValue}`}>{`${fmt(r.value)} ${unit}`}</span>
                          {r.text && <span className={styles.runnerText}>{copy.quote(r.text)}</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            ) : (
              <p className={styles.nobody}>{a.nobody}</p>
            )}
          </motion.div>
        )}
      </div>
    </li>
  );
}
