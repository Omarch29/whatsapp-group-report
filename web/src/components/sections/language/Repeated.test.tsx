import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Repeated } from "./Repeated";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;

describe("Repeated", () => {
  it("shows each original bubble with the repliers stacked under it in their colors", () => {
    mockReducedMotion(true);
    render(<Repeated data={fx.language.repeated} people={people} />);
    expect(screen.getByRole("button", { name: "Bruno" })).toHaveAttribute("aria-pressed", "true");
    const items = within(screen.getByRole("list", { name: "Frases de Bruno que otros repitieron" })).getAllByTestId(
      "repeated",
    );
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item).toHaveTextContent("Q lindo el quincho de Rulo");
    expect(item).toHaveTextContent("× 11 · 3 personas");
    const echoes = within(within(item).getByRole("list", { name: "La repitieron" })).getAllByRole("listitem");
    expect(echoes.map((e) => e.textContent)).toEqual(["Tomi", "Bruno", "Ana"]);
    expect(echoes[1]!.style.getPropertyValue("--c")).toBe("#ff5ca8");
    expect(item).toHaveAttribute("data-seen", "true");
  });

  it("switches person with the chips and shows the empty state for nobody's phrases", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<Repeated data={fx.language.repeated} people={people} />);
    await user.click(screen.getByRole("button", { name: "Tomi" }));
    expect(await screen.findByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });

  it("hides the chips with a fixed person", () => {
    mockReducedMotion(true);
    render(<Repeated data={fx.language.repeated} people={people} person="bruno" />);
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByText("Q lindo el quincho de Rulo")).toBeInTheDocument();
  });
});
