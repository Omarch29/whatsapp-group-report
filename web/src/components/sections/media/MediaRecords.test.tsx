import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { MediaRecords, RECORD_KINDS } from "./MediaRecords";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;
const media = {
  ...fx.records.media,
  sticker: {
    total: 13,
    byPerson: [
      { slug: "tomi", n: 8 },
      { slug: "bruno", n: 5 },
    ],
    recordDay: { who: "bruno", date: "2023-10-20", n: 4 },
  },
};

describe("MediaRecords", () => {
  it("shows the top sender of stickers, audios and photos side by side, with the record day as caption", () => {
    mockReducedMotion(true);
    render(<MediaRecords media={media} people={people} />);
    expect(RECORD_KINDS).toEqual(["sticker", "audio", "image"]);
    const cards = screen.getAllByTestId("media-record");
    expect(cards).toHaveLength(3);
    const sticker = within(cards[0]!);
    expect(sticker.getByText("El más stickero")).toBeInTheDocument();
    expect(sticker.getByTestId("record-value")).toHaveAttribute("aria-label", "8");
    expect(sticker.getByText("stickers")).toBeInTheDocument();
    expect(sticker.getByText("Tomi, en total")).toBeInTheDocument();
    expect(sticker.getByText("· récord de un día: 4, Bruno el 20/10/2023")).toBeInTheDocument();
    expect(within(cards[1]!).getByText("El más audiero")).toBeInTheDocument();
    expect(within(cards[2]!).getByText("El más fotógrafo")).toBeInTheDocument();
  });

  it("skips a kind without data and renders nothing without any", () => {
    mockReducedMotion(true);
    const { unmount } = render(<MediaRecords media={fx.records.media} people={people} />);
    expect(screen.getAllByTestId("media-record")).toHaveLength(2);
    unmount();
    render(<MediaRecords media={{}} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
