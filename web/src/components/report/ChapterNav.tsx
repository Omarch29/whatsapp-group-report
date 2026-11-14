"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";
import { copy } from "../../../content/copy";
import { PROFILE_BLOCKS, type BlockRef } from "@/lib/chapters";
import { useReport } from "./ReportContext";
import styles from "./Sidebar.module.css";
import { useChapterSlug } from "./useChapter";

type Props = {
  /** Chapter slug ("" is Introducción); derived from the pathname when omitted. */
  current?: string;
  /** Id of the block being read, marked with aria-current="location". */
  activeBlock?: string;
};

/** In-page anchors to `blocks`, the one being read marked with aria-current="location". */
function BlockList({ blocks, activeBlock, labelledBy }: { blocks: readonly BlockRef[]; activeBlock?: string; labelledBy?: string }) {
  return (
    <ol className={styles.blocks} aria-labelledby={labelledBy}>
      {blocks.map((b) => (
        <li key={b.id}>
          <a href={`#${b.id}`} className={styles.block} aria-current={b.id === activeBlock ? "location" : undefined}>
            {b.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * Every chapter in reading order; under the current one, its blocks as in-page anchors.
 * On a profile (/p/[slug]/) no chapter is current: "Este perfil" lists the profile's blocks first.
 */
export function ChapterNav({ current, activeBlock }: Props) {
  const { chapters } = useReport();
  const slug = useChapterSlug(current);
  const pathname = usePathname();
  const profile = slug === undefined && (pathname ?? "").startsWith("/p/");
  const profileTitle = useId();
  return (
    <nav aria-label={copy.nav.chapters} className={styles.nav}>
      {/* Above the chapters: under 18 links it would start below the fold. */}
      {profile && (
        <div className={styles.profile}>
          <p id={profileTitle} className={styles.profileTitle}>
            {copy.nav.profile}
          </p>
          <BlockList blocks={PROFILE_BLOCKS} activeBlock={activeBlock} labelledBy={profileTitle} />
        </div>
      )}
      <ol className={styles.chapters}>
        {chapters.map((c) => {
          const here = c.slug === slug;
          return (
            <li key={c.href}>
              <Link href={c.href} className={styles.chapter} aria-current={here ? "page" : undefined}>
                {c.title}
              </Link>
              {/* A single block is the chapter itself: no anchor list repeating its name. */}
              {here && c.blocks.length > 1 && <BlockList blocks={c.blocks} activeBlock={activeBlock} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
