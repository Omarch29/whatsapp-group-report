"use client";

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { copy } from "../../content/copy";
import { normalizeWord, sha256Hex } from "@/lib/hash";
import styles from "./Gate.module.css";

const KEY = "wgr_gate";
const CHANGE = "wgr-gate-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/** Blocked storage (privacy modes, disabled cookies) reads as "locked". */
function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
/** On the server (static export) the stored hash is unknown: render neither side. */
const readOnServer = (): undefined => undefined;

type Props = { hash: string; /** Report title, shown above the word field. */ title: string; children: ReactNode };

/**
 * Group gate: children render only when localStorage.wgr_gate equals `hash`
 * (sha256 of the group word, computed at build). Unlocking re-renders in place,
 * so a deep link like /p/ana stays where it is.
 */
export function Gate({ hash, title, children }: Props) {
  const stored = useSyncExternalStore(subscribe, readStored, readOnServer);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Unlocked in this tab even when storage refuses the write.
  const [unlockedHere, setUnlockedHere] = useState(false);

  if (stored === hash || unlockedHere) return <>{children}</>;
  if (stored === undefined) return <div className={styles.screen} aria-busy="true" />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let typed: string;
    try {
      typed = await sha256Hex(normalizeWord(word));
    } catch {
      // crypto.subtle is missing outside secure contexts (plain http on a phone).
      setError(copy.gate.unverifiable);
      return;
    }
    if (typed !== hash) {
      setError(copy.gate.error);
      return;
    }
    try {
      localStorage.setItem(KEY, typed);
      window.dispatchEvent(new Event(CHANGE));
    } catch {
      setUnlockedHere(true);
    }
  }

  return (
    <main className={styles.screen}>
      <form className={styles.form} onSubmit={onSubmit}>
        <h1 className={styles.title}>{title}</h1>
        <input
          className={styles.input}
          type="text"
          name="word"
          aria-label={copy.gate.placeholder}
          placeholder={copy.gate.placeholder}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={word}
          onChange={(e) => {
            setWord(e.target.value);
            setError(null);
          }}
        />
        <button className={styles.button} type="submit">
          {copy.gate.submit}
        </button>
        <p className={styles.error} role="alert">
          {error ?? ""}
        </p>
      </form>
    </main>
  );
}
