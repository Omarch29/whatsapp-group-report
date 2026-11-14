"use client";

import { useRef, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { PersonBars } from "@/components/PersonBars";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { fmt } from "@/lib/format";
import { personName } from "@/lib/language";
import type { MediaData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./Links.module.css";

export const DOMAINS_SHOWN = 10;

type Props = { data: MediaData["links"]; people: Person[] };

const m = copy.media;

/** Most shared domains (an initial-letter circle instead of a favicon: no external requests), sharers and each one's favourite. */
export function Links({ data, people }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useOnce(ref, 0.15);

  if (data.domains.length === 0 && data.byPerson.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  const domains = [...data.domains].sort((a, b) => b.n - a.n).slice(0, DOMAINS_SHOWN);
  const max = Math.max(1, ...domains.map((d) => d.n));

  return (
    <div className={styles.root}>
      {domains.length > 0 && (
        <ol ref={ref} className={styles.domains} aria-label={m.domainsLabel} data-seen={seen}>
          {domains.map((d, i) => (
            <li
              key={d.domain}
              className={styles.domain}
              data-domain={d.domain}
              data-top={i === 0 || undefined}
              style={{ "--i": i } as CSSProperties}
            >
              <span className={styles.initial} data-testid="initial" aria-hidden="true">
                {d.domain.charAt(0).toUpperCase()}
              </span>
              <span className={styles.label}>{d.domain}</span>
              <span className={styles.track}>
                <span className={styles.bar} data-testid="domain-bar" style={{ width: `${(d.n / max) * 100}%` }} />
              </span>
              <span className={`num ${styles.value}`}>{fmt(d.n)}</span>
            </li>
          ))}
        </ol>
      )}

      <PersonBars
        label={m.linksByPerson}
        people={people}
        threshold={0.1}
        rows={data.byPerson.map((p) => ({ slug: p.slug, value: p.n, display: fmt(p.n) }))}
      />

      {data.favorite.length > 0 && (
        <div className={styles.favorites}>
          <p className={styles.favoritesTitle}>{m.favoriteLabel}</p>
          <ul className={styles.chips} aria-label={m.favoriteLabel}>
            {data.favorite.map((f) => (
              <li key={f.slug} className={styles.chip}>
                <span
                  className={styles.dot}
                  style={{ backgroundColor: colorForSlug(f.slug, people) }}
                  aria-hidden="true"
                />
                <b style={{ color: personTextColor(f.slug, people) }}>{personName(f.slug, people)}</b>
                <span>{f.domain}</span>
                <span className={`num ${styles.chipN}`}>{fmt(f.n)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
