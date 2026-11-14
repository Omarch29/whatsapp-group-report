import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockReducedMotion } from "@/test/motion";

/** Ticker as a build in `lang` sees it: the copy (and with it the locale) is read once, when its module loads. */
async function tickerIn(lang: "es" | "en") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_WGR_LANG", lang);
  return (await import("./Ticker")).Ticker;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Ticker paints the build locale's thousands separator", () => {
  it.each([
    ["es", "1.234.567", ".", "1.234,5", ","],
    ["en", "1,234,567", ",", "1,234.5", "."],
  ] as const)("%s", async (lang, whole, group, decimal, point) => {
    mockReducedMotion(true);
    const Ticker = await tickerIn(lang);
    const { container, unmount } = render(<Ticker value={1234567} testId="t" />);
    expect(screen.getByTestId("t")).toHaveTextContent(whole);
    const seps = [...container.querySelectorAll("b.sep")].map((b) => b.textContent);
    expect(seps).toEqual([group, group]);
    unmount();

    // A decimal point is not a thousands separator.
    const r = render(<Ticker value={1234.5} testId="d" />);
    expect(screen.getByTestId("d")).toHaveTextContent(decimal);
    expect([...r.container.querySelectorAll("b.sep")].map((b) => b.textContent)).toEqual([group]);
    expect(screen.getByTestId("d").textContent!.split(point)).toHaveLength(2);
  });
});
