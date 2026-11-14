import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./motion";
import { useOnce } from "./useOnce";

vi.mock("./motion", () => ({ useReducedMotion: vi.fn(() => false) }));

type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
const observers: { cb: IOCallback; opts?: IntersectionObserverInit; disconnect: ReturnType<typeof vi.fn> }[] = [];

class FakeIO {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
  constructor(cb: IOCallback, opts?: IntersectionObserverInit) {
    observers.push({ cb, opts, disconnect: this.disconnect });
  }
}

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useOnce(ref);
  return <div ref={ref}>{seen ? "visto" : "oculto"}</div>;
}

describe("useOnce", () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal("IntersectionObserver", FakeIO);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

  it("flips true on the first intersection and disconnects", () => {
    render(<Probe />);
    expect(screen.getByText("oculto")).toBeInTheDocument();
    expect(observers[0].opts?.threshold).toBe(0.35);
    act(() => observers[0].cb([{ isIntersecting: false }]));
    expect(screen.getByText("oculto")).toBeInTheDocument();
    act(() => observers[0].cb([{ isIntersecting: true }]));
    expect(screen.getByText("visto")).toBeInTheDocument();
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it("is true immediately under reduced motion, without observing", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<Probe />);
    expect(screen.getByText("visto")).toBeInTheDocument();
    expect(observers).toHaveLength(0);
  });

  it("is true without IntersectionObserver, so content never stays hidden", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getByText("visto")).toBeInTheDocument();
  });

  it("hydrates without a mismatch under reduced motion, then shows the final state", async () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = renderToString(<Probe />);
    expect(html).toContain("oculto");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    await act(async () => {
      hydrateRoot(container, <Probe />);
    });
    expect(container.textContent).toBe("visto");
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    container.remove();
  });

  it("hydrates without IntersectionObserver without throwing, then shows the final state", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = renderToString(<Probe />);
    expect(html).toContain("oculto");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError: (e) => console.error(e) });
    });
    expect(container.textContent).toBe("visto");
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    container.remove();
  });
});
