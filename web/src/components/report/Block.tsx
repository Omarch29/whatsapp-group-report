import type { ReactNode } from "react";
import styles from "./Block.module.css";
import { CopyLink } from "./CopyLink";

export { CopyLink };

type BlockProps = {
  id: string;
  title: string;
  /** Omit when a child renders a live lede itself (with `Lede` and `Criterion`, in this order). */
  lede?: ReactNode;
  /** How the number was counted, in one line. */
  criterion?: string;
  children: ReactNode;
  record?: ReactNode;
  /** For a chapter whose only block repeats the chapter title: the h3 stays for screen readers and anchors, hidden on screen. */
  hideTitle?: boolean;
  /** Heading level: 3 under a chapter page's h2 (default), 2 where the block is a top-level section (the long page). */
  level?: 2 | 3;
};

/** The block's lede paragraph, for a chart that owns it (it changes with a selection). */
export function Lede({ children }: { children: ReactNode }) {
  return <p className={styles.lede}>{children}</p>;
}

/** The block's criterion line. */
export function Criterion({ children }: { children: ReactNode }) {
  return (
    <p className={styles.criterion} data-criterion>
      {children}
    </p>
  );
}

/** One data block of a chapter: title, lede, criterion, the chart, the record and a permalink. */
export function Block({ id, title, lede, criterion, children, record, hideTitle, level = 3 }: BlockProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section id={id} data-block aria-labelledby={`${id}-title`} className={styles.block}>
      <Heading id={`${id}-title`} className={hideTitle ? styles.hiddenTitle : styles.title}>
        {title}
      </Heading>
      {lede !== undefined && <Lede>{lede}</Lede>}
      {criterion && <Criterion>{criterion}</Criterion>}
      {children}
      {record}
      <CopyLink id={id} />
    </section>
  );
}
