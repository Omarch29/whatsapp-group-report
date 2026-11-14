import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubSilentIO } from "@/test/io";
import { mockReducedMotion } from "@/test/motion";
import { ByYear } from "./ByYear";

afterEach(() => vi.unstubAllGlobals());

const data = [
  {
    year: "2023",
    top: [
      { e: "😭", n: 75 },
      { e: "🤣", n: 27 },
    ],
  },
  {
    year: "2024",
    top: [
      { e: "❤️", n: 300 },
      { e: "😭", n: 150 },
    ],
  },
];

describe("emojis ByYear", () => {
  it("draws one column per year with its top emojis in order, the year's number one marked", () => {
    mockReducedMotion(true);
    render(<ByYear data={data} />);
    const y2023 = within(screen.getByRole("list", { name: "Top 5 de 2023" })).getAllByRole("listitem");
    expect(y2023.map((li) => li.dataset.e)).toEqual(["😭", "🤣"]);
    expect(y2023[0]).toHaveAttribute("data-leader");
    expect(y2023[1]).not.toHaveAttribute("data-leader");
    expect(y2023[0]).toHaveTextContent("75");
    // One scale for every year: 2024's ❤️ is the full bar.
    const y2024 = within(screen.getByRole("list", { name: "Top 5 de 2024" })).getAllByRole("listitem");
    expect(within(y2024[0]!).getByTestId("year-emoji-bar").style.width).toBe("100%");
    expect(within(y2024[1]!).getByTestId("year-emoji-bar").style.width).toBe("50%");
  });

  it("marks the emoji that made the top 5 the most years", () => {
    mockReducedMotion(true);
    render(<ByYear data={data} />);
    const marked = screen.getAllByRole("listitem").filter((li) => li.hasAttribute("data-constant"));
    expect(marked.map((li) => li.dataset.e)).toEqual(["😭", "😭"]);
  });

  it("plays year by year once seen; final state under reduced motion", () => {
    mockReducedMotion(false);
    stubSilentIO();
    const { container, unmount } = render(<ByYear data={data} />);
    expect(container.querySelector("[data-seen]")).toHaveAttribute("data-seen", "false");
    unmount();
    vi.unstubAllGlobals();
    mockReducedMotion(true);
    const { container: c2 } = render(<ByYear data={data} />);
    expect(c2.querySelector("[data-seen]")).toHaveAttribute("data-seen", "true");
  });

  it("shows the empty state without years", () => {
    render(<ByYear data={[]} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
