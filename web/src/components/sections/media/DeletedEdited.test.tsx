import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { gsap } from "gsap";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { DeletedEdited } from "./DeletedEdited";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
});

const people = fx.global.people;
const rows = () =>
  within(screen.getByRole("list", { name: "Borrados y editados por persona" })).getAllByRole("listitem");
const setHidden = (hidden: boolean) =>
  act(() => {
    Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });

describe("DeletedEdited", () => {
  it("starts on per mil (the lede's measure) with two bars per person, and toggles to total", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<DeletedEdited data={fx.media.deletedEdited} people={people} />);
    expect(screen.getByRole("button", { name: "Por mil" })).toHaveAttribute("aria-pressed", "true");
    expect(rows().map((r) => r.dataset.slug)).toEqual(["bruno", "tomi"]);
    const [del, ed] = within(rows()[0]!).getAllByTestId("series-bar");
    expect(del).toHaveAttribute("title", "Bruno · borrados: 10 ‰");
    expect(ed).toHaveAttribute("title", "Bruno · editados: 24 ‰");

    await user.click(screen.getByRole("button", { name: "Total" }));
    const [del2, ed2] = within(rows()[0]!).getAllByTestId("series-bar");
    expect(del2).toHaveAttribute("title", "Bruno · borrados: 5");
    // Both series share one scale: Bruno's 12 edits are the longest bar.
    expect(ed2!.style.width).toBe("100%");
    expect(parseFloat(del2!.style.width)).toBeCloseTo((5 / 12) * 100, 2);
  });

  it("shows the «Se eliminó este mensaje» bubbles still under reduced motion, with no loop", () => {
    mockReducedMotion(true);
    const timeline = vi.spyOn(gsap, "timeline");
    const { container } = render(<DeletedEdited data={fx.media.deletedEdited} people={people} />);
    const loop = container.querySelector("[data-loop]")!;
    expect(loop).toHaveAttribute("aria-hidden", "true");
    expect(loop).toHaveAttribute("data-static");
    expect(within(loop as HTMLElement).getAllByText("Se eliminó este mensaje").length).toBeGreaterThan(1);
    expect(timeline).not.toHaveBeenCalled();
  });

  it("loops the bubbles with motion on, paused while the tab is hidden", () => {
    mockReducedMotion(false);
    const timeline = vi.spyOn(gsap, "timeline");
    render(<DeletedEdited data={fx.media.deletedEdited} people={people} />);
    expect(timeline).toHaveBeenCalledWith(expect.objectContaining({ repeat: -1 }));
    const tl = timeline.mock.results[0]!.value as gsap.core.Timeline;
    expect(tl.paused()).toBe(false);
    setHidden(true);
    expect(tl.paused()).toBe(true);
    setHidden(false);
    expect(tl.paused()).toBe(false);
  });

  it("shows the empty state without people", () => {
    render(<DeletedEdited data={{ byPerson: [], recordDay: null }} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
