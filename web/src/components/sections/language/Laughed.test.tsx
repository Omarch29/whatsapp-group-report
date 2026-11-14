import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Laughed, MAX_LAUGH_BUBBLES } from "./Laughed";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;

describe("Laughed", () => {
  it("shows the person's bubble with one laugh bubble per laugh and the count", () => {
    mockReducedMotion(true);
    render(<Laughed data={fx.language.laughed} people={people} />);
    expect(screen.getByText("Gol en contra")).toBeInTheDocument();
    expect(screen.getAllByTestId("laugh")).toHaveLength(11);
    expect(screen.getByText("11 risas de 3 personas")).toBeInTheDocument();
    expect(screen.getByText("08/10/2023")).toBeInTheDocument();
  });

  it("swaps with the chips; null shows the empty state", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<Laughed data={fx.language.laughed} people={people} />);
    await user.click(screen.getByRole("button", { name: "Ana" }));
    expect(await screen.findByText("Qué decís")).toBeInTheDocument();
    expect(screen.getAllByTestId("laugh")).toHaveLength(7);
    await user.click(screen.getByRole("button", { name: "Tomi" }));
    expect(await screen.findByText("Nada que mostrar todavía.")).toBeInTheDocument();
    expect(screen.queryAllByTestId("laugh")).toHaveLength(0);
  });

  it("caps the laugh bubbles but keeps the real count", () => {
    mockReducedMotion(true);
    const data = { bruno: { ...fx.language.laughed.bruno!, laughs: 30, people: 9 } };
    render(<Laughed data={data} people={people} person="bruno" />);
    expect(screen.getAllByTestId("laugh")).toHaveLength(MAX_LAUGH_BUBBLES);
    expect(screen.getByText("30 risas de 9 personas")).toBeInTheDocument();
    expect(screen.queryByRole("group")).toBeNull();
  });
});
