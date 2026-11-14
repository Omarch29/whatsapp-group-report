import { act, render, screen, waitFor, within } from "@testing-library/react";
import { gsap } from "gsap";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fmt } from "@/lib/format";
import type { DeparturesData } from "@/lib/schema";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Door, swingTimes } from "../Door";
import { Departures } from "./Departures";

// The sequences take ~5 s; run them 8x faster (GSAP and the Motion counter).
const SPEED = 8;
vi.mock("motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion")>();
  return {
    ...actual,
    animate: ((from: number, to: number, opts: { duration?: number }) =>
      actual.animate(from, to, { ...opts, duration: (opts.duration ?? 1) / SPEED })) as typeof actual.animate,
  };
});

const departer = fx.global.people.find((p) => p.slug === "bruno")!;
const view = (data: DeparturesData = fx.departures) => (
  <Departures data={data} facts={fx.facts} name={departer.name} polls={departer.polls} people={fx.global.people} />
);

beforeEach(() => {
  gsap.globalTimeline.timeScale(SPEED);
});
afterEach(() => {
  gsap.globalTimeline.timeScale(1);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Departures", () => {
  it("shows reentries and chips", async () => {
    render(view());
    expect(screen.getByRole("heading", { level: 2, name: "Las salidas" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("reentries").textContent).toBe(fmt(fx.departures.reentries)), {
      timeout: 5000,
    });
    expect(screen.getByText(/menos de 10 minutos/)).toBeInTheDocument();
    expect(screen.getByText("3,2 h")).toBeInTheDocument();
    expect(screen.getByText(String(departer.polls))).toBeInTheDocument();
    expect(screen.getByText("El pico rosa: octubre de 2023, 7.")).toBeInTheDocument();
  });

  it("names the departer in the lede, the complaint chip and the attributed quotes", () => {
    render(view());
    expect(screen.getByText(`Bruno se fue y volvió ${fmt(fx.departures.reentries)} veces.`)).toBeInTheDocument();
    expect(screen.getByText('veces escribió "No me invitó"')).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Lo que le atribuyen a Bruno" })).toBeInTheDocument();
  });

  it("renders top repeated quotes as bubbles", () => {
    render(view());
    expect(screen.getAllByTestId("quote")).toHaveLength(Math.min(8, fx.departures.quotesRepeated.length));
    expect(screen.getAllByTestId("quote-attributed")).toHaveLength(1);
  });

  it("complaint chip shows the pipeline's count under the language's own label, not a sum of complaint texts", () => {
    const data: DeparturesData = {
      ...fx.departures,
      complaintCount: 60,
      complaintLabel: 'times wrote "didn\'t invite me"',
      complaints: [{ text: "me dejaron afuera", n: 54 }, { text: "me sacaron", n: 99 }],
    };
    render(view(data));
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText('times wrote "didn\'t invite me"')).toBeInTheDocument();
    expect(screen.queryByText("99")).not.toBeInTheDocument();
    expect(screen.queryByText(/No me invitó/)).not.toBeInTheDocument();
  });

  it("draws one bar per month and marks the caption's peak months in ribbon", () => {
    const data: DeparturesData = {
      ...fx.departures,
      byMonth: [{ month: "2024-05", n: 20 }, { month: "2024-06", n: 3 }, { month: "2024-07", n: 25 }],
    };
    const facts = { ...fx.facts, departerPeakMonths: [{ month: "2024-05", n: 20 }] };
    render(<Departures data={data} facts={facts} name={departer.name} polls={departer.polls} people={fx.global.people} />);
    expect(screen.getByTitle("2024-05: 20")).toHaveAttribute("data-peak");
    // Higher but not in facts: bars follow the caption, never their own threshold.
    expect(screen.getByTitle("2024-07: 25")).not.toHaveAttribute("data-peak");
    expect(screen.getByTitle("2024-06: 3")).not.toHaveAttribute("data-peak");
  });

  it("plays the door and the bars when their own column scrolls in, not with the counter", async () => {
    const observed: Array<{ el: Element; cb: IntersectionObserverCallback }> = [];
    class IO {
      constructor(private cb: IntersectionObserverCallback) {}
      observe(el: Element) {
        observed.push({ el, cb: this.cb });
      }
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", IO);
    const to = vi.spyOn(gsap, "to");
    const timeline = vi.spyOn(gsap, "timeline");
    render(view());
    const fire = (el: Element) =>
      act(() => {
        for (const o of observed.filter((x) => x.el === el)) {
          o.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], {} as IntersectionObserver);
        }
      });
    // The door's column (.right) sits inside the pinned top block (.top).
    const right = screen.getByTestId("door").parentElement!;
    const top = right.parentElement!;
    expect(observed.map((o) => o.el)).toEqual(expect.arrayContaining([top, right]));

    fire(top);
    expect(to.mock.calls.some(([target]) => target === "[data-bar]")).toBe(false);
    expect(timeline).not.toHaveBeenCalled();

    fire(right);
    expect(to.mock.calls.some(([target]) => target === "[data-bar]")).toBe(true);
    await waitFor(() => expect(timeline).toHaveBeenCalled());
  });

  it("kills its timelines on unmount", () => {
    const { unmount } = render(view());
    expect(gsap.globalTimeline.getChildren(false, true, true).length).toBeGreaterThan(0);
    unmount();
    expect(gsap.globalTimeline.getChildren(false, true, true)).toHaveLength(0);
  });

  describe("under reduced motion", () => {
    beforeEach(() => {
      mockReducedMotion(true);
    });

    it("shows the final state: counter done, bars static, door untouched", () => {
      const timeline = vi.spyOn(gsap, "timeline");
      render(view());
      expect(screen.getByTestId("reentries")).toHaveTextContent(fmt(fx.departures.reentries));
      const bars = screen.getByRole("img", { name: "Reingresos por mes" });
      expect(bars).toHaveAttribute("data-static");
      for (const bar of within(bars).getAllByTitle(/^\d{4}-\d{2}: \d+$/)) {
        expect(bar.style.transform).toBe("");
      }
      expect(screen.getByTestId("door-leaf").style.transform).toBe("");
      expect(timeline).not.toHaveBeenCalled();
    });
  });
});

describe("Door", () => {
  it("no-ops when play is false", () => {
    const timeline = vi.spyOn(gsap, "timeline");
    render(<Door swings={26} duration={4.3} play={false} />);
    expect(timeline).not.toHaveBeenCalled();
    expect(screen.getByTestId("door")).toBeInTheDocument();
    expect(screen.getByTestId("door-leaf").style.transform).toBe("");
  });

  it("swings the leaf when play turns true, and no-ops under reduced motion", async () => {
    const { rerender, unmount } = render(<Door swings={4} duration={1} play={false} />);
    rerender(<Door swings={4} duration={1} play />);
    await waitFor(() => expect(screen.getByTestId("door-leaf").style.transform).not.toBe(""));
    unmount();
    expect(gsap.globalTimeline.getChildren(false, true, true)).toHaveLength(0);

    mockReducedMotion(true);
    const timeline = vi.spyOn(gsap, "timeline");
    render(<Door swings={4} duration={1} play />);
    expect(timeline).not.toHaveBeenCalled();
  });

  it("accelerates: each swing is shorter than the one before and they fill the duration", () => {
    const t = swingTimes(26, 4.3);
    expect(t).toHaveLength(27);
    expect(t[0]).toBe(0);
    expect(t[26]).toBeCloseTo(4.3, 10);
    const gaps = t.slice(1).map((v, i) => v - t[i]!);
    gaps.slice(1).forEach((g, i) => expect(g).toBeLessThan(gaps[i]!));
  });
});
