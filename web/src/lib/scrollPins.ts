"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, type RefObject } from "react";

export { ScrollTrigger };

let registered = false;
/**
 * Registers ScrollTrigger once, on the client, the first time something needs it.
 * Lazy on purpose: registration calls matchMedia (absent in SSR and plain jsdom) and
 * schedules GSAP delayed calls, which phones and reduced motion never need.
 */
export function ensureScrollTrigger(): void {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export type PinTarget = { el: HTMLElement; inner?: HTMLElement };

const REDUCED = "(prefers-reduced-motion: reduce)";
/** Touch tablets at >= 1024 px keep native momentum scroll: pins need a hovering pointer. */
const HOVER = "(hover: hover)";

// Content above a pin can change height after the pins are measured (font swap,
// late layouts): one debounced ScrollTrigger.refresh() covers every registration.
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRefresh(): void {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);
}

function watchPageHeight(): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  let last = document.body.offsetHeight;
  const ro = new ResizeObserver(() => {
    const h = document.body.offsetHeight;
    if (h !== last) {
      last = h;
      scheduleRefresh();
    }
  });
  ro.observe(document.body);
  return () => ro.disconnect();
}

/**
 * Pins each target (its `inner`, or the element itself) from `top top` for 60% of a
 * viewport, so a section holds still while its entrance plays. Desktop only: nothing
 * is created below `minWidth` (default 1024 px), without a hovering pointer (touch
 * tablets) or under prefers-reduced-motion, and
 * the pins come and go if either changes. The cleanup reverts exactly the triggers
 * this call created (and unwraps their pin-spacers), never anyone else's.
 */
export function registerPins(targets: PinTarget[], opts: { minWidth?: number } = {}): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mm = gsap.matchMedia();
  mm.add({ wide: `(min-width: ${opts.minWidth ?? 1024}px) and ${HOVER}`, reduce: REDUCED }, (ctx) => {
    if (!ctx.conditions?.wide || ctx.conditions.reduce) return;
    ensureScrollTrigger();
    for (const { el, inner } of targets) {
      ScrollTrigger.create({ trigger: el, pin: inner ?? el, pinSpacing: true, start: "top top", end: "+=60%" });
    }
    return watchPageHeight();
  });
  return () => mm.revert();
}

/**
 * Pins `ref`'s element on desktop (see registerPins), or only `innerRef`'s element with
 * `ref` as the trigger. A layout effect, so the pin is reverted before React removes
 * the element from the DOM on unmount: the pin-spacer would otherwise be the node's
 * parent and React's removeChild would throw.
 */
export function usePin(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
  innerRef?: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    return registerPins([{ el, inner: innerRef?.current ?? undefined }]);
  }, [ref, enabled, innerRef]);
}
