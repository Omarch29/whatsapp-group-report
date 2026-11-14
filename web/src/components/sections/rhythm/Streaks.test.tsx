import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Streaks } from "./Streaks";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;
const data = [
  ...fx.rhythm.streaks,
  {
    slug: "tomi",
    streak: { days: 30, from: "2023-09-01", to: "2023-09-30" },
    silence: { days: 42, from: "2023-10-01", to: "2023-11-12" },
  },
];

describe("Streaks", () => {
  it("draws streak and silence per person on one days scale, longest streak first, dates in the title", () => {
    mockReducedMotion(true);
    render(<Streaks data={data} people={people} />);
    const rows = within(screen.getByRole("list", { name: "Rachas y silencios por persona" })).getAllByRole("listitem");
    expect(rows.map((r) => r.dataset.slug)).toEqual(["tomi", "bruno"]);
    const tomi = within(rows[0]!);
    expect(tomi.getByTestId("silence-bar").style.width).toBe("100%");
    expect(parseFloat(tomi.getByTestId("streak-bar").style.width)).toBeCloseTo((30 / 42) * 100, 2);
    expect(within(rows[1]!).getByTestId("streak-bar")).toHaveAttribute(
      "title",
      "Bruno · racha: 21 días, del 01/10/2023 al 21/10/2023",
    );
    expect(tomi.getByText("42 días")).toBeInTheDocument();
  });

  it("shows the empty state without rows", () => {
    render(<Streaks data={[]} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
