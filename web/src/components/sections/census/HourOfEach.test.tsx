import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { HourOfEach, ShareRecords } from "./HourOfEach";

afterEach(() => vi.unstubAllGlobals());

describe("HourOfEach", () => {
  it("draws one clock per person labelled with name and hour", () => {
    mockReducedMotion(true);
    const data = fx.census.hourOfEach.map((h) => (h.slug === "tomi" ? { ...h, hour: 23 } : h));
    render(<HourOfEach data={data} people={fx.global.people} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Tomi · 23 h")).toBeInTheDocument();
    expect(screen.getByText("Bruno · 16 h")).toBeInTheDocument();
  });

  it("points each hand at its hour under reduced motion", () => {
    mockReducedMotion(true);
    render(<HourOfEach data={fx.census.hourOfEach} people={fx.global.people} />);
    const hands = screen.getAllByTestId("clock-hand");
    // 24-hour dial: 22 h is 330°.
    expect(hands[1]!.style.transform).toContain("rotate(330deg)");
    expect(hands[1]).toHaveAttribute("data-hour", "22");
  });

  it("shows the empty state", () => {
    render(<HourOfEach data={[]} people={fx.global.people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});

describe("ShareRecords", () => {
  it("shows the earliest bird and the owl with their shares", () => {
    render(<ShareRecords earlyBird={fx.census.earlyBird} owl={fx.census.owl} people={fx.global.people} />);
    expect(screen.getByText("3,2 %")).toBeInTheDocument();
    expect(screen.getByText("7,1 %")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Tomi")).toBeInTheDocument();
  });

  it("renders nothing when both are null", () => {
    const { container } = render(<ShareRecords earlyBird={null} owl={null} people={fx.global.people} />);
    expect(container).toBeEmptyDOMElement();
  });
});
