"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { useReducedMotion } from "./motion";

const noopSubscribe = () => () => {};
/** false during SSR and hydration, true afterwards (and on client-only renders). */
const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

/**
 * True once `ref` has been seen in the viewport (entrance animations fire once).
 * Under prefers-reduced-motion, or without IntersectionObserver, it turns true right
 * after hydration so final states show; it starts false on server and first client
 * render so hydration matches.
 */
export function useOnce(ref: RefObject<Element | null>, threshold = 0.35): boolean {
  const reduced = useReducedMotion() === true;
  const hydrated = useHydrated();
  const [seen, setSeen] = useState(false);
  const skip = hydrated && (reduced || typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    // The hydration commit runs this effect before `hydrated` flips, so `skip` may
    // still be false here: check for IntersectionObserver again.
    if (skip || seen || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, skip, seen]);

  return skip || seen;
}
