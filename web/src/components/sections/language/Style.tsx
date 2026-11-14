"use client";

import { motion } from "motion/react";
import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { fmt, fmtShare } from "@/lib/format";
import { clip, personName } from "@/lib/language";
import { useReducedMotion } from "@/lib/motion";
import type { LanguageData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import chat from "./chat.module.css";
import styles from "./Style.module.css";

type Row = LanguageData["style"][number];
type Metric = Exclude<keyof Row, "slug">;

type Props = { data: LanguageData["style"]; people: Person[] };

const METRICS = [
  "avgChars",
  "upperShare",
  "exclPerMil",
  "questPerMil",
  "editedPerMil",
  "deletedPerMil",
] as const satisfies readonly Metric[];

const show = (m: Metric, v: number) => (m === "avgChars" ? fmt(v) : m === "upperShare" ? fmtShare(v) : `${fmt(v)} ‰`);

/** "Cartas de personaje": one card per person, six mini bars scaled to the group max; cards rise in on first view. */
export function Style({ data, people }: Props) {
  const ref = useRef<HTMLUListElement>(null);
  // A small ratio: the deck is ~1400 px tall on a phone, so a bigger one leaves the top cards blank
  // while you scroll in (or forever, when a jump lands on its bottom).
  const seen = useOnce(ref, 0.05);
  const reduced = useReducedMotion();

  if (data.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  const max = Object.fromEntries(METRICS.map((m) => [m, Math.max(0, ...data.map((r) => r[m]))])) as Record<
    Metric,
    number
  >;
  const isTop = (r: Row, m: Metric) => max[m] > 0 && r[m] === max[m];

  return (
    <ul ref={ref} className={styles.cards} aria-label={copy.language.styleLabel}>
      {data.map((r, i) => {
        const trait = METRICS.find((m) => isTop(r, m));
        return (
          <motion.li
            key={r.slug}
            className={styles.card}
            data-seen={seen}
            style={{ "--c": colorForSlug(r.slug, people), "--i": i } as CSSProperties}
            initial={reduced ? false : { opacity: 0, y: 28, rotateX: -18 }}
            animate={seen ? { opacity: 1, y: 0, rotateX: 0 } : undefined}
            transition={
              reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26, delay: Math.min(i, 10) * 0.06 }
            }
          >
            <h4 className={styles.name} style={{ color: personTextColor(r.slug, people) }}>
              {personName(r.slug, people)}
            </h4>
            {trait && <p className={styles.trait}>{copy.language.styleTraits[trait]}</p>}
            <dl className={styles.metrics}>
              {METRICS.map((m) => {
                const top = isTop(r, m);
                return (
                  <div key={m} className={styles.metric} data-testid="metric" data-metric={m} data-top={top}>
                    <dt className={styles.label}>{copy.language.styleMetrics[m]}</dt>
                    <dd className={`num ${styles.value}`}>
                      {show(m, r[m])}
                      {top && <span className={styles.sr}>{`, ${copy.language.styleTop}`}</span>}
                    </dd>
                    <span className={styles.track} aria-hidden="true">
                      <span
                        className={styles.bar}
                        data-testid="mini-bar"
                        style={{ width: `${max[m] > 0 ? (r[m] / max[m]) * 100 : 0}%` }}
                      />
                    </span>
                  </div>
                );
              })}
            </dl>
          </motion.li>
        );
      })}
    </ul>
  );
}

/** The text shown in the record bubble; the full message stays in the Records chapter. */
const RECORD_TEXT_CHARS = 300;

type StyleRecordProps = {
  record: { who: string; when: string; text: string };
  /** The counted length (the text is cleaned, so mentions can make it shorter than the count). */
  value: number;
  people: Person[];
};

/** The longest message ever written: its length, who and when, and the start of the text in a bubble. */
export function StyleRecord({ record, value, people }: StyleRecordProps) {
  return (
    <div className={styles.record}>
      <RecordPair
        label={copy.language.styleRecord.label}
        record={{ value, unit: copy.language.styleRecord.unit(value), who: record.who, when: record.when }}
        people={people}
      />
      <blockquote className={`${chat.bubble} ${chat.tail} ${styles.quote}`}>
        {clip(record.text, RECORD_TEXT_CHARS)}
      </blockquote>
    </div>
  );
}
