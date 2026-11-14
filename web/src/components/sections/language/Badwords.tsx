"use client";

import { motion } from "motion/react";
import { useRef, useState, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { fmt } from "@/lib/format";
import { clipRecord, personName } from "@/lib/language";
import { useReducedMotion } from "@/lib/motion";
import type { LanguageData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import chat from "./chat.module.css";
import styles from "./Badwords.module.css";

type Mode = "total" | "perMil";

type Props = { data: LanguageData["badwords"]; people: Person[] };

const value = (b: LanguageData["badwords"]["byPerson"][number], mode: Mode) => (mode === "total" ? b.n : b.perMil);

/** Horizontal bars by person, longest first, per mil by default (the lede's measure) with a total toggle. Bars grow on first view and re-sort on toggle. */
export function Badwords({ data, people }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useOnce(ref, 0.15);
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>("perMil");

  if (data.byPerson.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  const rows = [...data.byPerson].sort((a, b) => value(b, mode) - value(a, mode));
  const max = Math.max(1e-9, ...rows.map((r) => value(r, mode)));
  const show = (v: number) => (mode === "total" ? fmt(v) : `${fmt(v)} ‰`);

  return (
    <div className={styles.root}>
      <div className={styles.toggle} role="group" aria-label={copy.census.modeLabel}>
        {(["total", "perMil"] as const).map((m) => (
          <button key={m} type="button" className={styles.chip} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === "total" ? copy.census.total : copy.census.perMil}
          </button>
        ))}
      </div>
      <ol ref={ref} className={styles.bars} aria-label={copy.language.badwordsLabel} data-seen={seen}>
        {rows.map((r, i) => (
          <motion.li
            key={r.slug}
            layout={reduced ? false : "position"}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className={styles.row}
            data-slug={r.slug}
            style={{ "--c": colorForSlug(r.slug, people), "--i": i } as CSSProperties}
          >
            <span className={styles.name} style={{ color: personTextColor(r.slug, people) }}>
              {personName(r.slug, people)}
            </span>
            <span className={styles.track}>
              <span className={styles.bar} data-testid="bar" style={{ width: `${(value(r, mode) / max) * 100}%` }} />
            </span>
            <span className={`num ${styles.value}`}>{show(value(r, mode))}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/** The message with the most distinct swearwords, as a record with the text in a bubble. */
export function BadwordsRecord({ record, people }: { record: LanguageData["badwords"]["record"]; people: Person[] }) {
  if (!record) return null;
  return (
    <div className={styles.record}>
      <RecordPair
        label={copy.language.badwordsRecord.label}
        record={{ value: record.distinct, unit: copy.language.badwordsRecord.unit(record.distinct), who: record.who, when: record.when }}
        people={people}
      />
      <blockquote className={`${chat.bubble} ${chat.tail} ${styles.quote}`}>{clipRecord(record.text)}</blockquote>
    </div>
  );
}
