import { fireEvent, render, screen, within } from "@testing-library/react";
import { copy } from "../../../content/copy";
import { afterEach, describe, expect, it, vi } from "vitest";
import { colorForSlug, FALLBACK_COLOR } from "@/lib/colors";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Dictionary } from "./Dictionary";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;
const sizeOf = (el: HTMLElement) => parseFloat(el.style.fontSize);

describe("Dictionary", () => {
  it("sizes the top term largest and colors by coiner", () => {
    render(<Dictionary terms={fx.lore} people={people} />);
    expect(screen.getByRole("heading", { level: 2, name: "Diccionario" })).toBeInTheDocument();
    const top = screen.getByText(fx.lore[0]!.w);
    const tenth = screen.getByText(fx.lore[9]!.w);
    expect(sizeOf(top)).toBeGreaterThan(sizeOf(tenth));
    expect(sizeOf(top)).toBeCloseTo(58, 1);
    expect(top).toHaveStyle({ color: colorForSlug(fx.lore[0]!.coinedBy, people) });
  });

  it("highlight dims other coiners", () => {
    render(<Dictionary terms={fx.lore} people={people} highlight="bruno" />);
    for (const word of screen.getAllByTestId("term")) {
      if (word.dataset.coiner === "bruno") expect(word).not.toHaveAttribute("data-dim");
      else expect(word).toHaveAttribute("data-dim", "true");
    }
    expect(screen.getAllByTestId("term").some((w) => w.dataset.coiner === "bruno")).toBe(true);
  });

  it("tap opens one detail at a time", () => {
    render(<Dictionary terms={fx.lore} people={people} />);
    const [a, b] = screen.getAllByTestId("term") as [HTMLElement, HTMLElement];
    expect(a).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(a.getAttribute("aria-describedby")!)).toHaveTextContent(
      "Bruno · 100 usos · desde 01/09/2023",
    );
    fireEvent.click(a);
    expect(a).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(b);
    expect(a).toHaveAttribute("aria-expanded", "false");
    expect(b).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByTestId("term").filter((w) => w.getAttribute("aria-expanded") === "true")).toHaveLength(1);
    fireEvent.click(b);
    expect(b).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(a);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(a).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the open detail when tapping outside the cloud", () => {
    render(<Dictionary terms={fx.lore} people={people} />);
    const [a] = screen.getAllByTestId("term") as [HTMLElement];
    fireEvent.click(a);
    fireEvent.pointerDown(a);
    expect(a).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerDown(screen.getByRole("heading", { level: 2, name: "Diccionario" }));
    expect(a).toHaveAttribute("aria-expanded", "false");
  });

  it("unknown coiner falls back to gray and capitalized slug in legend", () => {
    render(<Dictionary terms={fx.lore} people={people} />);
    const pepe = screen.getAllByTestId("term").find((w) => w.dataset.coiner === "pepe")!;
    expect(pepe).toHaveStyle({ color: FALLBACK_COLOR });
    expect(document.getElementById(pepe.getAttribute("aria-describedby")!)).toHaveTextContent(/^Pepe · /);
    const legend = screen.getByRole("list", { name: "Quién acuñó cada palabra" });
    const chips = within(legend).getAllByRole("listitem");
    expect(within(legend).getByText("Pepe acuñó 1")).toBeInTheDocument();
    expect(chips.map((c) => c.textContent)).toEqual([
      "Ana acuñó 3",
      "Bruno acuñó 3",
      "Tomi acuñó 3",
      "Pepe acuñó 1",
    ]);
  });

  it("lists the legend by count, most first", () => {
    render(<Dictionary terms={fx.lore.slice(0, 4)} people={people} />);
    const legend = screen.getByRole("list", { name: "Quién acuñó cada palabra" });
    expect(within(legend).getAllByRole("listitem").map((c) => c.textContent)).toEqual([
      "Bruno acuñó 2",
      "Ana acuñó 1",
      "Tomi acuñó 1",
    ]);
  });

  it("reduced motion renders words visible", () => {
    mockReducedMotion(true);
    render(<Dictionary terms={fx.lore} people={people} />);
    for (const word of screen.getAllByTestId("term")) {
      expect(word.closest("li")).not.toHaveAttribute("data-hidden");
    }
  });
});

describe("Dictionary lede", () => {
  it("lede overrides the group copy", () => {
    render(<Dictionary terms={fx.lore} people={people} lede="Las palabras que acuñó Tomi." />);
    expect(screen.getByText("Las palabras que acuñó Tomi.")).toBeInTheDocument();
    expect(screen.queryByText(copy.dictionary.lede)).not.toBeInTheDocument();
  });
});
