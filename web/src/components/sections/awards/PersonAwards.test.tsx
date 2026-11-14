import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { PersonAwards } from "./PersonAwards";

afterEach(() => vi.unstubAllGlobals());

describe("PersonAwards", () => {
  it("lists the awards a person won with value and unit, then the ones where they were a finalist", () => {
    mockReducedMotion(true);
    render(<PersonAwards awards={fx.awards} slug="tomi" />);
    const won = within(screen.getByRole("list", { name: "Premios que ganó" })).getAllByRole("listitem");
    expect(won.map((li) => li.dataset.award)).toEqual(["stickers", "owl", "fastest", "muletilla"]);
    expect(won[0]).toHaveTextContent("Más stickers");
    expect(within(won[0]!).getByTestId("person-award-value")).toHaveTextContent("8");
    expect(won[0]).toHaveTextContent("stickers");
    // The «x» unit reads as in the envelopes, and the muletilla carries its phrase.
    expect(won[3]).toHaveTextContent("veces más que el resto");
    expect(won[3]).toHaveTextContent("«mirá vos»");

    // A won award is never repeated as a finalist mention.
    const finalist = within(screen.getByRole("list", { name: "Finalista" })).getAllByRole("listitem");
    expect(finalist.map((li) => li.dataset.award)).toEqual([
      "msgs", "audios", "badwords", "early", "mentioned", "edited", "deleted",
    ]);
    expect(finalist[0]).toHaveTextContent("finalista en Más mensajes");
    expect(finalist[0]).toHaveTextContent("499 mensajes");
    expect(screen.queryByText("Nada que mostrar todavía.")).not.toBeInTheDocument();
  });

  it("shows only finalist mentions for someone who won nothing", () => {
    mockReducedMotion(true);
    const awards = fx.awards.map((a) => (a.winner?.slug === "ana" ? { ...a, winner: { ...a.winner, slug: "bruno" } } : a));
    render(<PersonAwards awards={awards} slug="ana" />);
    expect(screen.queryByRole("list", { name: "Premios que ganó" })).not.toBeInTheDocument();
    const finalist = within(screen.getByRole("list", { name: "Finalista" })).getAllByRole("listitem");
    expect(finalist.map((li) => li.dataset.award)).toContain("muletilla");
    expect(finalist.find((li) => li.dataset.award === "muletilla")).toHaveTextContent("«sin vueltas»");
  });

  it("shows the empty state for someone who neither won nor was a finalist", () => {
    mockReducedMotion(true);
    render(<PersonAwards awards={fx.awards} slug="pipo" />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
