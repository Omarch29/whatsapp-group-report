import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}

const getSnapshot = (): boolean =>
  typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;

/** false on the server and during hydration, then the live prefers-reduced-motion value. */
const getServerSnapshot = (): boolean => false;

/**
 * Live `prefers-reduced-motion: reduce`. Unlike Motion's own hook it reads the media
 * query on every subscribe/snapshot instead of caching it at module load, so changing
 * the preference (or stubbing matchMedia in tests) takes effect, and it never warns.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
