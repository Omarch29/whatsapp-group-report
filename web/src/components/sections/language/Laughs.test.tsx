import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { LAUGH_COLORS, Laughs, LaughsRecord } from "./Laughs";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;

describe("Laughs", () => {
  it("draws one proportional stacked row per person with fixed class colors and the jaja length", async () => {
    mockReducedMotion(true);
    render(<Laughs data={fx.language.laughs} people={people} />);
    const rows = within(screen.getByRole("list", { name: "La risa de cada uno" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Bruno");
    expect(rows[0]).toHaveTextContent("jaja ×2,4");
    expect(rows[0]).toHaveAttribute("data-seen", "true");
    const segs = within(rows[0]!).getAllByTestId("laugh-seg");
    // Zero classes draw nothing: Bruno has no xd.
    expect(segs.map((s) => s.dataset.kind)).toEqual(["jaja", "jsjs", "jeje", "jiji", "emoji"]);
    expect(parseFloat(segs[0]!.style.width)).toBeCloseTo((50 / 79) * 100, 2);
    expect(segs[0]!.style.backgroundColor).toBe("rgb(37, 211, 102)");
    expect(segs[0]).toHaveAttribute("title", "jaja: 50 (63,3 %)");
    const sum = segs.reduce((a, s) => a + parseFloat(s.style.width), 0);
    expect(sum).toBeCloseTo(100, 1);
    // No minimum width: with flex none it would push the row past 100 % and clip the last class.
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(`${process.cwd()}/src/components/sections/language/Laughs.module.css`, "utf8");
    expect(/\.seg \{[^}]*min-width/.exec(css)).toBeNull();
    expect(LAUGH_COLORS[3]).toBe("#53bdeb");
    const legend = within(screen.getByRole("list", { name: "Tipos de risa" })).getAllByRole("listitem");
    expect(legend.map((li) => li.textContent)).toEqual(["jaja", "jsjs", "jeje", "jiji", "xd", "😂"]);
  });

  it("draws one bar per mix entry in array order, labelled by the data (any language)", () => {
    mockReducedMotion(true);
    const mix = [{ key: "haha", label: "haha", n: 3 }, { key: "emoji", label: "😂", n: 1 }];
    const data = { ...fx.language.laughs, byPerson: [{ slug: "bruno", mix, avgJa: 2 }] };
    render(<Laughs data={data} people={people} />);
    const segs = screen.getAllByTestId("laugh-seg");
    expect(segs.map((s) => s.dataset.kind)).toEqual(["haha", "emoji"]);
    expect(segs[0]).toHaveAttribute("title", "haha: 3 (75 %)");
    expect(segs[1]).toHaveAttribute("title", "😂: 1 (25 %)");
    expect(parseFloat(segs[0]!.style.width)).toBeCloseTo(75, 2);
    const legend = within(screen.getByRole("list", { name: "Tipos de risa" })).getAllByRole("listitem");
    expect(legend.map((li) => li.textContent)).toEqual(["haha", "😂"]);
    expect(screen.getByRole("list", { name: "La risa de cada uno" })).toHaveTextContent("haha 3, 😂 1");
  });

  it("paints classes beyond the colour list with the grey fallback, never repeating the first colour", () => {
    mockReducedMotion(true);
    const keys = ["a", "b", "c", "d", "e", "f", "g"];
    const mix = keys.map((key) => ({ key, label: key, n: 1 }));
    render(<Laughs data={{ ...fx.language.laughs, byPerson: [{ slug: "bruno", mix, avgJa: 2 }] }} people={people} />);
    const segs = screen.getAllByTestId("laugh-seg");
    expect(segs).toHaveLength(7);
    expect(segs[6]!.style.backgroundColor).toBe("rgb(85, 101, 111)");
    expect(segs[0]!.style.backgroundColor).toBe("rgb(37, 211, 102)");
  });

  it("shows the empty state without people", () => {
    render(<Laughs data={{ byPerson: [], record: null }} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});

describe("LaughsRecord", () => {
  it("shows the longest jaja with who and the text in a bubble", () => {
    mockReducedMotion(true);
    render(<LaughsRecord record={fx.language.laughs.record} people={people} />);
    expect(screen.getByText("El jaja más largo")).toBeInTheDocument();
    expect(screen.getByTestId("record-value")).toHaveAttribute("aria-label", "22");
    expect(screen.getByText("ja seguidos")).toBeInTheDocument();
    expect(screen.getByText("JAJAJAJAJAJAJAJAJAJAJA")).toBeInTheDocument();
    expect(screen.getByText("Ana, 02/11/2023")).toBeInTheDocument();
  });

  it("renders nothing without a record", () => {
    const { container } = render(<LaughsRecord record={null} people={people} />);
    expect(container).toBeEmptyDOMElement();
  });
});
