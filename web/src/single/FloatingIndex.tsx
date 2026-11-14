"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { copy } from "../../content/copy";
import nav from "@/components/report/Sidebar.module.css";
import { useActiveBlock } from "@/components/report/useChapter";
import type { BlockRef } from "@/lib/chapters";
import styles from "./single.module.css";

/** In-page anchors to `blocks`, the one being read marked with aria-current="location" (as the sidebar's). */
function Anchors({ blocks, active }: { blocks: readonly BlockRef[]; active?: string }) {
  return (
    <ol className={nav.blocks}>
      {blocks.map((b) => (
        <li key={b.id}>
          <a href={`#${b.id}`} className={nav.block} aria-current={b.id === active ? "location" : undefined}>
            {b.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * The single page's navigation, in place of the sidebar and the drawer: on desktop a compact list beside the page,
 * on mobile an «Índice» button that opens a modal sheet with the same list. The sheet makes the page inert; Escape,
 * the backdrop, the close button or choosing an anchor close it, and focus returns to the button.
 */
export function FloatingIndex({ blocks }: { blocks: readonly BlockRef[] }) {
  // One page, so the observer never needs re-keying.
  const active = useActiveBlock("/");
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  const hide = () => dialog.current?.close();

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
      {/* data-lenis-prevent: the list scrolls natively, never the page behind it. */}
      <nav aria-label={copy.single.index} className={styles.index} data-floating-index data-lenis-prevent>
        <p className={styles.indexTitle}>{copy.single.index}</p>
        <Anchors blocks={blocks} active={active} />
      </nav>
      <button
        ref={opener}
        type="button"
        className={styles.open}
        aria-label={copy.single.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M5 7h14M5 12h14M5 17h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {copy.single.index}
      </button>
      <dialog
        ref={dialog}
        className={styles.sheet}
        aria-label={copy.single.index}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onClose={() => {
          setOpen(false);
          // The button is fixed: focusing it must not move the page away from the anchor just chosen.
          opener.current?.focus({ preventScroll: true });
        }}
      >
        <div className={styles.panel} data-lenis-prevent>
          <div className={nav.panelHead}>
            <span className={styles.indexTitle}>{copy.single.index}</span>
            <button ref={closer} type="button" className={nav.close} onClick={hide}>
              {copy.single.close}
            </button>
          </div>
          <nav data-floating-index>
            <Anchors blocks={blocks} active={active} />
          </nav>
        </div>
      </dialog>
    </>
  );
}
