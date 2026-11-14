"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { copy } from "../../../../content/copy";
import { PersonChips } from "@/components/PersonChips";
import { RecordPair } from "@/components/RecordPair";
import { Criterion, Lede } from "@/components/report/Block";
import { Painted } from "@/components/report/Painted";
import { colorForSlug, personTextColor } from "@/lib/colors";
import { fmtDate } from "@/lib/format";
import { defaultPerson, ledeMuletilla, MIN_DEFAULT_PHRASES, personName, splitMatch } from "@/lib/language";
import { useReducedMotion } from "@/lib/motion";
import type { LanguageData, Person } from "@/lib/schema";
import { useOnce } from "@/lib/useOnce";
import chat from "./chat.module.css";
import styles from "./Muletillas.module.css";

type Muletilla = LanguageData["muletillas"][string][number];

type Props = {
  data: LanguageData["muletillas"];
  people: Person[];
  /** Fixes the person (profiles): no chips, no "Todas". */
  person?: string;
  /** The group's top muletilla, shown as the block's record. */
  top?: LanguageData["top"]["muletilla"];
  /** The block's criterion line, rendered after the live lede. */
  criterion?: string;
};

/** How long "escribiendo…" shows before each of the first three bubbles. */
export const TYPING_MS = 750;
/** Pause after a typed bubble lands, before the next one. */
export const PAUSE_MS = 250;
/** Between bubbles that arrive without typing. */
export const STAGGER_MS = 120;
/** A chip change waits for the previous thread to leave. */
export const SWITCH_MS = 220;
const TYPED = 3;
const EASE = [0.22, 1, 0.36, 1] as const;
const ARRIVE = { type: "spring", stiffness: 520, damping: 34, mass: 0.9 } as const;

type Run = { key: string; shown: number; typing: number };

/**
 * The star block: a person's muletillas as an incoming chat thread. On first view the
 * first three arrive after "escribiendo…", the rest one by one; a chip change replays the
 * arrival without typing. A bubble opens a real message as a quoted sub-bubble.
 */
export function Muletillas({ data, people, person, top, criterion }: Props) {
  const reduced = useReducedMotion();
  const screenRef = useRef<HTMLDivElement>(null);
  const seen = useOnce(screenRef, 0.1);
  const baseId = useId();
  const order = people.filter((p) => data[p.slug] !== undefined);
  const [picked, setPicked] = useState(() => defaultPerson(data, people, (l) => l.length >= MIN_DEFAULT_PHRASES));
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [all, setAll] = useState(false);
  const [run, setRun] = useState<Run>({ key: "", shown: 0, typing: -1 });
  const firstKey = useRef<string | null>(null);
  const typedDone = useRef(false);

  const sel = person ?? picked;
  const list = data[sel] ?? [];
  const n = list.length;
  const name = personName(sel, people);
  const color = colorForSlug(sel, people);
  const textColor = personTextColor(sel, people);

  // The arrival: timers only (no state set synchronously), keyed by the selection.
  useEffect(() => {
    if (reduced || !seen) return;
    firstKey.current ??= sel;
    const first = !typedDone.current && sel === firstKey.current;
    if (!first) typedDone.current = true;
    const typed = first ? Math.min(TYPED, n) : 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    let t = first ? 0 : SWITCH_MS;
    for (let i = 0; i < n; i++) {
      if (i < typed) {
        at(t, () => setRun({ key: sel, shown: i, typing: i }));
        t += TYPING_MS;
        at(t, () => setRun({ key: sel, shown: i + 1, typing: -1 }));
        t += PAUSE_MS;
      } else {
        at(t, () => setRun({ key: sel, shown: i + 1, typing: -1 }));
        t += STAGGER_MS;
      }
    }
    if (first) at(t, () => (typedDone.current = true));
    return () => timers.forEach(clearTimeout);
  }, [sel, seen, reduced, n]);

  const shown = reduced ? n : run.key === sel ? run.shown : 0;
  const typingAt = reduced || run.key !== sel ? -1 : run.typing;

  // A chip change starts the new arrival from zero right away: a quick back-and-forth
  // (Tomi → Ana → Tomi inside SWITCH_MS) must not show Tomi's old, finished run.
  // The arrival effect only re-runs when `sel` changes, so re-picking the current person must
  // not reset `run` (the thread would stay blank).
  const choose = (slug: string) => {
    if (slug === sel) return;
    setPicked(slug);
    setRun({ key: slug, shown: 0, typing: -1 });
  };
  const fromCard = (slug: string) => {
    choose(slug);
    screenRef.current?.scrollIntoView?.({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  };
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const lede = ledeMuletilla(list);
  const ledeText = lede
    ? copy.language.muletillasLede(name, lede.display, lede.own, lede.ratio)
    : copy.language.muletillasLedeEmpty(name);

  return (
    <div className={styles.root} style={{ "--c": color, "--ct": textColor } as CSSProperties}>
      <Lede>
        <motion.span key={sel} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
          <Painted text={ledeText} who={[sel]} people={people} />
        </motion.span>
      </Lede>
      {criterion && <Criterion>{criterion}</Criterion>}

      {!person && <PersonChips people={order} value={sel} onChange={choose} label={copy.language.chips} />}
      {n > 0 && <p className={styles.hint}>{copy.language.exampleHint}</p>}

      <div ref={screenRef} className={`${chat.screen} ${styles.screen}`}>
        <AnimatePresence mode="wait" initial={false}>
          {n > 0 ? (
            <motion.ol
              key={sel}
              className={styles.thread}
              aria-label={copy.language.threadLabel(name)}
              exit={reduced ? undefined : { opacity: 0, y: -12, transition: { duration: (SWITCH_MS / 1000) * 0.8 } }}
            >
              {list.map((m, i) => {
                const key = `${sel}:${m.phrase}`;
                return (
                  <Phrase
                    key={key}
                    m={m}
                    first={i === 0}
                    name={name}
                    arrived={i < shown}
                    typing={i === typingAt}
                    open={open.has(key)}
                    onToggle={() => toggle(key)}
                    exampleId={`${baseId}-${i}`}
                    reduced={reduced}
                  />
                );
              })}
            </motion.ol>
          ) : (
            <motion.p
              key={`empty:${sel}`}
              className={chat.system}
              exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
            >
              {copy.empty}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {!person && order.length > 0 && (
        <div className={styles.all}>
          <button type="button" className={styles.allToggle} aria-pressed={all} onClick={() => setAll((v) => !v)}>
            {copy.language.all}
          </button>
          <AnimatePresence initial={false}>
            {all && (
              <motion.ul
                key="all"
                className={styles.grid}
                aria-label={copy.language.allLabel}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
              >
                {order.map((p, i) => {
                  const firstPhrase = data[p.slug]?.[0];
                  return (
                    <motion.li
                      key={p.slug}
                      initial={reduced ? false : { opacity: 0, y: 14, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ ...ARRIVE, delay: i * 0.04 }}
                    >
                      <button
                        type="button"
                        className={`${chat.bubble} ${chat.tail} ${styles.card}`}
                        aria-pressed={sel === p.slug}
                        onClick={() => fromCard(p.slug)}
                      >
                        <span className={chat.name} style={{ color: personTextColor(p.slug, people) }}>
                          {p.name}
                        </span>
                        {firstPhrase ? (
                          <>
                            <span className={styles.cardPhrase}>{copy.quote(firstPhrase.display)}</span>
                            <span className={chat.meta}>{copy.language.times(firstPhrase.own)}</span>
                          </>
                        ) : (
                          <span className={styles.cardEmpty}>{copy.empty}</span>
                        )}
                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      {top && (
        <RecordPair
          label={copy.language.topMuletilla.label}
          record={{
            value: top.own,
            unit: copy.language.topMuletilla.unit(top.own),
            who: top.slug,
            when: `${top.firstMonth}-01`,
            whenLabel: copy.language.since(top.firstMonth),
          }}
          caption={copy.quote(top.display)}
          people={people}
        />
      )}
    </div>
  );
}

type PhraseProps = {
  m: Muletilla;
  first: boolean;
  name: string;
  arrived: boolean;
  typing: boolean;
  open: boolean;
  onToggle: () => void;
  exampleId: string;
  reduced: boolean;
};

/** One muletilla bubble; the typing dots hold its slot until it lands. */
function Phrase({ m, first, name, arrived, typing, open, onToggle, exampleId, reduced }: PhraseProps) {
  const parts = splitMatch(m.example.text, m.phrase);
  return (
    <li className={styles.item} data-arrived={arrived} data-typing={typing || undefined}>
      <AnimatePresence>
        {typing && (
          <motion.span
            key="typing"
            className={`${chat.bubble} ${chat.tail} ${styles.typingBubble}`}
            data-testid="typing"
            aria-hidden="true"
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <span className={chat.typing}>
              <span className={chat.dots}>
                <i />
                <i />
                <i />
              </span>
              <span>
                <b className={styles.typingName}>{name}</b> {copy.language.typing}
              </span>
            </span>
          </motion.span>
        )}
      </AnimatePresence>

      <motion.div
        className={styles.arrival}
        inert={!arrived}
        initial={false}
        animate={arrived ? "in" : "out"}
        variants={{ out: { opacity: 0, y: 18, scale: 0.96 }, in: { opacity: 1, y: 0, scale: 1 } }}
        transition={reduced ? { duration: 0 } : ARRIVE}
      >
        <button
          type="button"
          className={`${chat.bubble} ${first ? chat.tail : ""} ${styles.bubble}`}
          aria-expanded={open}
          aria-controls={exampleId}
          onClick={onToggle}
        >
          {first && (
            <span className={`${chat.name} ${styles.name}`} aria-hidden="true">
              {name}
            </span>
          )}
          <span className={styles.phrase}>{m.display}</span>
          <span className={chat.meta}>
            <span>{copy.language.muletillaMeta(m.own, m.others)}</span>
            <span>{copy.language.since(m.firstMonth)}</span>
          </span>
          <span className={styles.caret} aria-hidden="true" />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="example"
              id={exampleId}
              className={styles.exampleWrap}
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              <figure className={styles.example}>
                <blockquote>
                  {parts ? (
                    <>
                      {parts[0]}
                      <mark>{parts[1]}</mark>
                      {parts[2]}
                    </>
                  ) : (
                    m.example.text
                  )}
                </blockquote>
                <figcaption className={chat.meta}>
                  <span />
                  <span>{fmtDate(m.example.when)}</span>
                </figcaption>
              </figure>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </li>
  );
}
