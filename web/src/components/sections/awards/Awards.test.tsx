import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockMedia, mockReducedMotion } from "@/test/motion";
import { Awards, OPEN_STAGGER_MS } from "./Awards";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const { people } = fx.global;
const envelopes = () => screen.getAllByRole("button");

describe("Awards", () => {
  it("renders 12 closed envelopes with the award title and a «?»; tapping one opens it to the winner", async () => {
    mockMedia({ width: 390 });
    const user = userEvent.setup();
    render(<Awards awards={fx.awards} people={people} nicknames={fx.nicknames} />);
    expect(envelopes()).toHaveLength(12);
    const first = envelopes()[0]!;
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(first).toHaveTextContent("Más mensajes");
    expect(first).toHaveTextContent("?");
    const card = first.closest("li")!;
    expect(within(card).queryByText("Bruno")).not.toBeInTheDocument();

    await user.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(within(card).getByText("Bruno")).toBeInTheDocument();
    expect(within(card).getByText("«El Brujo»")).toBeInTheDocument();
    expect(within(card).getByText("Criterio de más mensajes.")).toBeInTheDocument();
    expect(within(card).getByTestId("award-value")).toHaveAttribute("aria-label", "500");
    expect(within(card).getByText("mensajes")).toBeInTheDocument();
    const runners = within(within(card).getByRole("list", { name: "Finalistas" })).getAllByRole("listitem");
    expect(runners.map((r) => r.textContent)).toEqual(["Tomi499 mensajes", "Ana498 mensajes"]);
    // Every other envelope stays closed on a phone.
    expect(envelopes().slice(1).every((b) => b.getAttribute("aria-expanded") === "false")).toBe(true);
  });

  it("opens every envelope under reduced motion", () => {
    mockReducedMotion(true);
    render(<Awards awards={fx.awards} people={people} nicknames={fx.nicknames} />);
    expect(envelopes().every((b) => b.getAttribute("aria-expanded") === "true")).toBe(true);
  });

  it("opens them by themselves on desktop, 300 ms apart", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mockMedia({ width: 1440, hover: true });
    render(<Awards awards={fx.awards} people={people} nicknames={fx.nicknames} />);
    const open = () => envelopes().filter((b) => b.getAttribute("aria-expanded") === "true").length;
    expect(OPEN_STAGGER_MS).toBe(300);
    act(() => vi.advanceTimersByTime(0));
    expect(open()).toBe(1);
    act(() => vi.advanceTimersByTime(300));
    expect(open()).toBe(2);
    act(() => vi.advanceTimersByTime(300 * 10));
    expect(open()).toBe(12);
  });

  it("shows the muletilla in a bubble, finalists' phrases, and «Desierto» for an award nobody won", () => {
    mockReducedMotion(true);
    render(<Awards awards={fx.awards} people={people} nicknames={fx.nicknames} />);
    const muletilla = screen.getByRole("button", { name: /La muletilla del año/ }).closest("li")!;
    expect(within(muletilla).getByText("«mirá vos»")).toBeInTheDocument();
    expect(within(muletilla).getByText("veces más que el resto")).toBeInTheDocument();
    expect(within(muletilla).getByText("«sin vueltas»")).toBeInTheDocument();
    const starters = screen.getByRole("button", { name: /El que más arranca/ }).closest("li")!;
    expect(within(starters).getByText("Desierto")).toBeInTheDocument();
    expect(within(starters).getByText("Criterio de el que más arranca.")).toBeInTheDocument();
    expect(within(starters).queryByRole("list", { name: "Finalistas" })).not.toBeInTheDocument();
  });

  it("closes an open envelope on a second tap", async () => {
    mockMedia({ width: 390 });
    const user = userEvent.setup();
    render(<Awards awards={fx.awards} people={people} nicknames={fx.nicknames} />);
    const first = envelopes()[0]!;
    await user.click(first);
    await user.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
  });
});
