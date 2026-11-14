"use client";

import Link from "next/link";
import { copy } from "../../../content/copy";
import type { ChapterId } from "@/chapters";
import { chapterById, chapterIndex, neighbors } from "@/lib/chapters";
import { useReport } from "./ReportContext";
import styles from "./Sidebar.module.css";

/** Previous / next chapter at the foot of a chapter; the last one offers "Volver al principio". */
export function ChapterPager({ id }: { id: ChapterId }) {
  const { chapters } = useReport();
  const { slug } = chapterById(id);
  if (chapterIndex(chapters, slug) === -1) return null;
  const { prev, next } = neighbors(chapters, slug);
  return (
    <nav aria-label={copy.nav.pager} className={styles.pager}>
      {prev && (
        <Link href={prev.href} rel="prev" className={styles.pagerLink}>
          <span className={styles.pagerDir}>
            <span aria-hidden="true">← </span>
            {copy.nav.prev}
          </span>{" "}
          <span className={styles.pagerName}>{prev.title}</span>
        </Link>
      )}
      {next ? (
        <Link href={next.href} rel="next" className={`${styles.pagerLink} ${styles.pagerNext}`}>
          <span className={styles.pagerDir}>
            {copy.nav.next}
            <span aria-hidden="true"> →</span>
          </span>{" "}
          <span className={styles.pagerName}>{next.title}</span>
        </Link>
      ) : (
        <Link href="/" className={`${styles.pagerLink} ${styles.pagerNext}`}>
          <span className={styles.pagerName}>{copy.nav.back}</span>
        </Link>
      )}
    </nav>
  );
}
