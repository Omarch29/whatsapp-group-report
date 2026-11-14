import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { ByPerson } from "./ByPerson";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;
const rows = () => within(screen.getByRole("list", { name: "Encuestas por persona" })).getAllByRole("listitem");

describe("polls ByPerson", () => {
  it("draws a bar per creator, most polls first", () => {
    mockReducedMotion(true);
    render(<ByPerson data={fx.polls} people={people} />);
    expect(rows().map((r) => r.dataset.slug)).toEqual(["bruno", "tomi"]);
    expect(rows()[0]).toHaveTextContent("7");
  });

  it("renders only the person's row in profile mode", () => {
    mockReducedMotion(true);
    render(<ByPerson data={fx.polls} people={people} person="tomi" />);
    expect(rows().map((r) => r.dataset.slug)).toEqual(["tomi"]);
  });

  it("shows the empty state for a person without polls in profile mode", () => {
    render(<ByPerson data={fx.polls} people={people} person="ana" />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
