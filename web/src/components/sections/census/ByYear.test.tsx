import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fmt } from "@/lib/format";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { ByYear, perMilSeries } from "./ByYear";

afterEach(() => vi.unstubAllGlobals());

describe("perMilSeries", () => {
  it("divides each year by that person's total across years, times 1000", () => {
    const pm = perMilSeries({ bruno: [500, 0], tomi: [300, 10], nadie: [0, 0] });
    expect(pm.bruno).toEqual([1000, 0]);
    expect(pm.tomi?.[0]).toBeCloseTo((300 / 310) * 1000);
    expect(pm.nadie).toEqual([0, 0]);
  });
});

describe("ByYear", () => {
  it("toggles between total and per mil with aria-pressed; per mil drops the bar totals", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<ByYear data={fx.census.byYear} people={fx.global.people} />);
    const total = screen.getByRole("button", { name: "Total" });
    const perMil = screen.getByRole("button", { name: "Por mil" });
    expect(total).toHaveAttribute("aria-pressed", "true");
    expect(perMil).toHaveAttribute("aria-pressed", "false");
    const first = () => screen.getAllByTestId("year-bar")[0]!;
    const firstSeg = () => within(first()).getAllByTestId("year-seg")[0]!;
    expect(within(first()).getByTestId("year-total")).toHaveTextContent(fmt(950));
    expect(firstSeg()).toHaveAttribute("title", "Bruno · 2023: 500");

    await user.click(perMil);
    expect(perMil).toHaveAttribute("aria-pressed", "true");
    expect(total).toHaveAttribute("aria-pressed", "false");
    // Bruno wrote all 500 of his messages in 2023: 1.000 per mil.
    expect(firstSeg()).toHaveAttribute("title", "Bruno · 2023: 1.000 ‰");
    expect(screen.queryAllByTestId("year-total")).toHaveLength(0);

    await user.click(total);
    expect(within(first()).getByTestId("year-total")).toHaveTextContent(fmt(950));
  });

  it("stacks people in global order with their colors and leaves resto out", () => {
    mockReducedMotion(true);
    render(<ByYear data={fx.census.byYear} people={fx.global.people} />);
    const segs = within(screen.getAllByTestId("year-bar")[0]!).getAllByTestId("year-seg");
    expect(segs.map((s) => s.getAttribute("data-slug"))).toEqual(["bruno", "tomi", "ana"]);
    expect(segs[0]).toHaveAttribute("title", "Bruno · 2023: 500");
    expect(segs[0]!.style.backgroundColor).toBe("rgb(255, 92, 168)");
    expect(screen.queryByText("Resto")).toBeNull();
    expect(screen.getByRole("list", { name: "Quién es quién" })).toBeInTheDocument();
  });

  it("shows the bars risen under reduced motion", () => {
    mockReducedMotion(true);
    render(<ByYear data={fx.census.byYear} people={fx.global.people} />);
    expect(screen.getByRole("list", { name: "Mensajes por año" })).toHaveAttribute("data-seen", "true");
  });

  it("shows the empty state without years", () => {
    render(<ByYear data={{ years: [], series: {} }} people={fx.global.people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
