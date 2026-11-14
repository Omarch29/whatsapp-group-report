"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "../../../content/copy";
import { chapterIndex } from "@/lib/chapters";
import { ChapterNav } from "./ChapterNav";
import { useReport } from "./ReportContext";
import styles from "./Sidebar.module.css";
import { useActiveBlock, useChapterSlug } from "./useChapter";

/** Desktop menu (>=1024 px): logo, every chapter with the current one's blocks, and "Capítulo n de N". */
export function Sidebar({ current }: { current?: string }) {
  const { title, chapters } = useReport();
  const slug = useChapterSlug(current);
  const active = useActiveBlock(usePathname());
  const i = slug === undefined ? -1 : chapterIndex(chapters, slug);
  return (
    // data-lenis-prevent: the menu scrolls natively, never the page behind it.
    <aside className={styles.sidebar} data-lenis-prevent>
      <Link href="/" className={styles.logo}>
        {title}
      </Link>
      <ChapterNav current={slug} activeBlock={active} />
      {i >= 0 && <p className={styles.counter}>{copy.nav.counter(i + 1, chapters.length)}</p>}
    </aside>
  );
}
