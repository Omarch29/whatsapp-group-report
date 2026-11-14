"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "../../../content/copy";
import styles from "./Block.module.css";

type Status = "idle" | "copied" | "failed";

/** Copies the permalink of a block and announces the result for 2 seconds. */
export function CopyLink({ id }: { id: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const announce = (next: Status) => {
    setStatus(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2000);
  };

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#${id}`);
      announce("copied");
    } catch {
      announce("failed");
    }
  };

  return (
    <div className={styles.copyRow}>
      <button type="button" className={styles.copyButton} onClick={onClick} data-copy-link={id}>
        {copy.block.copy}
      </button>
      <span role="status" aria-live="polite" className={styles.copyStatus}>
        {status === "copied" ? copy.block.copied : status === "failed" ? copy.block.failed : ""}
      </span>
    </div>
  );
}
