"use client";

import { useRef } from "react";
import { fmt, fmtDate } from "@/lib/format";
import type { Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./RecordPair.module.css";
import { Ticker } from "./Ticker";

type Props = {
  /** Small kicker above the numbers. */
  label: string;
  /** The group's usual figure, shown small and dim. */
  average?: { value: number; unit: string };
  /**
   * `whenLabel` replaces the formatted `when` (e.g. "en 2024" for a whole-year record).
   * Without `who` (a record of the whole group) the caption starts at the date.
   */
  record: { value: number; who?: string; when: string; unit?: string; whenLabel?: string };
  /** Follows "{Name}, {date}". */
  caption?: string;
  /** To resolve `record.who` to a display name. */
  people: Person[];
  /** Renders the label as an h3, for a record that is a block of its own (the long page); a paragraph by default. */
  labelAsHeading?: boolean;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The average, small and dim, against the record, big and gold. The record counts up on view. */
export function RecordPair({ label, average, record, caption, people, labelAsHeading }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.3);
  const name = record.who && (people.find((p) => p.slug === record.who)?.name ?? capitalize(record.who));
  const when = record.whenLabel ?? fmtDate(record.when);

  return (
    <div ref={ref} className={styles.pair}>
      {labelAsHeading ? <h3 className={styles.label}>{label}</h3> : <p className={styles.label}>{label}</p>}
      {average && <p className={styles.average}>{`${fmt(average.value)} ${average.unit}`}</p>}
      <p className={styles.record}>
        <span className={`num ${styles.value}`}>
          {seen ? (
            <Ticker value={record.value} duration={2.2} testId="record-value" />
          ) : (
            <span aria-hidden="true">0</span>
          )}
        </span>
        {record.unit && <span className={styles.unit}>{record.unit}</span>}
      </p>
      <p className={styles.caption}>
        <span>{name ? `${name}, ${when}` : when}</span>
        {caption && <span>{` · ${caption}`}</span>}
      </p>
    </div>
  );
}
