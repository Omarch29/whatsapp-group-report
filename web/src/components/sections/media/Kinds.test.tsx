import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Kinds } from "./Kinds";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;
const list = () => screen.getByRole("list", { name: "Qué manda cada uno" });
const rows = () => within(list()).getAllByRole("listitem");

describe("Kinds", () => {
  it("toggles total / per mil with aria-pressed and re-sorts the stacked rows", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<Kinds data={fx.media.kinds} people={people} />);
    const total = screen.getByRole("button", { name: "Total" });
    const perMil = screen.getByRole("button", { name: "Por mil" });
    expect(total).toHaveAttribute("aria-pressed", "true");
    // Bruno: 20 + 5 + 10 = 35 against Tomi's 25 (text left out).
    expect(rows().map((r) => r.dataset.slug)).toEqual(["bruno", "tomi"]);
    expect(rows()[0]).toHaveTextContent("35");

    await user.click(perMil);
    expect(perMil).toHaveAttribute("aria-pressed", "true");
    expect(total).toHaveAttribute("aria-pressed", "false");
    // Tomi: 50 + 26,7 + 6,7 = 83,4 per mil against Bruno's 70.
    expect(rows().map((r) => r.dataset.slug)).toEqual(["tomi", "bruno"]);
    expect(rows()[0]).toHaveTextContent("83,4 ‰");
    expect(within(rows()[0]!).getAllByTestId("kind-seg")[0]).toHaveAttribute("title", "fotos: 50 ‰");
  });

  it("stacks one coloured segment per kind, in data order, with a legend", () => {
    mockReducedMotion(true);
    render(<Kinds data={fx.media.kinds} people={people} />);
    const segs = within(rows()[0]!).getAllByTestId("kind-seg");
    expect(segs.map((s) => s.dataset.kind)).toEqual(["image", "sticker", "audio"]);
    expect(segs[0]).toHaveAttribute("title", "fotos: 20");
    expect(parseFloat(segs[0]!.style.width)).toBeCloseTo((20 / 35) * 100, 2);
    expect(segs[0]!.style.backgroundColor).toBe("var(--gold)");
    const legend = screen.getByRole("list", { name: "Tipos de mensaje" });
    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["fotos", "stickers", "audios"]);
    expect(list()).toHaveAttribute("data-seen", "true");
  });

  it("folds the rare kinds into «otros»", () => {
    mockReducedMotion(true);
    const data = {
      kinds: ["image", "gif", "call"],
      byPerson: [
        {
          slug: "tomi",
          counts: { text: 5, image: 4, gif: 1, call: 2 },
          perMil: { text: 417, image: 333, gif: 83, call: 167 },
        },
      ],
    };
    render(<Kinds data={data} people={people} />);
    const segs = within(rows()[0]!).getAllByTestId("kind-seg");
    expect(segs.map((s) => s.dataset.kind)).toEqual(["image", "other"]);
    expect(segs[1]).toHaveAttribute("title", "otros: 3");
  });

  it("labels the Android «media» kind as multimedia, as its own segment and legend entry", () => {
    mockReducedMotion(true);
    const data = {
      kinds: ["image", "media"],
      byPerson: [{ slug: "tomi", counts: { text: 5, image: 4, media: 6 }, perMil: { text: 333, image: 267, media: 400 } }],
    };
    render(<Kinds data={data} people={people} />);
    const segs = within(rows()[0]!).getAllByTestId("kind-seg");
    expect(segs.map((s) => s.dataset.kind)).toEqual(["image", "media"]);
    expect(segs[1]).toHaveAttribute("title", "multimedia: 6");
    const legend = screen.getByRole("list", { name: "Tipos de mensaje" });
    expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["fotos", "multimedia"]);
  });

  it("renders only the person's row in profile mode, with the counts in the legend", () => {
    mockReducedMotion(true);
    render(<Kinds data={fx.media.kinds} people={people} person="tomi" />);
    expect(rows().map((r) => r.dataset.slug)).toEqual(["tomi"]);
    expect(screen.getByRole("list", { name: "Tipos de mensaje" })).toHaveTextContent("fotos: 15");
  });

  it("shows the empty state for a person with nothing in profile mode, or without data", () => {
    const { unmount } = render(<Kinds data={fx.media.kinds} people={people} person="ana" />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
    unmount();
    render(<Kinds data={{ kinds: [], byPerson: [] }} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
