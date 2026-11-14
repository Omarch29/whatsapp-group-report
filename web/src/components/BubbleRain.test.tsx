import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockReducedMotion } from "@/test/motion";
import { BubbleRain } from "./BubbleRain";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BubbleRain", () => {
  it("renders nothing under reduced motion", () => {
    mockReducedMotion(true);
    const { container } = render(<BubbleRain />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a canvas otherwise, and survives a missing 2d context", () => {
    const { container } = render(<BubbleRain />);
    expect(container.querySelector("canvas")).toBeInTheDocument();
  });

  it("animates with requestAnimationFrame and cancels it on unmount", () => {
    const ctx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      globalAlpha: 1,
      fillStyle: "",
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 7);
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const { unmount } = render(<BubbleRain density={5} />);
    expect(raf).toHaveBeenCalled();
    // Run one frame by hand.
    const frame = raf.mock.calls[0][0] as FrameRequestCallback;
    frame(0);
    expect(ctx.fill).toHaveBeenCalledTimes(5);

    unmount();
    expect(cancel).toHaveBeenCalledWith(7);
  });
});
