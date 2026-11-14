import { render, screen, waitFor } from "@testing-library/react";
import { gsap } from "gsap";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockReducedMotion } from "@/test/motion";
import { Ticker } from "../Ticker";
import { Hero } from "./Hero";

// The sequence takes ~5 s; run it 8x faster (GSAP timeline and Motion counter) so the
// suite stays quick while still exercising the real timeline and ticker.
const SPEED = 8;
vi.mock("motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion")>();
  return {
    ...actual,
    animate: ((from: number, to: number, opts: { duration?: number }) =>
      actual.animate(from, to, { ...opts, duration: (opts.duration ?? 1) / SPEED })) as typeof actual.animate,
  };
});

const BUBBLES = ["Hablaron.", "Contamos.", "Todo."];
const digits = (el: HTMLElement) => el.textContent?.replace(/\D/g, "");

beforeEach(() => {
  gsap.globalTimeline.timeScale(SPEED);
});
afterEach(() => {
  gsap.globalTimeline.timeScale(1);
  vi.unstubAllGlobals();
});

describe("Hero", () => {
  describe("with motion", () => {
    it("shows bubbles then the total", async () => {
      render(<Hero total={5127} daysActive={1157} bubbles={BUBBLES} />);
      expect(screen.getByText("Hablaron.")).toBeInTheDocument();
      // Typing indicator holds the third slot until its text lands.
      expect(screen.getByTestId("typing")).toBeInTheDocument();
      expect(screen.queryByText("Todo.")).not.toBeInTheDocument();
      expect(digits(screen.getByTestId("total"))).toBe("0");

      await waitFor(() => expect(digits(screen.getByTestId("total"))).toBe("5127"), { timeout: 5000 });
      expect(screen.getByText("Todo.")).toBeInTheDocument();
      expect(screen.queryByTestId("typing")).not.toBeInTheDocument();
      expect(screen.getByTestId("total")).toHaveTextContent("5.127");
      expect(screen.getByText("5.127 mensajes en 1.157 días.")).toBeInTheDocument();
    });

    it("kills its timeline on unmount", () => {
      const { unmount } = render(<Hero total={500} daysActive={9} bubbles={BUBBLES} />);
      expect(gsap.globalTimeline.getChildren(false, true, true).length).toBeGreaterThan(0);
      unmount();
      expect(gsap.globalTimeline.getChildren(false, true, true)).toHaveLength(0);
    });
  });

  describe("under reduced motion", () => {
    beforeEach(() => {
      mockReducedMotion(true);
    });

    it("shows every bubble and the final total at once, without a typing indicator", () => {
      render(<Hero total={5127} daysActive={1157} bubbles={BUBBLES} />);
      for (const b of BUBBLES) expect(screen.getByText(b)).toBeInTheDocument();
      expect(screen.queryByTestId("typing")).not.toBeInTheDocument();
      expect(screen.getByTestId("total")).toHaveTextContent("5.127");
    });

    it("uses the person's name and nick when given", () => {
      render(
        <Hero total={42000} daysActive={500} bubbles={BUBBLES} person={{ name: "Tomi", nick: "Tomate" }} />,
      );
      expect(screen.queryByText("Todo.")).not.toBeInTheDocument();
      expect(screen.getByText("Tomi")).toBeInTheDocument();
      expect(screen.getByText("Tomate")).toBeInTheDocument();
      expect(screen.getByTestId("total")).toHaveTextContent("42.000");
    });

    it("omits the nick line when there is none", () => {
      render(<Hero total={42000} daysActive={500} bubbles={BUBBLES} person={{ name: "Tomi" }} />);
      expect(screen.getByText("Tomi")).toBeInTheDocument();
    });
  });
});

describe("Ticker", () => {
  it("renders final value immediately under reduced motion", () => {
    mockReducedMotion(true);
    render(<Ticker value={280} />);
    expect(screen.getByText("280")).toBeInTheDocument();
  });

  it("wraps every thousands separator in a .sep <b>", () => {
    mockReducedMotion(true);
    const { container } = render(<Ticker value={1234567} testId="t" />);
    expect(screen.getByTestId("t")).toHaveTextContent("1.234.567");
    const seps = container.querySelectorAll("b.sep");
    expect(seps).toHaveLength(2);
    seps.forEach((b) => expect(b).toHaveTextContent("."));
  });

  it("counts up from zero to the value", async () => {
    render(<Ticker value={1000} duration={0.4} testId="t" />);
    expect(digits(screen.getByTestId("t"))).toBe("0");
    await waitFor(() => expect(Number(digits(screen.getByTestId("t")))).toBeGreaterThan(0));
    await waitFor(() => expect(digits(screen.getByTestId("t"))).toBe("1000"));
  });
});
