"use client";

import { gsap } from "gsap";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { copy } from "../../../content/copy";
import { CopyLink, Criterion } from "@/components/report/Block";
import { blockAnchor } from "@/lib/blockAnchor";
import { fmtDate } from "@/lib/format";
import { useReducedMotion } from "@/lib/motion";
import type { EventData } from "@/lib/schema";
import { usePin } from "@/lib/scrollPins";
import { useOnce } from "@/lib/useOnce";
import { EventCard } from "../EventCard";
import styles from "./Events.module.css";

type Props = {
  events: EventData[];
  /** How many cards go on the rail; the rest sit behind a button. */
  limit?: number;
  /** Keep only events this person (slug) took part in. */
  filterSlug?: string;
  /** Replaces the group lede (profiles). */
  lede?: string;
  /** Chapter block id for this section (anchor + sidebar spy); none on profiles. */
  blockId?: string;
  /** Chapter anatomy (chapter pages, not profiles): how the chart counts, in one line under the lede. */
  criterion?: string;
  /** Chapter anatomy: a «Copiar link» button for `blockId` at the end of the section. */
  copyLink?: boolean;
};

const STAGGER = 0.07;

/** A snap rail of flip cards for the first events, and a compact list for the rest. */
export function Events({ events, limit = 20, filterSlug, lede = copy.events.lede, blockId, criterion, copyLink }: Props) {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLUListElement>(null);
  const seen = useOnce(railRef, 0.2);
  usePin(sectionRef);
  const [open, setOpen] = useState(false);
  const listId = useId();

  const shown = useMemo(
    () => (filterSlug ? events.filter((e) => e.protagonists.includes(filterSlug)) : events),
    [events, filterSlug],
  );
  const rail = shown.slice(0, limit);
  const rest = shown.slice(limit);

  useLayoutEffect(() => {
    if (!seen || reduced) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-card]",
        { opacity: 0, y: 30, rotateX: -20 },
        { opacity: 1, y: 0, rotateX: 0, duration: 0.7, ease: "back.out(1.4)", stagger: STAGGER, clearProps: "all" },
      );
    }, railRef);
    return () => ctx.revert();
  }, [seen, reduced]);

  return (
    <section ref={sectionRef} {...blockAnchor(blockId)} className={styles.events}>
      <h2>{copy.events.title}</h2>
      <p className={styles.lede}>{lede}</p>
      {criterion && <Criterion>{criterion}</Criterion>}

      {shown.length === 0 ? (
        <p className={styles.empty}>{copy.events.empty}</p>
      ) : (
        // data-lenis-prevent-horizontal: sideways swipes on the rail stay native under Lenis.
        <ul ref={railRef} className={styles.rail} aria-label={copy.events.railLabel} data-lenis-prevent-horizontal>
          {rail.map((event, i) => (
            <li key={event.id} className={styles.slot} data-card data-hidden={!seen || undefined}>
              <EventCard event={event} rank={i + 1} />
            </li>
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <div className={styles.more}>
          <button
            type="button"
            className={styles.button}
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
          >
            {copy.events.more(rest.length)}
          </button>
          <ul id={listId} className={styles.list} hidden={!open} data-extra>
            {rest.map((event) => (
              <li key={event.id} className={styles.row} data-kind={event.kind}>
                <span className={styles.rowTitle}>{event.title}</span>
                <span className={styles.rowMeta}>
                  {fmtDate(event.originDate)} · {copy.events.listDays(event.laterDays)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {copyLink && blockId && <CopyLink id={blockId} />}
    </section>
  );
}
