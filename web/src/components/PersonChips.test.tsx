import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FALLBACK_COLOR, PALETTE } from "@/lib/colors";
import { fx } from "@/test/fixtures";
import { ALL_PEOPLE, PersonChips } from "./PersonChips";

const people = fx.global.people.filter((p) => p.slug !== "resto");

describe("PersonChips", () => {
  it("renders one pressed-state chip per person with their color dot, and reports clicks", async () => {
    const onChange = vi.fn();
    render(<PersonChips people={people} value="tomi" onChange={onChange} label="Elegí a alguien" />);
    const group = screen.getByRole("group", { name: "Elegí a alguien" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Tomi" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ana" })).toHaveAttribute("aria-pressed", "false");
    const dot = screen.getByRole("button", { name: "Bruno" }).querySelector("[data-dot]") as HTMLElement;
    expect(dot.style.backgroundColor).toBe("rgb(255, 92, 168)");
    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    expect(onChange).toHaveBeenCalledWith("ana");
  });

  it("adds an 'all' chip first when allLabel is given", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PersonChips people={people} value={ALL_PEOPLE} onChange={onChange} allLabel="Grupo" />,
    );
    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(4);
    expect(chips[0]).toHaveAccessibleName("Grupo");
    expect(chips[0]).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Tomi" }));
    rerender(<PersonChips people={people} value="tomi" onChange={onChange} allLabel="Grupo" />);
    await userEvent.click(chips[0]!);
    expect(onChange.mock.calls).toEqual([["tomi"], [ALL_PEOPLE]]);
  });

  it("does not report a click on the chip that is already pressed", async () => {
    const onChange = vi.fn();
    render(<PersonChips people={people} value="tomi" onChange={onChange} allLabel="Grupo" />);
    await userEvent.click(screen.getByRole("button", { name: "Tomi" }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Grupo" }));
    expect(onChange).toHaveBeenCalledWith(ALL_PEOPLE);
  });

  it("paints the first twelve people in twelve different palette colours and the 13th onwards grey", () => {
    const cast = Array.from({ length: 14 }, (_, i) => ({ slug: `p${i}`, name: `Persona ${i}`, colorIndex: i }));
    render(<PersonChips people={cast} value="p0" onChange={() => {}} />);
    const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
    const colors = cast.map(
      (p) => (screen.getByRole("button", { name: p.name }).querySelector("[data-dot]") as HTMLElement).style.backgroundColor,
    );
    expect(new Set(colors.slice(0, 12)).size).toBe(12);
    expect(colors.slice(0, 12)).toEqual(PALETTE.map(rgb));
    expect(colors.slice(12)).toEqual([rgb(FALLBACK_COLOR), rgb(FALLBACK_COLOR)]);
  });
});
