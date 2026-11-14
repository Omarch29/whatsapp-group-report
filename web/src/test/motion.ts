import { vi } from "vitest";

/**
 * Stubs window.matchMedia so `(prefers-reduced-motion: reduce)` matches when `on`.
 * Restore with `vi.unstubAllGlobals()` in an afterEach of the test file that uses it.
 */
export function mockReducedMotion(on: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: on && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }));
}

type Media = { width?: number; hover?: boolean; reduced?: boolean };

/** Evaluates one media feature like `(min-width: 1024px)` against the mocked device. */
function featureMatches(feature: string, { width = 390, hover = false, reduced = false }: Media): boolean {
  const f = feature.trim();
  const min = /^\(min-width:\s*(\d+)px\)$/.exec(f);
  if (min) return width >= Number(min[1]);
  const max = /^\(max-width:\s*(\d+)px\)$/.exec(f);
  if (max) return width <= Number(max[1]);
  if (f === "(hover: hover)") return hover;
  if (f === "(prefers-reduced-motion: reduce)") return reduced;
  if (f === "(prefers-reduced-motion: no-preference)") return !reduced;
  return false;
}

/**
 * Stubs window.matchMedia for a device of `width` px (default a 390 px phone), with
 * or without hover and reduced motion. Understands `and`-joined min/max-width, hover
 * and prefers-reduced-motion features. Restore with `vi.unstubAllGlobals()`.
 */
export function mockMedia(media: Media = {}): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.split(/\s+and\s+/).every((f) => featureMatches(f, media)),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }));
}
