"use client";

import { gsap } from "gsap";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { copy } from "../../../content/copy";
import { CopyLink, Criterion } from "@/components/report/Block";
import { blockAnchor } from "@/lib/blockAnchor";
import { colorForSlug } from "@/lib/colors";
import { fmtDate } from "@/lib/format";
import { useReducedMotion } from "@/lib/motion";
import type { LoreTerm, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import styles from "./Dictionary.module.css";

type Props = {
  terms: LoreTerm[];
  people: Person[];
  /** Slug of a person: words coined by anyone else dim. */
  highlight?: string;
  /** Replaces the group lede (profiles). */
  lede?: string;
  /** Chapter block id for this section (anchor + sidebar spy); none on profiles. */
  blockId?: string;
  /** Chapter anatomy (chapter pages, not profiles): how the chart counts, in one line under the lede. */
  criterion?: string;
  /** Chapter anatomy: a «Copiar link» button for `blockId` at the end of the section. */
  copyLink?: boolean;
};

const MIN_SIZE = 14;
const SIZE_RANGE = 44;

const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A word cloud of the group's own vocabulary, colored by who coined each word. */
export function Dictionary({ terms, people, highlight, lede = copy.dictionary.lede, blockId, criterion, copyLink }: Props) {
  const reduced = useReducedMotion();
  const cloudRef = useRef<HTMLUListElement>(null);
  const seen = useOnce(cloudRef, 0.2);
  const baseId = useId();
  const [openWord, setOpenWord] = useState<string | null>(null);

  const max = useMemo(() => Math.max(1, ...terms.map((t) => t.n)), [terms]);
  const nameOf = (slug: string) => people.find((p) => p.slug === slug)?.name ?? capitalize(slug);

  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of terms) counts.set(t.coinedBy, (counts.get(t.coinedBy) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [terms]);

  useLayoutEffect(() => {
    if (!seen || reduced) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-word]",
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "back.out(1.8)",
          stagger: { each: 0.03, from: "random" },
          clearProps: "all",
        },
      );
    }, cloudRef);
    return () => ctx.revert();
  }, [seen, reduced]);

  useEffect(() => {
    if (openWord === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenWord(null);
    };
    // Tapping anywhere outside the cloud closes the open detail too.
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !cloudRef.current?.contains(e.target)) setOpenWord(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openWord]);

  return (
    <section {...blockAnchor(blockId)} className={styles.dictionary}>
      <h2>{copy.dictionary.title}</h2>
      <p className={styles.lede}>{lede}</p>
      {criterion && <Criterion>{criterion}</Criterion>}

      <ul ref={cloudRef} className={styles.cloud} aria-label={copy.dictionary.cloudLabel}>
        {terms.map((t, i) => {
          const detailId = `${baseId}-detail-${i}`;
          const open = openWord === t.w;
          const size = MIN_SIZE + Math.sqrt(t.n / max) * SIZE_RANGE;
          return (
            <li
              key={t.w}
              className={styles.item}
              data-word
              data-hidden={!seen || undefined}
              data-open={open || undefined}
            >
              <button
                type="button"
                className={styles.word}
                data-testid="term"
                data-coiner={t.coinedBy}
                data-dim={(highlight !== undefined && t.coinedBy !== highlight) || undefined}
                aria-expanded={open}
                aria-describedby={detailId}
                style={{ fontSize: `${size.toFixed(1)}px`, color: colorForSlug(t.coinedBy, people) }}
                onClick={() => setOpenWord(open ? null : t.w)}
              >
                {t.w}
              </button>
              <span id={detailId} role="note" className={styles.detail}>
                {copy.dictionary.detail(nameOf(t.coinedBy), t.n, fmtDate(t.firstUse))}
              </span>
            </li>
          );
        })}
      </ul>

      <ul className={styles.legend} aria-label={copy.dictionary.legendLabel}>
        {legend.map(([slug, count]) => (
          <li key={slug} className={styles.chip}>
            <span
              className={styles.dot}
              aria-hidden="true"
              style={{ background: colorForSlug(slug, people) }}
            />
            {copy.dictionary.coined(nameOf(slug), count)}
          </li>
        ))}
      </ul>
      {copyLink && blockId && <CopyLink id={blockId} />}
    </section>
  );
}
