import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { stubSilentIO } from "@/test/io";
import { mockReducedMotion } from "@/test/motion";
import { Signature } from "./Signature";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;
const cards = () => within(screen.getByRole("list", { name: "El emoji de cada uno" })).getAllByRole("listitem");

describe("Signature", () => {
  it("gives each person a card with the emoji, the name and «×own», as in «Tomi 😂 ×3»", () => {
    mockReducedMotion(true);
    const data = [{ slug: "tomi", e: "😂", own: 3, ratio: 3.2 }];
    render(<Signature data={data} people={people} />);
    expect(cards()).toHaveLength(1);
    expect(cards()[0]).toHaveTextContent("Tomi 😂 ×3");
    expect(cards()[0]).toHaveTextContent("3,2 veces más que el resto");
  });

  it("keeps the data order, one card each, and gray-fallback people get theirs too", () => {
    mockReducedMotion(true);
    const data = [...fx.emojis.signature, { slug: "pepe", e: "😬", own: 129, ratio: 151.6 }];
    render(<Signature data={data} people={people} />);
    expect(cards().map((c) => c.dataset.slug)).toEqual(["bruno", "tomi", "pepe"]);
    expect(cards()[1]).toHaveTextContent("Tomi 😂 ×90");
    expect(cards()[2]).toHaveTextContent("Pepe 😬 ×129");
  });

  it("drops the emojis in only once seen; under reduced motion they are in place", () => {
    mockReducedMotion(false);
    stubSilentIO();
    const { unmount } = render(<Signature data={fx.emojis.signature} people={people} />);
    expect(screen.getAllByTestId("signature-emoji")[0]!.style.opacity).toBe("0");
    unmount();
    vi.unstubAllGlobals();
    mockReducedMotion(true);
    render(<Signature data={fx.emojis.signature} people={people} />);
    expect(screen.getAllByTestId("signature-emoji")[0]!.style.opacity).not.toBe("0");
  });

  it("renders only the person's card in profile mode, and nothing for someone without a signature", () => {
    mockReducedMotion(true);
    const { unmount } = render(<Signature data={fx.emojis.signature} people={people} person="tomi" />);
    expect(cards().map((c) => c.dataset.slug)).toEqual(["tomi"]);
    unmount();
    // ana has no signature in the fixture: the profile's lede speaks for the block.
    const { container } = render(<Signature data={fx.emojis.signature} people={people} person="ana" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the empty state for the group view", () => {
    render(<Signature data={[]} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
