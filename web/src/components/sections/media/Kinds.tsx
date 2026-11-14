"use client";

import { motion } from "motion/react";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { ModeToggle, type Mode } from "@/components/ModeToggle";
import { personTextColor } from "@/lib/colors";
import { fmt } from "@/lib/format";
import { personName } from "@/lib/language";
import { KIND_COLORS, OTHER_KIND, kindGroups, kindValues } from "@/lib/media";
import { useReducedMotion } from "@/lib/motion";
import type { MediaData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./Kinds.module.css";

type Props = {
  data: MediaData["kinds"];
  people: Person[];
  /** Profile mode: only this person's row. */
  person?: string;
};

const m = copy.media;
const label = (kind: string) => m.kindLabels[kind] ?? kind;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * What each person sends: one stacked bar per person (text left out, rare kinds folded into
 * «otros»), total / per mil toggle. Bars grow on first view and re-sort on toggle.
 */
export function Kinds({ data, people, person }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useOnce(ref, 0.1);
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>("total");
  const groups = useMemo(() => kindGroups(data.kinds), [data.kinds]);

  const source = person === undefined ? data.byPerson : data.byPerson.filter((p) => p.slug === person);
  const rows = source
    .map((p) => {
      const segs = kindValues(mode === "total" ? p.counts : p.perMil, groups);
      return { slug: p.slug, segs, sum: segs.reduce((acc, s) => acc + s.value, 0) };
    })
    .filter((r) => r.sum > 0)
    .sort((a, b) => b.sum - a.sum);

  if (rows.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  const max = Math.max(...rows.map((r) => r.sum));
  const show = (v: number) => (mode === "total" ? fmt(v) : `${fmt(round1(v))} ‰`);
  const legend = [...groups.main, ...(groups.other.length > 0 ? [OTHER_KIND] : [])];
  // Profile mode: the single row's values go in the legend too.
  const single = person !== undefined ? rows[0] : undefined;

  return (
    <div className={styles.root}>
      <ModeToggle value={mode} onChange={setMode} />
      <ol ref={ref} className={styles.bars} aria-label={m.kindsLabel} data-seen={seen}>
        {rows.map((r, i) => (
          <motion.li
            key={r.slug}
            layout={reduced ? false : "position"}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className={styles.row}
            data-slug={r.slug}
            style={{ "--i": i } as CSSProperties}
          >
            <span className={styles.name} style={{ color: personTextColor(r.slug, people) }}>
              {personName(r.slug, people)}
            </span>
            <span className={styles.track}>
              <span className={styles.stack} style={{ width: `${(r.sum / max) * 100}%` }}>
                {r.segs.map((s) =>
                  s.value > 0 ? (
                    <span
                      key={s.kind}
                      className={styles.seg}
                      data-testid="kind-seg"
                      data-kind={s.kind}
                      title={m.kindSeg(label(s.kind), show(s.value))}
                      style={{ width: `${(s.value / r.sum) * 100}%`, backgroundColor: KIND_COLORS[s.kind] }}
                    />
                  ) : null,
                )}
              </span>
            </span>
            <span className={`num ${styles.value}`}>{show(r.sum)}</span>
          </motion.li>
        ))}
      </ol>
      <ul className={styles.legend} aria-label={m.kindsLegend}>
        {legend.map((k) => {
          const v = single?.segs.find((s) => s.kind === k)?.value;
          return (
            <li key={k} className={styles.legendItem}>
              <span className={styles.dot} style={{ backgroundColor: KIND_COLORS[k] }} aria-hidden="true" />
              {v === undefined ? label(k) : m.kindSeg(label(k), show(v))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
