"use client";

import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { FALLBACK_COLOR, personTextColor } from "@/lib/colors";
import { fmt, fmtShare } from "@/lib/format";
import { clipRecord, laughTotal, personName } from "@/lib/language";
import type { LanguageData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import chat from "./chat.module.css";
import styles from "./Laughs.module.css";

type Props = { data: LanguageData["laughs"]; people: Person[] };

/** One fixed color per laugh class, by its position in the language's list (the same in every row, so rows compare). */
export const LAUGH_COLORS = ["#25d366", "#ff5ca8", "#f2c94c", "#53bdeb", "#b388ff", "#ff7a59"] as const;
/** Classes beyond the list are grey rather than repeating a colour, which would make two classes look alike. */
const colorOf = (i: number) => LAUGH_COLORS[i] ?? FALLBACK_COLOR;

/** How each person writes their laugh: one proportional stacked row each; the bars grow on first view. */
export function Laughs({ data, people }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useOnce(ref, 0.1);

  if (data.byPerson.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  // Every row lists the same classes in the same order: the first one names the legend.
  const classes = data.byPerson[0]!.mix;

  return (
    <div className={styles.root}>
      <ul className={styles.legend} aria-label={copy.language.laughsLegend}>
        {classes.map((c, i) => (
          <li key={c.key} className={styles.legendItem}>
            <span className={styles.swatch} style={{ backgroundColor: colorOf(i) }} aria-hidden="true" />
            {c.label}
          </li>
        ))}
      </ul>
      <ol ref={ref} className={styles.rows} aria-label={copy.language.laughsRowsLabel}>
        {data.byPerson.map((r, i) => {
          const total = laughTotal(r.mix);
          const name = personName(r.slug, people);
          return (
            <li key={r.slug} className={styles.row} data-seen={seen} style={{ "--i": i } as CSSProperties}>
              <span className={styles.name} style={{ color: personTextColor(r.slug, people) }}>
                {name}
              </span>
              <span className={`num ${styles.avg}`}>{copy.language.avgJa(r.avgJa)}</span>
              <span className={styles.bar} aria-hidden="true">
                {r.mix.map((c, k) =>
                  c.n > 0 ? (
                    <span
                      key={c.key}
                      className={styles.seg}
                      data-testid="laugh-seg"
                      data-kind={c.key}
                      title={copy.language.laughSeg(c.label, c.n, fmtShare(c.n / total))}
                      style={{ width: `${(c.n / total) * 100}%`, backgroundColor: colorOf(k) }}
                    />
                  ) : null,
                )}
              </span>
              <span className={styles.sr}>{r.mix.map((c) => `${c.label} ${fmt(c.n)}`).join(", ")}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The longest jaja ever written, as a record with the laugh in a bubble. */
export function LaughsRecord({ record, people }: { record: LanguageData["laughs"]["record"]; people: Person[] }) {
  if (!record) return null;
  return (
    <div className={styles.record}>
      <RecordPair
        label={copy.language.laughsRecord.label}
        record={{ value: record.length, unit: copy.language.laughsRecord.unit(record.length), who: record.who, when: record.when }}
        people={people}
      />
      <blockquote className={`${chat.bubble} ${chat.tail} ${styles.quote}`}>{clipRecord(record.text)}</blockquote>
    </div>
  );
}
