"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../../../../content/copy";
import { PersonBars } from "@/components/PersonBars";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { fmt, fmtDate } from "@/lib/format";
import { personName } from "@/lib/language";
import { mentionsOf, rowMax, sampleKey } from "@/lib/mentions";
import type { MentionsData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import chat from "../language/chat.module.css";
import styles from "./Matrix.module.css";

type Props = {
  data: MentionsData;
  people: Person[];
  /** Profile mode: only this person's row and column, as two bar lists. */
  person?: string;
};

const m = copy.mentions;
/** Samples shown per cell. */
export const MAX_SAMPLES = 3;

type Cell = { r: number; c: number };

/**
 * Who mentions whom: a heat grid, rows mention columns, each cell in the row person's colour
 * at a strength relative to that row's biggest cell. It lights up row by row on first view;
 * a tap (or Enter) on a cell lists its latest messages below. Arrow keys move between cells.
 */
export function Matrix({ data, people, person }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref, 0.15);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState<Cell>({ r: 0, c: 0 });
  const [open, setOpen] = useState<Cell | null>(null);
  const n = data.slugs.length;

  if (person) return <PersonMentions data={data} people={people} person={person} />;
  if (n === 0) return <p className={styles.empty}>{copy.empty}</p>;

  const name = (i: number) => personName(data.slugs[i]!, people);

  /** Closes the panel and hands focus back to the cell that opened it (the panel unmounts). */
  const close = () => {
    if (!open) return;
    const opener = cells.current[open.r * n + open.c];
    setOpen(null);
    opener?.focus();
  };

  const move = (e: KeyboardEvent, { r, c }: Cell) => {
    const next: Cell | null =
      e.key === "ArrowRight"
        ? { r, c: Math.min(n - 1, c + 1) }
        : e.key === "ArrowLeft"
          ? { r, c: Math.max(0, c - 1) }
          : e.key === "ArrowDown"
            ? { r: Math.min(n - 1, r + 1), c }
            : e.key === "ArrowUp"
              ? { r: Math.max(0, r - 1), c }
              : e.key === "Home"
                ? { r, c: 0 }
                : e.key === "End"
                  ? { r, c: n - 1 }
                  : null;
    if (!next) return;
    e.preventDefault();
    setFocus(next);
    cells.current[next.r * n + next.c]?.focus();
  };

  const sel = open && {
    from: data.slugs[open.r]!,
    to: data.slugs[open.c]!,
    count: data.matrix[open.r]?.[open.c] ?? 0,
  };
  const list = sel ? (data.samples[sampleKey(sel.from, sel.to)] ?? []).slice(0, MAX_SAMPLES) : [];

  return (
    // Escape only closes the panel when it comes from inside this block (not, say, from the drawer).
    <div
      className={styles.root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) close();
      }}
    >
      <div ref={ref} className={styles.scroller}>
        <div
          role="grid"
          aria-label={m.matrixLabel}
          className={styles.grid}
          data-seen={seen}
          style={{ "--n": n } as CSSProperties}
        >
          <div role="row" className={styles.row}>
            <span role="columnheader" className={styles.corner}>
              <span className={styles.spoken}>{m.cornerSpoken}</span>
              <span aria-hidden="true">{m.corner}</span>
            </span>
            {data.slugs.map((slug, j) => (
              <span key={slug} role="columnheader" className={styles.colHead}>
                <i className={styles.dot} style={{ background: colorForSlug(slug, people) }} aria-hidden="true" />
                <span className={styles.colName}>{name(j)}</span>
              </span>
            ))}
          </div>
          {data.slugs.map((from, i) => {
            const color = colorForSlug(from, people);
            const max = rowMax(data, i);
            return (
              <div key={from} role="row" className={styles.row} style={{ "--r": i } as CSSProperties}>
                <span role="rowheader" className={styles.rowHead} style={{ color: personTextColor(from, people) }}>
                  <i className={styles.dot} style={{ background: color }} aria-hidden="true" />
                  {name(i)}
                </span>
                {data.slugs.map((to, j) => {
                  const v = data.matrix[i]?.[j] ?? 0;
                  const pct = v === 0 ? 0 : 18 + (82 * v) / max;
                  const isOpen = open?.r === i && open.c === j;
                  return (
                    <span key={to} role="gridcell" className={styles.gridcell}>
                      <button
                        ref={(el) => {
                          cells.current[i * n + j] = el;
                        }}
                        type="button"
                        className={styles.cell}
                        aria-label={m.cell(name(i), name(j), v)}
                        aria-pressed={isOpen}
                        tabIndex={focus.r === i && focus.c === j ? 0 : -1}
                        data-zero={v === 0 || undefined}
                        style={
                          {
                            "--c": j,
                            background: v === 0 ? undefined : `color-mix(in srgb, ${color} ${pct.toFixed(1)}%, var(--ink))`,
                          } as CSSProperties
                        }
                        onClick={() => {
                          setFocus({ r: i, c: j });
                          setOpen(isOpen ? null : { r: i, c: j });
                        }}
                        onKeyDown={(e) => move(e, { r: i, c: j })}
                      />
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className={styles.hint}>{m.hint}</p>
      <div className={styles.panel} data-testid="mention-panel" aria-live="polite">
        {sel && (
          <div className={styles.samples}>
            <div className={styles.panelHead}>
              <p className={styles.panelTitle}>
                {m.samplesTitle(personName(sel.from, people), personName(sel.to, people), sel.count)}
              </p>
              <button type="button" className={styles.close} onClick={close}>
                {m.close}
              </button>
            </div>
            {list.length > 0 ? (
              <ul className={chat.screen}>
                {list.map((s) => (
                  <li key={s.when + s.text} className={styles.sample}>
                    <span className={`${chat.bubble} ${chat.tail}`}>
                      <span className={chat.name} style={{ color: personTextColor(sel.from, people) }}>
                        {personName(sel.from, people)}
                      </span>
                      <span className={styles.text}>{s.text}</span>
                      <span className={chat.meta}>
                        <span />
                        <span>{fmtDate(s.when)}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.none}>{m.noSamples}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Profile mode: whom the person mentions and who mentions them. */
function PersonMentions({ data, people, person }: Required<Props>) {
  const { to, by } = mentionsOf(data, person);
  if (to.length === 0 && by.length === 0) return <p className={styles.empty}>{copy.empty}</p>;
  const nm = personName(person, people);
  const rows = (list: typeof to) => list.map((r) => ({ slug: r.slug, value: r.n, display: fmt(r.n) }));
  return (
    <div className={styles.lists}>
      <div className={styles.list}>
        <p className={styles.listTitle}>{m.mentionsTo(nm)}</p>
        <PersonBars rows={rows(to)} people={people} label={m.mentionsTo(nm)} />
      </div>
      <div className={styles.list}>
        <p className={styles.listTitle}>{m.mentionedBy(nm)}</p>
        <PersonBars rows={rows(by)} people={people} label={m.mentionedBy(nm)} />
      </div>
    </div>
  );
}
