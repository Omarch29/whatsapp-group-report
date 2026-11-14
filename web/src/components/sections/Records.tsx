"use client";

import { copy } from "../../../content/copy";
import { CopyLink, Criterion } from "@/components/report/Block";
import { blockAnchor } from "@/lib/blockAnchor";
import { fmtDate } from "@/lib/format";
import type { Person, PersonData, Quote, RecordsData } from "@/lib/schema";
import { PollBars } from "../PollBars";
import { RecordPair } from "../RecordPair";
import { Typewriter } from "../Typewriter";
import styles from "./Records.module.css";

type Props = {
  data: RecordsData;
  people: Person[];
  /** Person mode: that person's own records replace the group's. */
  person?: PersonData;
  /** The group record's counted length (the text is cleaned, so mentions can make it shorter); defaults to `text.length`. */
  recordLength?: number;
  /** Chapter block ids for the group view (the person view has none). */
  blockIds?: BlockIds;
  /** Chapter anatomy (group view): each block's criterion, in one line. */
  criteria?: { [K in keyof BlockIds]?: string };
  /** Chapter anatomy (group view): a «Copiar link» button for each of `blockIds`. */
  copyLinks?: boolean;
  /** Group view: only these parts render (the single page shows length, perDay and night); all of them by default. */
  parts?: readonly Part[];
  /** Group view: the length and per-day labels become those blocks' headings (the long page, which has no block titles). */
  headedParts?: boolean;
};

type BlockIds = { length?: string; perDay?: string; poll?: string; night?: string; quotes?: string };
type Part = keyof BlockIds;

const QUOTES_SHOWN = 5;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type BubblesProps = {
  title: string;
  quotes: Quote[];
  people: Person[];
  testId: string;
  meta: (q: Quote) => string;
};

function Bubbles({ title, quotes, people, testId, meta }: BubblesProps) {
  const nameOf = (slug: string) => people.find((p) => p.slug === slug)?.name ?? capitalize(slug);
  return (
    <section className={styles.col}>
      <h3 className={styles.colTitle}>{title}</h3>
      {quotes.slice(0, QUOTES_SHOWN).map((q) => (
        <figure key={`${q.when}-${q.text}`} className={styles.bubble} data-testid={testId}>
          <blockquote>{q.text}</blockquote>
          <figcaption className={styles.meta}>
            <span>{meta(q)}</span>
            <span>{`${nameOf(q.who)}, ${fmtDate(q.when)}`}</span>
          </figcaption>
        </figure>
      ))}
    </section>
  );
}

/** Message length and messages per day (plus streak and silence for a person), the poll and the quotes. */
export function Records({ data, people, person, recordLength, blockIds, criteria = {}, copyLinks, parts, headedParts }: Props) {
  const { messageLength, messagesPerDay, poll, latestNight } = data;
  const nameOf = (slug: string) => people.find((p) => p.slug === slug)?.name ?? capitalize(slug);
  const criterion = (k: Part) => criteria[k] && <Criterion>{criteria[k]}</Criterion>;
  const link = (k: Part) => copyLinks && blockIds?.[k] && <CopyLink id={blockIds[k]} />;
  const shows = (k: Part) => !parts || parts.includes(k);

  if (person) {
    const { longest, busiestDay, streak, silence } = person.records;
    const c = copy.records.person;
    return (
      <section className={styles.records}>
        <h2>{copy.records.title}</h2>
        <p className={styles.lede}>{copy.records.lede}</p>
        <div className={styles.cards}>
          <article className={styles.card}>
            <RecordPair
              label={copy.records.length.label}
              record={{ value: longest.value, who: longest.record.who, when: longest.record.when, unit: copy.records.length.unit(longest.value) }}
              caption={copy.records.length.caption}
              people={people}
            />
            <Typewriter text={longest.record.text} />
          </article>
          <article className={styles.card}>
            <RecordPair
              label={c.busiest.label}
              record={{ value: busiestDay.msgs, who: person.slug, when: busiestDay.date, unit: c.busiest.unit(busiestDay.msgs) }}
              caption={c.busiest.caption}
              people={people}
            />
          </article>
          <article className={styles.card}>
            <RecordPair
              label={c.streak.label}
              record={{ value: streak.days, who: person.slug, when: streak.from, unit: c.streak.unit(streak.days) }}
              caption={c.streak.caption(fmtDate(streak.to))}
              people={people}
            />
          </article>
          <article className={styles.card}>
            <RecordPair
              label={c.silence.label}
              record={{ value: silence.days, who: person.slug, when: silence.from, unit: c.silence.unit(silence.days) }}
              caption={c.silence.caption(fmtDate(silence.to))}
              people={people}
            />
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.records}>
      <h2>{copy.records.title}</h2>
      <p className={styles.lede}>{copy.records.lede}</p>

      {(shows("length") || shows("perDay")) && (
        <div className={styles.cards}>
          {shows("length") && (
            <article {...blockAnchor(blockIds?.length)} className={styles.card}>
              <RecordPair
                label={copy.records.length.label}
                average={{ value: Math.round(messageLength.value), unit: copy.records.length.averageUnit }}
                record={{
                  value: recordLength ?? messageLength.record.text.length,
                  who: messageLength.record.who,
                  when: messageLength.record.when,
                  unit: copy.records.length.unit(recordLength ?? messageLength.record.text.length),
                }}
                caption={copy.records.length.caption}
                people={people}
                labelAsHeading={headedParts}
              />
              {criterion("length")}
              <Typewriter text={messageLength.record.text} />
              {link("length")}
            </article>
          )}

          {shows("perDay") && (
            <article {...blockAnchor(blockIds?.perDay)} className={styles.card}>
              <RecordPair
                label={copy.records.perDay.label}
                average={{ value: Math.round(messagesPerDay.value), unit: copy.records.perDay.averageUnit }}
                record={{
                  value: messagesPerDay.record.msgs,
                  who: messagesPerDay.record.who,
                  when: messagesPerDay.record.when,
                  unit: copy.records.perDay.unit(messagesPerDay.record.msgs),
                }}
                caption={copy.records.perDay.caption}
                people={people}
                labelAsHeading={headedParts}
              />
              {criterion("perDay")}
              {link("perDay")}
              {poll && shows("poll") && (
                <div {...blockAnchor(blockIds?.poll)} className={styles.poll}>
                  <h3 className={styles.colTitle}>{copy.records.pollTitle(nameOf(poll.who), poll.totalVotes)}</h3>
                  {criterion("poll")}
                  <PollBars poll={poll} />
                  {link("poll")}
                </div>
              )}
            </article>
          )}
        </div>
      )}

      {latestNight && shows("night") && (
        <section {...blockAnchor(blockIds?.night)} className={styles.col}>
          <h3 className={styles.colTitle}>{copy.records.latestNightTitle}</h3>
          {criterion("night")}
          <figure className={styles.bubble} data-testid="latest-night">
            <blockquote>{latestNight.record.text}</blockquote>
            <figcaption className={styles.meta}>
              <span>
                {copy.records.latestNightMeta(
                  nameOf(latestNight.record.who),
                  fmtDate(latestNight.record.when),
                  /T(\d{2}:\d{2})/.exec(latestNight.record.when)?.[1] ?? null,
                )}
              </span>
            </figcaption>
          </figure>
          {link("night")}
        </section>
      )}

      {shows("quotes") && (
        <>
          {/* Before the two columns: the criterion would otherwise take a grid cell of the anchored row. */}
          {criterion("quotes")}
          <div {...blockAnchor(blockIds?.quotes)} className={styles.quotes}>
            <Bubbles
              title={copy.records.funniestTitle}
              quotes={data.funniest}
              people={people}
              testId="quote-funniest"
              meta={(q) => copy.records.laughsMeta(q.laughs ?? 0, q.people)}
            />
            <Bubbles
              title={copy.records.mostRepliedTitle}
              quotes={data.mostReplied}
              people={people}
              testId="quote-replied"
              meta={(q) => copy.records.repliesMeta(q.replies ?? 0, q.people)}
            />
          </div>
          {link("quotes")}
        </>
      )}
    </section>
  );
}
