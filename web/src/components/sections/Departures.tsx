"use client";

import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import { copy } from "../../../content/copy";
import { CopyLink, Criterion } from "@/components/report/Block";
import { blockAnchor } from "@/lib/blockAnchor";
import { fmt, fmtHours } from "@/lib/format";
import { useReducedMotion } from "@/lib/motion";
import type { DeparturesData, Facts, Person } from "@/lib/schema";
import { usePin } from "@/lib/scrollPins";
import { useOnce } from "@/lib/useOnce";
import { Door } from "../Door";
import { QuoteBubbles } from "../QuoteBubbles";
import { Ticker } from "../Ticker";
import styles from "./Departures.module.css";

type Props = {
  data: DeparturesData;
  facts: Facts;
  /** The departer's name, for the copy. */
  name: string;
  /** Polls the departer created (their global.json entry; 0 when they have no profile). */
  polls: number;
  /** Everyone, to resolve who attributed each quote. */
  people: Person[];
  /** Chapter block ids: `door` on the whole section (heading included), `quotes` on the quote bubbles nested in it. */
  blockIds?: { door?: string; quotes?: string };
  /** Chapter anatomy: the door's criterion, in one line under the lede. */
  criterion?: string;
  /** Chapter anatomy: a «Copiar link» button for each of `blockIds`. */
  copyLinks?: boolean;
};

const BAR_STAGGER = 0.08;

/** The reentries counter, the swinging door, the monthly beats and the quotes of whoever leaves and comes back. */
export function Departures({ data, facts, name, polls, people, blockIds, criterion, copyLinks }: Props) {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const seen = useOnce(topRef, 0.25);
  // On phones the columns stack and the door sits below the fold: it and the bars wait for their own column.
  const beat = useOnce(rightRef);
  // Only the counter and door hold still; the bars and quotes below keep scrolling in.
  usePin(sectionRef, true, topRef);

  useEffect(() => {
    if (!beat || reduced) return;
    const ctx = gsap.context(() => {
      gsap.to("[data-bar]", {
        scaleY: 1,
        duration: 1.2,
        ease: "elastic.out(1, .5)",
        stagger: BAR_STAGGER,
      });
    }, barsRef);
    return () => ctx.revert();
  }, [beat, reduced]);

  const chips = [
    { value: fmt(data.under10Min), caption: copy.departures.chips.under10Min },
    { value: fmtHours(data.medianOutHours), caption: copy.departures.chips.medianOut },
    { value: fmt(data.complaintCount), caption: data.complaintLabel },
    { value: fmt(polls), caption: copy.departures.chips.polls },
  ];
  const peak = Math.max(1, ...data.byMonth.map((m) => m.n));
  // The same months the caption names (facts.departerPeakMonths) are drawn in ribbon pink.
  const peakMonths = new Set(facts.departerPeakMonths.map((m) => m.month));

  return (
    <section ref={sectionRef} {...blockAnchor(blockIds?.door)} className={styles.departures}>
      <h2>{copy.departures.title}</h2>
      <div ref={topRef} className={styles.top}>
        <div className={styles.left}>
          <p className={`num ${styles.big}`}>
            {seen ? <Ticker value={data.reentries} duration={4.5} testId="reentries" /> : <span aria-hidden="true">0</span>}
          </p>
          <p className={styles.lede}>{copy.departures.lede(name, data.reentries)}</p>
          {criterion && <Criterion>{criterion}</Criterion>}
          <ul className={styles.chips}>
            {chips.map((c) => (
              <li key={c.caption} className={styles.chip}>
                <b className={styles.value}>{c.value}</b>
                <span className={styles.caption}>{c.caption}</span>
              </li>
            ))}
          </ul>
        </div>

        <div ref={rightRef} className={styles.right}>
          <Door swings={26} duration={4.3} play={beat && !reduced} />
          <div
            ref={barsRef}
            className={styles.bars}
            role="img"
            aria-label={copy.departures.barsLabel}
            data-static={reduced || undefined}
          >
            {data.byMonth.map((m) => (
              <i
                key={m.month}
                className={styles.bar}
                style={{ height: `${(m.n / peak) * 100}%` }}
                title={`${m.month}: ${m.n}`}
                data-bar
                data-peak={peakMonths.has(m.month) || undefined}
              />
            ))}
          </div>
          <p className={styles.peaks}>{copy.departures.peaks(facts.departerPeakMonths)}</p>
        </div>
      </div>
      {copyLinks && blockIds?.door && <CopyLink id={blockIds.door} />}

      <QuoteBubbles
        quotes={data.quotesRepeated.slice(0, 8)}
        attributed={data.quotesAttributed.slice(0, 5)}
        people={people}
        name={name}
        blockId={blockIds?.quotes}
      />
      {copyLinks && blockIds?.quotes && <CopyLink id={blockIds.quotes} />}
    </section>
  );
}
