"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CHAPTERS, chapterIndex } from "@/lib/chapters";

/** "/lenguaje/" → "lenguaje", "/" → "" (Introducción); anything that is not a chapter (a profile) → undefined. */
export function slugFromPath(pathname: string | null): string | undefined {
  const slug = (pathname ?? "/").replace(/^\/+|\/+$/g, "");
  return chapterIndex(CHAPTERS, slug) === -1 ? undefined : slug;
}

/** The explicit `current` slug when given, otherwise the chapter of the current route. */
export function useChapterSlug(current?: string): string | undefined {
  const pathname = usePathname();
  return current ?? slugFromPath(pathname);
}

/**
 * Reading band: from just under the anchor offset (the blocks' scroll-margin-top, 4.5rem in
 * globals.css) down to 40% of the viewport. A block an anchor lands on sits at that offset,
 * so it is the topmost one in the band, even when it is short. The extra pixels keep the
 * previous block's bottom edge (touching the offset) out of the band.
 */
function band(block: HTMLElement): string {
  const offset = parseFloat(getComputedStyle(block).scrollMarginTop) || 0;
  return `-${Math.round(offset) + 8}px 0px -60% 0px`;
}

/**
 * Id of the `[data-block]` section being read, re-observed whenever `key` (the route) changes.
 * Anchors may nest; the innermost one in the band is the one being read.
 * Between two blocks it keeps the last one, so the sidebar mark never blinks off.
 */
export function useActiveBlock(key: string | null): string | undefined {
  const [state, setState] = useState<{ key: string | null; id: string }>();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-block][id]"));
    if (blocks.length === 0) return;
    const inBand = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inBand.add(e.target);
          else inBand.delete(e.target);
        }
        // Innermost first: a block holding another in-band block (records' per-day card holding
        // the poll) yields to it. Then document order: the topmost remaining block wins.
        const candidates = blocks.filter((el) => inBand.has(el));
        const first = candidates.find((el) => !candidates.some((other) => other !== el && el.contains(other)));
        if (first) setState({ key, id: first.id });
      },
      { rootMargin: band(blocks[0]!) },
    );
    blocks.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);

  // A mark left over from the previous route never leaks into the new one.
  return state?.key === key ? state.id : undefined;
}
