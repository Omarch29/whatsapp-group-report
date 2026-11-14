import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Style, StyleRecord } from "./Style";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;

describe("Style", () => {
  it("deals one character card per person with six mini bars scaled to the group max", () => {
    mockReducedMotion(true);
    render(<Style data={fx.language.style} people={people} />);
    const cards = within(screen.getByRole("list", { name: "Cartas de personaje" })).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute("data-seen", "true");
    const bruno = within(cards[0]!);
    expect(bruno.getByRole("heading", { name: "Bruno" })).toBeInTheDocument();
    expect(bruno.getAllByTestId("metric")).toHaveLength(6);
    expect(cards[0]).toHaveTextContent("Caracteres por mensaje27,6");
    expect(cards[0]).toHaveTextContent("En mayúsculas3 %");
    expect(cards[0]).toHaveTextContent("Exclamaciones16 ‰");

    const tomi = within(cards[1]!);
    const avg = tomi.getAllByTestId("metric")[0]!;
    expect(parseFloat(within(avg).getByTestId("mini-bar").style.width)).toBeCloseTo((18.7 / 27.6) * 100, 2);
    // Tomi leads mayúsculas and preguntas: marked as the group's top.
    const tops = tomi.getAllByTestId("metric").filter((m) => m.dataset.top === "true");
    expect(tops.map((m) => m.dataset.metric)).toEqual(["upperShare", "questPerMil"]);
    // The card's trait: the first metric where they top the group.
    expect(cards[1]).toHaveTextContent("Grita más que nadie");
    expect(cards[0]).toHaveTextContent("Escribe más largo que nadie");
  });

  it("shows the empty state without data", () => {
    render(<Style data={[]} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});

describe("StyleRecord", () => {
  it("shows the longest message: its length, who and when, and the text clipped in a bubble", () => {
    mockReducedMotion(true);
    const text = "palabra ".repeat(60).trim();
    render(
      <StyleRecord record={{ who: "tomi", when: "2023-10-01T10:00:00", text }} value={text.length} people={people} />,
    );
    expect(screen.getByText("El mensaje más largo")).toBeInTheDocument();
    expect(screen.getByTestId("record-value")).toHaveAttribute("aria-label", "479");
    expect(screen.getByText("caracteres")).toBeInTheDocument();
    expect(screen.getByText("Tomi, 01/10/2023")).toBeInTheDocument();
    const bubble = screen.getByText(/^palabra palabra/);
    expect(bubble.textContent!.length).toBeLessThanOrEqual(300);
    expect(bubble.textContent!.endsWith("…")).toBe(true);
  });
});
