"use client";

import { gsap } from "gsap";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect, type ReactNode } from "react";
import { ensureScrollTrigger, ScrollTrigger } from "@/lib/scrollPins";

/** A real desktop: wide and with a hovering pointer (wide tablets keep native touch scroll). */
const DESKTOP = "(min-width: 1024px) and (hover: hover)";
const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Lenis smooth scroll on desktop only, off under prefers-reduced-motion, driven by
 * gsap.ticker so it shares a frame with GSAP, and feeding ScrollTrigger on every
 * scroll so the section pins stay in sync. Renders `children` unchanged.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mm = gsap.matchMedia();
    mm.add({ desktop: DESKTOP, reduce: REDUCED }, (ctx) => {
      if (!ctx.conditions?.desktop || ctx.conditions.reduce) return;
      ensureScrollTrigger();
      const lenis = new Lenis();
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      return () => {
        gsap.ticker.remove(raf);
        gsap.ticker.lagSmoothing(500, 33);
        lenis.destroy();
      };
    });
    return () => mm.revert();
  }, []);

  return <>{children}</>;
}
