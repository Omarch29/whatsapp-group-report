"use client";

import { useEffect } from "react";

/**
 * Brings a shared block link (/lenguaje/#muletillas) to its block. The Gate only renders
 * the report after hydration or unlock, so the browser's own fragment jump found nothing:
 * this mounts with the report and scrolls there once. The block's scroll-margin-top keeps
 * it clear of the mobile bar.
 */
export function HashScroll() {
  useEffect(() => {
    let id: string;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    const reduced =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  }, []);
  return null;
}
