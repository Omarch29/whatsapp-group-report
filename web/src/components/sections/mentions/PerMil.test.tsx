import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { PerMil } from "./PerMil";

afterEach(() => vi.unstubAllGlobals());

describe("PerMil", () => {
  it("ranks mentions per thousand messages, desc", () => {
    mockReducedMotion(true);
    const data = [{ slug: "tomi", n: 7, perMil: 26.9 }, { slug: "bruno", n: 28, perMil: 56 }];
    render(<PerMil data={data} people={fx.global.people} />);
    const rows = within(screen.getByRole("list", { name: "Menciones cada mil mensajes" })).getAllByRole("listitem");
    expect(rows.map((r) => r.dataset.slug)).toEqual(["bruno", "tomi"]);
    expect(rows[1]).toHaveAttribute("title", "Tomi: 26,9 por mil (7 menciones)");
    expect(rows[0]).toHaveTextContent("56 ‰");
  });

  it("shows the empty state without rows", () => {
    render(<PerMil data={[]} people={fx.global.people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
