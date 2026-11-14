import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CensusData } from "@/lib/schema";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Tenure } from "./Tenure";

afterEach(() => vi.unstubAllGlobals());

const period = { from: "2023-09-01", to: "2026-11-09" };
const tenure: CensusData["tenure"] = [
  { slug: "ana", from: "2023-09-02", to: "2026-11-09", gaps: [] },
  { slug: "tomi", from: "2023-09-01", to: "2026-11-09", gaps: [{ from: "2026-01-15", to: "2026-02-20", days: 36 }] },
  { slug: "bruno", from: "2023-09-01", to: "2026-11-08", gaps: [{ from: "2023-09-06", to: "2023-09-20", days: 14 }] },
];

describe("Tenure", () => {
  it("renders one bar per person with its span in the title", () => {
    mockReducedMotion(true);
    render(<Tenure tenure={tenure} period={period} people={fx.global.people} />);
    const bars = screen.getAllByTestId("tenure-bar");
    expect(bars).toHaveLength(3);
    expect(screen.getByTitle("Tomi: 1/9/2023 → 9/11/2026")).toBeInTheDocument();
  });

  it("sorts rows by first message and positions bars on the period scale", () => {
    mockReducedMotion(true);
    render(<Tenure tenure={tenure} period={period} people={fx.global.people} />);
    const bars = screen.getAllByTestId("tenure-bar");
    expect(bars.map((b) => b.getAttribute("data-slug"))).toEqual(["tomi", "bruno", "ana"]);
    expect(bars[0]!.style.left).toBe("0%");
    expect(bars[0]!.style.width).toBe("100%");
    expect(parseFloat(bars[2]!.style.left)).toBeGreaterThan(0);
  });

  it("hatches only gaps longer than 30 days", () => {
    mockReducedMotion(true);
    render(<Tenure tenure={tenure} period={period} people={fx.global.people} />);
    const gaps = screen.getAllByTestId("tenure-gap");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toHaveAttribute("title", "Sin escribir: 15/1/2026 → 20/2/2026 (36 días)");
  });

  it("names the hatched gaps in the bar's accessible label", () => {
    mockReducedMotion(true);
    render(<Tenure tenure={tenure} period={period} people={fx.global.people} />);
    expect(
      screen.getByRole("img", { name: "Tomi: 1/9/2023 → 9/11/2026; sin escribir del 15/1/2026 al 20/2/2026, 36 días" }),
    ).toBeInTheDocument();
    // Gaps under the threshold are not drawn, so they are not announced either.
    expect(screen.getByRole("img", { name: "Bruno: 1/9/2023 → 8/11/2026" })).toBeInTheDocument();
  });

  it("shows the bars grown under reduced motion", () => {
    mockReducedMotion(true);
    render(<Tenure tenure={tenure} period={period} people={fx.global.people} />);
    expect(screen.getByRole("list", { name: "Quién está desde cuándo" })).toHaveAttribute("data-seen", "true");
  });

  it("shows the empty state", () => {
    render(<Tenure tenure={[]} period={period} people={fx.global.people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
