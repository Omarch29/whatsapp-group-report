"use client";

import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { personAwards } from "@/lib/awards";
import { fmt } from "@/lib/format";
import type { AwardsData } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import chat from "../language/chat.module.css";
import styles from "./PersonAwards.module.css";

type Props = {
  awards: AwardsData;
  /** The profiled person. */
  slug: string;
};

const p = copy.profile;
const unitLabel = (unit: string) => copy.awards.units[unit] ?? unit;

/**
 * A person's shelf of awards: one gold card per award won (title, value and unit, the phrase
 * for the muletilla), rising in one after another on first view; then a line per finalist spot.
 */
export function PersonAwards({ awards, slug }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.2);
  const { won, finalist } = personAwards(awards, slug);

  if (won.length === 0 && finalist.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  return (
    <div ref={ref} className={styles.root} data-seen={seen}>
      {won.length > 0 && (
        <ol className={styles.won} aria-label={p.awardsWon}>
          {won.map((a, i) => (
            <li key={a.id} className={styles.card} data-award={a.id} style={{ "--i": i } as CSSProperties}>
              <span className={styles.title}>{a.title}</span>
              <span className={styles.value}>
                <span className="num" data-testid="person-award-value">
                  {fmt(a.winner!.value)}
                </span>
                <span className={styles.unit}>{unitLabel(a.winner!.unit)}</span>
              </span>
              {a.winner!.text && <span className={`${chat.bubble} ${chat.tail} ${styles.phrase}`}>{copy.quote(a.winner!.text)}</span>}
            </li>
          ))}
        </ol>
      )}
      {finalist.length > 0 && (
        <ol className={styles.finalist} aria-label={p.awardsFinalist}>
          {finalist.map((a, i) => {
            const r = a.runnersUp.find((x) => x.slug === slug)!;
            const unit = a.winner ? unitLabel(a.winner.unit) : "";
            return (
              <li
                key={a.id}
                className={styles.spot}
                data-award={a.id}
                style={{ "--i": won.length + i } as CSSProperties}
              >
                <span>{p.finalistIn(a.title)}</span>
                <span className={`num ${styles.spotValue}`}>{`${fmt(r.value)} ${unit}`.trim()}</span>
                {r.text && <span className={styles.spotText}>{copy.quote(r.text)}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
