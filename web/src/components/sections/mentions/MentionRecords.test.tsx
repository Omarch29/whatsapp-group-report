import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fmt } from "@/lib/format";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { MentionRecords } from "./MentionRecords";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;

describe("MentionRecords", () => {
  it("shows the most mentioned and the top tagger side by side", () => {
    mockReducedMotion(true);
    render(<MentionRecords data={fx.mentions} people={people} />);
    expect(screen.getByText("El más mencionado")).toBeInTheDocument();
    expect(screen.getByText("El que más etiqueta")).toBeInTheDocument();
    const values = screen.getAllByTestId("record-value").map((v) => v.getAttribute("aria-label"));
    expect(values).toEqual([fmt(28), fmt(24)]);
    expect(screen.getByText("Bruno, en total")).toBeInTheDocument();
    expect(screen.getByText("Tomi, en total")).toBeInTheDocument();
  });

  it("omits a null record, and shows the empty state when both are null", () => {
    mockReducedMotion(true);
    const { unmount } = render(<MentionRecords data={{ ...fx.mentions, topTagger: null }} people={people} />);
    expect(screen.queryByText("El que más etiqueta")).not.toBeInTheDocument();
    expect(screen.getByText("El más mencionado")).toBeInTheDocument();
    unmount();
    render(<MentionRecords data={{ ...fx.mentions, topTagger: null, mostMentioned: null }} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
