import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Matrix } from "./Matrix";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;
const samples = [
  { when: "2023-10-13T10:58:43", text: "Che @Bruno, contestá" },
  { when: "2023-10-12T10:00:00", text: "Bruno vení" },
  { when: "2023-10-11T10:00:00", text: "Dale Bruno" },
  { when: "2023-10-10T10:00:00", text: "Cuarto mensaje" },
];
const data = { ...fx.mentions, samples: { "tomi>bruno": samples } };

describe("Matrix", () => {
  it("is a grid of every pair, labelled «X menciona a Y: n», with row and column headers", () => {
    mockReducedMotion(true);
    render(<Matrix data={data} people={people} />);
    const grid = screen.getByRole("grid", { name: "Quién menciona a quién" });
    expect(within(grid).getAllByRole("rowheader").map((h) => h.textContent)).toEqual(["Bruno", "Tomi", "Ana"]);
    const cols = within(grid).getAllByRole("columnheader");
    // The corner is a header too, so each column's header lines up with its cells.
    expect(cols[0]).toHaveAccessibleName("de / a");
    expect(cols.slice(1).map((h) => h.textContent)).toEqual(["Bruno", "Tomi", "Ana"]);
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(9);
    expect(within(grid).getByRole("button", { name: "Tomi menciona a Bruno: 20" })).toBeInTheDocument();
  });

  it("tapping a cell lists up to 3 of its messages below the grid; Escape and Cerrar close it", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<Matrix data={data} people={people} />);
    const panel = screen.getByTestId("mention-panel");
    expect(panel).toHaveAttribute("aria-live", "polite");
    expect(panel).toBeEmptyDOMElement();

    const cell = screen.getByRole("button", { name: "Tomi menciona a Bruno: 20" });
    await user.click(cell);
    expect(cell).toHaveAttribute("aria-pressed", "true");
    expect(panel).toHaveTextContent("Tomi mencionó a Bruno 20 veces");
    const items = within(panel).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Che @Bruno, contestá");
    expect(panel).not.toHaveTextContent("Cuarto mensaje");

    await user.keyboard("{Escape}");
    expect(panel).toBeEmptyDOMElement();

    await user.click(screen.getByRole("button", { name: "Ana menciona a Tomi: 2" }));
    expect(panel).toHaveTextContent("No hay mensajes para mostrar.");
    await user.click(within(panel).getByRole("button", { name: "Cerrar" }));
    expect(panel).toBeEmptyDOMElement();
    // Focus goes back to the cell that opened the panel.
    expect(screen.getByRole("button", { name: "Ana menciona a Tomi: 2" })).toHaveFocus();
  });

  it("returns focus to the cell on Escape, and ignores an Escape from outside the block", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(
      <>
        <button type="button">fuera</button>
        <Matrix data={data} people={people} />
      </>,
    );
    const panel = screen.getByTestId("mention-panel");
    const cell = screen.getByRole("button", { name: "Tomi menciona a Bruno: 20" });
    await user.click(cell);
    screen.getByRole("button", { name: "fuera" }).focus();
    await user.keyboard("{Escape}");
    expect(panel).not.toBeEmptyDOMElement();
    await user.click(cell);
    await user.click(cell);
    await user.keyboard("{Escape}");
    expect(panel).toBeEmptyDOMElement();
    expect(cell).toHaveFocus();
  });

  it("moves between cells with the arrow keys (one tab stop)", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<Matrix data={data} people={people} />);
    const first = screen.getByRole("button", { name: "Bruno menciona a Bruno: 0" });
    expect(first).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("button", { name: "Bruno menciona a Tomi: 5" })).toHaveAttribute("tabindex", "-1");
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Bruno menciona a Tomi: 5" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Tomi menciona a Tomi: 0" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "Tomi menciona a Ana: 4" })).toHaveFocus();
  });

  it("shows one person's row and column as two lists in profile mode", () => {
    mockReducedMotion(true);
    render(<Matrix data={data} people={people} person="tomi" />);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    const to = within(screen.getByRole("list", { name: "A quién menciona Tomi" })).getAllByRole("listitem");
    expect(to.map((r) => r.dataset.slug)).toEqual(["bruno", "ana"]);
    const by = within(screen.getByRole("list", { name: "Quién menciona a Tomi" })).getAllByRole("listitem");
    expect(by.map((r) => r.textContent)).toEqual(["Bruno5", "Ana2"]);
  });

  it("shows the empty state without people", () => {
    render(<Matrix data={{ ...data, slugs: [], matrix: [] }} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
