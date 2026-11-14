import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { topBadwords } from "@/lib/language";
import { Badwords, BadwordsRecord } from "./Badwords";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;

describe("Badwords", () => {
  it("starts on per mil, so the first row is the lede's per-mil leader", () => {
    mockReducedMotion(true);
    render(<Badwords data={fx.language.badwords} people={people} />);
    expect(screen.getByRole("button", { name: "Por mil" })).toHaveAttribute("aria-pressed", "true");
    const rows = within(screen.getByRole("list", { name: "Puteadas por persona" })).getAllByRole("listitem");
    expect(rows[0]!.dataset.slug).toBe(topBadwords(fx.language.badwords.byPerson)!.slug);
    expect(rows[0]).toHaveTextContent("24 ‰");
  });

  it("draws one bar per person, longest first, with a total / per mil toggle", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    const data = {
      ...fx.language.badwords,
      byPerson: [
        { slug: "tomi", n: 30, perMil: 10 },
        { slug: "bruno", n: 120, perMil: 24 },
        { slug: "ana", n: 20, perMil: 40 },
      ],
    };
    render(<Badwords data={data} people={people} />);
    await user.click(screen.getByRole("button", { name: "Total" }));
    const list = screen.getByRole("list", { name: "Puteadas por persona" });
    expect(list).toHaveAttribute("data-seen", "true");
    const rows = () => within(list).getAllByRole("listitem");
    expect(rows().map((r) => r.dataset.slug)).toEqual(["bruno", "tomi", "ana"]);
    expect(rows()[0]).toHaveTextContent("120");
    expect(within(rows()[1]!).getByTestId("bar").style.width).toBe("25%");

    const perMil = screen.getByRole("button", { name: "Por mil" });
    await user.click(perMil);
    expect(perMil).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Total" })).toHaveAttribute("aria-pressed", "false");
    expect(rows().map((r) => r.dataset.slug)).toEqual(["ana", "bruno", "tomi"]);
    expect(rows()[0]).toHaveTextContent("40 ‰");
    expect(within(rows()[2]!).getByTestId("bar").style.width).toBe("25%");
  });

  it("shows the empty state without people", () => {
    render(<Badwords data={{ byPerson: [], total: 0, record: null }} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});

describe("BadwordsRecord", () => {
  it("shows the distinct count and the message in a bubble", () => {
    mockReducedMotion(true);
    render(<BadwordsRecord record={fx.language.badwords.record} people={people} />);
    expect(screen.getByText("El mensaje más puteador")).toBeInTheDocument();
    expect(screen.getByTestId("record-value")).toHaveAttribute("aria-label", "3");
    expect(screen.getByText("distintas en un mensaje")).toBeInTheDocument();
    expect(screen.getByText("Mierda, perdí el bondi")).toBeInTheDocument();
  });

  it("ends a text the pipeline cut at 300 characters on a word, with an ellipsis", () => {
    mockReducedMotion(true);
    const text = `${"che boludo ".repeat(27)}Me quiero `.slice(0, 300);
    render(<BadwordsRecord record={{ ...fx.language.badwords.record!, text }} people={people} />);
    const bubble = screen.getByText((t) => t.startsWith("che boludo"));
    expect(bubble.textContent!.endsWith("…")).toBe(true);
    expect(bubble.textContent).not.toContain("Me quiero ");
  });

  it("renders nothing without a record", () => {
    const { container } = render(<BadwordsRecord record={null} people={people} />);
    expect(container).toBeEmptyDOMElement();
  });
});
