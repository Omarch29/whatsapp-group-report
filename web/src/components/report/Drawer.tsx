"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { copy } from "../../../content/copy";
import { chapterIndex } from "@/lib/chapters";
import { ChapterNav } from "./ChapterNav";
import { useReport } from "./ReportContext";
import styles from "./Sidebar.module.css";
import { useActiveBlock, useChapterSlug } from "./useChapter";

/**
 * Mobile top bar (menu button, chapter title, progress dots) and a modal <dialog> drawer
 * with the chapter list. The modal makes the page inert (focus stays inside); Escape, the
 * backdrop, the close button or choosing a link close it, and focus returns to the button.
 */
export function Drawer({ current }: { current?: string }) {
  const { title, chapters } = useReport();
  const slug = useChapterSlug(current);
  const pathname = usePathname();
  const active = useActiveBlock(pathname);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const i = slug === undefined ? -1 : chapterIndex(chapters, slug);

  const hide = () => dialog.current?.close();

  // A route change (back button included) never leaves the drawer open over the new page.
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  const show = () => {
    dialog.current?.showModal();
    setOpen(true);
    closer.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "Escape") hide();
  };

  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    // The dialog box is covered by its panel, so a click landing on the dialog itself is the backdrop.
    if (e.target === e.currentTarget || (e.target as Element).closest("a")) hide();
  };

  return (
    <>
      <header className={styles.bar}>
        <button
          ref={opener}
          type="button"
          className={styles.menu}
          aria-label={copy.nav.open}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={show}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className={styles.barTitle}>{i >= 0 ? chapters[i]!.title : title}</span>
        {i >= 0 && (
          <span className={styles.dots} role="img" aria-label={copy.nav.counter(i + 1, chapters.length)}>
            {chapters.map((c, j) => (
              <span key={c.href} className={styles.dot} data-dot data-on={j === i ? "" : undefined} />
            ))}
          </span>
        )}
      </header>
      <dialog
        ref={dialog}
        className={styles.drawer}
        aria-label={copy.nav.chapters}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onClose={() => {
          setOpen(false);
          opener.current?.focus();
        }}
      >
        <div className={styles.panel} data-lenis-prevent>
          <div className={styles.panelHead}>
            <span className={styles.logo}>{title}</span>
            <button ref={closer} type="button" className={styles.close} onClick={hide}>
              {copy.nav.close}
            </button>
          </div>
          <ChapterNav current={slug} activeBlock={active} />
        </div>
      </dialog>
    </>
  );
}
