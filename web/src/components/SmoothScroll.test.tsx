import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockMedia } from "@/test/motion";

const lenis = vi.hoisted(() => ({
  ctor: vi.fn(),
  on: vi.fn(),
  raf: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("lenis", () => ({
  default: vi.fn(function Lenis(this: object, opts: unknown) {
    lenis.ctor(opts);
    return { on: lenis.on, raf: lenis.raf, destroy: lenis.destroy };
  }),
}));

import { ScrollTrigger } from "@/lib/scrollPins";
import { SmoothScroll } from "./SmoothScroll";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

function renderTree() {
  return render(
    <SmoothScroll>
      <p>contenido</p>
    </SmoothScroll>,
  );
}

describe("SmoothScroll", () => {
  it("renders its children and stays off in plain jsdom (no matchMedia)", () => {
    renderTree();
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(lenis.ctor).not.toHaveBeenCalled();
  });

  it("stays off on a phone", () => {
    mockMedia({ width: 390 });
    renderTree();
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(lenis.ctor).not.toHaveBeenCalled();
  });

  it("stays off on a wide touch screen without hover", () => {
    mockMedia({ width: 1366, hover: false });
    renderTree();
    expect(lenis.ctor).not.toHaveBeenCalled();
  });

  it("stays off under prefers-reduced-motion on desktop", () => {
    mockMedia({ width: 1440, hover: true, reduced: true });
    renderTree();
    expect(lenis.ctor).not.toHaveBeenCalled();
  });

  it("runs Lenis once on desktop, keeps ScrollTrigger in sync and destroys it on unmount", () => {
    mockMedia({ width: 1440, hover: true });
    const { unmount } = renderTree();
    expect(lenis.ctor).toHaveBeenCalledTimes(1);
    expect(lenis.on).toHaveBeenCalledWith("scroll", ScrollTrigger.update);
    expect(lenis.destroy).not.toHaveBeenCalled();
    unmount();
    expect(lenis.destroy).toHaveBeenCalledTimes(1);
  });
});
