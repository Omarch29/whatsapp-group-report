"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { copy } from "../../../../content/copy";
import { PollBars } from "@/components/PollBars";
import { personTextColor } from "@/lib/colors";
import { fmtDate } from "@/lib/format";
import { personName } from "@/lib/language";
import { RESTO } from "@/lib/media";
import type { Person, PollsData } from "@/lib/schema";
import styles from "./TopPolls.module.css";

export const TOP_SHOWN = 10;

const TABS = ["mostVoted", "unanimous", "divided"] as const;
type Tab = (typeof TABS)[number];

type Props = { data: PollsData; people: Person[] };

const p = copy.polls;

/** The most voted, most unanimous and most divided polls behind three tabs; every poll's bars fill on view. */
export function TopPolls({ data, people }: Props) {
  const [tab, setTab] = useState<Tab>("mostVoted");
  const base = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const list = data[tab].slice(0, TOP_SHOWN);
  const tabId = (t: Tab) => `${base}-tab-${t}`;
  const panelId = `${base}-panel`;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (TABS.indexOf(tab) + step + TABS.length) % TABS.length;
    setTab(TABS[next]!);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={styles.root}>
      <div className={styles.tabs} role="tablist" aria-label={p.tabsLabel} onKeyDown={onKeyDown}>
        {TABS.map((t, i) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            id={tabId(t)}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={tab === t}
            aria-controls={panelId}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
          >
            {p.tabs[t]}
          </button>
        ))}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={tabId(tab)} tabIndex={0} className={styles.panel}>
        {list.length === 0 ? (
          <p className={styles.empty}>{copy.empty}</p>
        ) : (
          <ol className={styles.list}>
            {list.map((poll, i) => {
              const resto = poll.who === RESTO;
              return (
                <li key={`${tab}-${i}`} className={styles.item} data-testid="poll-item">
                  <PollBars poll={poll} />
                  <p className={styles.meta}>
                    <span
                      style={resto ? undefined : { color: personTextColor(poll.who, people) }}
                      className={styles.author}
                    >
                      {resto ? p.someoneElse : personName(poll.who, people)}
                    </span>
                    {p.pollWhen(fmtDate(poll.when), poll.totalVotes)}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
