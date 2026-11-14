import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { TOP_SHOWN, TopPolls } from "./TopPolls";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;
const firstQuestion = () =>
  within(screen.getByRole("tabpanel")).getAllByTestId("poll-item")[0]!.querySelector("b")!.textContent;

describe("TopPolls", () => {
  it("switching tabs changes the first question (aria-selected follows)", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<TopPolls data={fx.polls} people={people} />);
    expect(screen.getByRole("tablist", { name: "Ordenar encuestas" })).toBeInTheDocument();
    const [voted, unanimous, divided] = screen.getAllByRole("tab");
    expect(voted).toHaveTextContent("Más votadas");
    expect(voted).toHaveAttribute("aria-selected", "true");
    expect(firstQuestion()).toBe("¿Quién llega tarde?");

    await user.click(unanimous!);
    expect(unanimous).toHaveAttribute("aria-selected", "true");
    expect(voted).toHaveAttribute("aria-selected", "false");
    expect(firstQuestion()).toBe("¿Vamos?");

    await user.click(divided!);
    expect(firstQuestion()).toBe("¿Dónde cenamos?");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", divided!.id);
  });

  it("moves between tabs with the arrow keys", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<TopPolls data={fx.polls} people={people} />);
    const tabs = screen.getAllByRole("tab");
    await user.click(tabs[0]!);
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
  });

  it("names the author and the votes, and says «alguien más» for someone without a profile", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<TopPolls data={fx.polls} people={people} />);
    const item = () => within(screen.getByRole("tabpanel")).getAllByTestId("poll-item")[0]!;
    expect(item()).toHaveTextContent("Bruno, 21/10/2023 · 8 votos");
    await user.click(screen.getByRole("tab", { name: "Más divididas" }));
    expect(item()).toHaveTextContent("alguien más, 21/10/2023 · 8 votos");
    expect(item()).not.toHaveTextContent("Resto");
  });

  it(`shows the first ${TOP_SHOWN} polls of a list, each with its bars`, () => {
    mockReducedMotion(true);
    const many = Array.from({ length: 12 }, (_, i) => ({ ...fx.polls.mostVoted[0]!, question: `P${i}` }));
    render(<TopPolls data={{ ...fx.polls, mostVoted: many }} people={people} />);
    const items = within(screen.getByRole("tabpanel")).getAllByTestId("poll-item");
    expect(items).toHaveLength(TOP_SHOWN);
    expect(within(items[0]!).getAllByTestId("poll-bar")).toHaveLength(3);
  });

  it("shows the empty state for an empty list", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<TopPolls data={{ ...fx.polls, unanimous: [] }} people={people} />);
    await user.click(screen.getByRole("tab", { name: "Más unánimes" }));
    expect(within(screen.getByRole("tabpanel")).getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
