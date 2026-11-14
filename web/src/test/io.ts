import { vi } from "vitest";

/** An IntersectionObserver that never fires: entrance start states stay. Restore with `vi.unstubAllGlobals()`. */
export function stubSilentIO(): void {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
}
