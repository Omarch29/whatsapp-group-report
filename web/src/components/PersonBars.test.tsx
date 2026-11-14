import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { stubSilentIO } from "@/test/io";
import { mockReducedMotion } from "@/test/motion";
import { ModeToggle, type Mode } from "./ModeToggle";
import { PersonBars } from "./PersonBars";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;

describe("PersonBars", () => {
  it("draws one row per person in the given order, bars relative to the largest, grown under reduced motion", () => {
    mockReducedMotion(true);
    render(
      <PersonBars
        label="Barras"
        people={people}
        rows={[
          { slug: "bruno", value: 40, display: "40" },
          { slug: "tomi", value: 10, display: "10", title: "Tomi: 10" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Barras" });
    expect(list).toHaveAttribute("data-seen", "true");
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((r) => r.dataset.slug)).toEqual(["bruno", "tomi"]);
    expect(rows[0]).toHaveTextContent("Bruno");
    expect(within(rows[1]!).getByTestId("bar").style.width).toBe("25%");
    expect(rows[1]).toHaveAttribute("title", "Tomi: 10");
  });

  it("starts with the bars collapsed when motion is on and nothing was seen", () => {
    mockReducedMotion(false);
    stubSilentIO();
    render(<PersonBars label="Barras" people={people} rows={[{ slug: "tomi", value: 1, display: "1" }]} />);
    expect(screen.getByRole("list", { name: "Barras" })).toHaveAttribute("data-seen", "false");
  });
});

describe("ModeToggle", () => {
  it("presses one of Total / Por mil", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [mode, setMode] = useState<Mode>("total");
      return <ModeToggle value={mode} onChange={setMode} />;
    }
    render(<Harness />);
    const perMil = screen.getByRole("button", { name: "Por mil" });
    expect(screen.getByRole("button", { name: "Total" })).toHaveAttribute("aria-pressed", "true");
    await user.click(perMil);
    expect(perMil).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: "Medida" })).toBeInTheDocument();
  });
});
