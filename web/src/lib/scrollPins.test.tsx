import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMedia } from "@/test/motion";
import { ensureScrollTrigger, registerPins, ScrollTrigger, usePin } from "./scrollPins";

function sections(n: number): HTMLElement[] {
  return Array.from({ length: n }, () => {
    const el = document.createElement("section");
    document.body.appendChild(el);
    return el;
  });
}

// ScrollTrigger scrolls the window while measuring (also from deferred refreshes that
// outlive a test); jsdom only logs "not implemented". Not restored: jsdom is per file.
vi.spyOn(window, "scrollTo").mockImplementation(() => {});

afterEach(() => {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("registerPins", () => {
  it("creates no pins on a 390 px phone and still returns a cleanup", () => {
    mockMedia({ width: 390 });
    const cleanup = registerPins(sections(3).map((el) => ({ el })));
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(cleanup).toBeTypeOf("function");
    cleanup();
  });

  it("creates no pins just below the breakpoint, or below a custom one", () => {
    mockMedia({ width: 1023 });
    registerPins(sections(1).map((el) => ({ el })));
    mockMedia({ width: 1200, hover: true });
    registerPins(sections(1).map((el) => ({ el })), { minWidth: 1280 });
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it("creates no pins on a wide touch screen without hover (tablets keep native momentum)", () => {
    mockMedia({ width: 1366, hover: false });
    registerPins(sections(2).map((el) => ({ el })));
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it("creates no pins when matchMedia is missing (jsdom default)", () => {
    registerPins(sections(2).map((el) => ({ el })));
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it("pins one trigger per target on desktop and the cleanup kills them all", () => {
    mockMedia({ width: 1440, hover: true });
    const els = sections(3);
    const cleanup = registerPins(els.map((el) => ({ el })));
    const triggers = ScrollTrigger.getAll();
    expect(triggers).toHaveLength(3);
    expect(triggers.map((t) => t.trigger)).toEqual(els);
    expect(triggers.every((t) => t.pin === t.trigger)).toBe(true);
    cleanup();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    // Reverting the pin unwraps the pin-spacer: each section is back under body.
    expect(els.every((el) => el.parentElement === document.body)).toBe(true);
  });

  it("pins `inner` when given, with `el` as the trigger", () => {
    mockMedia({ width: 1440, hover: true });
    const [el] = sections(1);
    const inner = document.createElement("div");
    el.appendChild(inner);
    const cleanup = registerPins([{ el, inner }]);
    const [t] = ScrollTrigger.getAll();
    expect(t.trigger).toBe(el);
    expect(t.pin).toBe(inner);
    cleanup();
  });

  it("the cleanup kills only its own triggers", () => {
    mockMedia({ width: 1440, hover: true });
    const [other, mine] = sections(2);
    ensureScrollTrigger();
    const foreign = ScrollTrigger.create({ trigger: other });
    const cleanup = registerPins([{ el: mine }]);
    expect(ScrollTrigger.getAll()).toHaveLength(2);
    cleanup();
    expect(ScrollTrigger.getAll()).toEqual([foreign]);
  });

  it("creates no pins under prefers-reduced-motion, even on desktop", () => {
    mockMedia({ width: 1440, hover: true, reduced: true });
    registerPins(sections(3).map((el) => ({ el })));
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});

function Pinned({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  usePin(ref, enabled);
  return <section ref={ref} data-testid="pinned" />;
}

function PinnedInner() {
  const ref = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  usePin(ref, true, innerRef);
  return (
    <section ref={ref} data-testid="section">
      <div ref={innerRef} data-testid="inner" />
      <div data-testid="below" />
    </section>
  );
}

describe("usePin", () => {
  it("pins on desktop and unmounts cleanly: the pin-spacer is gone before React removes the node", () => {
    mockMedia({ width: 1440, hover: true });
    const { getByTestId, unmount } = render(<Pinned />);
    expect(ScrollTrigger.getAll()).toHaveLength(1);
    expect(getByTestId("pinned").parentElement).toHaveClass("pin-spacer");
    expect(() => unmount()).not.toThrow();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it("pins the inner element with the section as trigger, and unwraps it on unmount", () => {
    mockMedia({ width: 1440, hover: true });
    const { getByTestId, unmount } = render(<PinnedInner />);
    const [t] = ScrollTrigger.getAll();
    expect(ScrollTrigger.getAll()).toHaveLength(1);
    expect(t.trigger).toBe(getByTestId("section"));
    expect(t.pin).toBe(getByTestId("inner"));
    expect(getByTestId("inner").parentElement).toHaveClass("pin-spacer");
    expect(getByTestId("below").parentElement).toBe(getByTestId("section"));
    expect(() => unmount()).not.toThrow();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it("does nothing on a phone or when disabled", () => {
    mockMedia({ width: 390 });
    render(<Pinned />);
    mockMedia({ width: 1440, hover: true });
    render(<Pinned enabled={false} />);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});
