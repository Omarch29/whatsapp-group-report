import { fireEvent, render, screen } from "@testing-library/react";
import { copy } from "../../../content/copy";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Events } from "./Events";

afterEach(() => vi.unstubAllGlobals());

describe("Events", () => {
  it("limits the rail and offers the rest", () => {
    render(<Events events={fx.events22} limit={20} />);
    expect(screen.getByRole("heading", { level: 2, name: "Eventos y sagas" })).toBeInTheDocument();
    expect(screen.getAllByTestId("event-card")).toHaveLength(20);
    expect(screen.getByText("Ver los otros 2")).toBeInTheDocument();
  });

  it("reveals the remaining events as a compact list", () => {
    render(<Events events={fx.events22} limit={20} />);
    const button = screen.getByRole("button", { name: "Ver los otros 2" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("listitem").filter((li) => li.closest("[data-extra]"));
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(fx.events22[20]!.title);
    expect(items[0]).toHaveTextContent("días");
  });

  it("has no button when everything fits", () => {
    render(<Events events={fx.events} />);
    expect(screen.getAllByTestId("event-card")).toHaveLength(3);
    expect(screen.queryByText(/Ver los otros/)).not.toBeInTheDocument();
  });

  it("filters by protagonist", () => {
    render(<Events events={fx.events} filterSlug="bruno" />);
    expect(screen.getAllByTestId("event-card")).toHaveLength(2);
    expect(screen.queryByText("El asado bajo la lluvia")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", () => {
    render(<Events events={fx.events} filterSlug="nadie" />);
    expect(screen.getByRole("heading", { level: 2, name: "Eventos y sagas" })).toBeInTheDocument();
    expect(screen.getByText("Lo que pasó una vez y se sigue nombrando.")).toBeInTheDocument();
    expect(screen.getByText("Nada que contar todavía.")).toBeInTheDocument();
    expect(screen.queryByTestId("event-card")).not.toBeInTheDocument();
  });

  it("reduced motion renders cards visible", () => {
    mockReducedMotion(true);
    render(<Events events={fx.events} />);
    for (const li of screen.getAllByTestId("event-card").map((c) => c.closest("li")!)) {
      expect(li).not.toHaveAttribute("data-hidden");
    }
  });
});

describe("Events lede", () => {
  it("lede overrides the group copy", () => {
    render(<Events events={fx.events} lede="Los eventos donde Tomi fue protagonista." />);
    expect(screen.getByText("Los eventos donde Tomi fue protagonista.")).toBeInTheDocument();
    expect(screen.queryByText(copy.events.lede)).not.toBeInTheDocument();
  });
});
