import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { DOMAINS_SHOWN, Links } from "./Links";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;
const domainRows = () =>
  within(screen.getByRole("list", { name: "Dominios más compartidos" })).getAllByRole("listitem");

describe("Links", () => {
  it("shows the domain rows sorted desc, each with an initial-letter circle (no favicons)", () => {
    mockReducedMotion(true);
    const data = {
      ...fx.media.links,
      domains: [
        { domain: "instagram.com", n: 5 },
        { domain: "youtube.com", n: 8 },
        { domain: "tiktok.com", n: 2 },
      ],
    };
    const { container } = render(<Links data={data} people={people} />);
    const rows = domainRows();
    expect(rows.map((r) => r.dataset.domain)).toEqual(["youtube.com", "instagram.com", "tiktok.com"]);
    expect(within(rows[0]!).getByTestId("initial")).toHaveTextContent("Y");
    expect(rows[0]).toHaveTextContent("youtube.com");
    expect(rows[0]).toHaveTextContent("8");
    expect(within(rows[1]!).getByTestId("domain-bar").style.width).toBe("62.5%");
    expect(container.querySelector("img")).toBeNull();
  });

  it(`keeps the top ${DOMAINS_SHOWN} domains`, () => {
    mockReducedMotion(true);
    const domains = Array.from({ length: 14 }, (_, i) => ({ domain: `d${i}.com`, n: 100 - i }));
    render(<Links data={{ ...fx.media.links, domains }} people={people} />);
    expect(domainRows()).toHaveLength(DOMAINS_SHOWN);
  });

  it("draws the sharers as bars and each one's favourite domain as a chip", () => {
    mockReducedMotion(true);
    render(<Links data={fx.media.links} people={people} />);
    const sharers = within(screen.getByRole("list", { name: "Links por persona" })).getAllByRole("listitem");
    expect(sharers.map((r) => r.dataset.slug)).toEqual(["tomi", "bruno"]);
    const chips = within(screen.getByRole("list", { name: "El dominio favorito de cada uno" })).getAllByRole(
      "listitem",
    );
    expect(chips[0]).toHaveTextContent("Tomi");
    expect(chips[0]).toHaveTextContent("youtube.com");
    expect(chips[0]).toHaveTextContent("6");
  });

  it("shows the empty state without links", () => {
    render(<Links data={{ byPerson: [], domains: [], favorite: [] }} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
