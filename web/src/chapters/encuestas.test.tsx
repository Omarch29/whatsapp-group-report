import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chapterById } from "@/lib/chapters";
import { loadGlobal, loadPolls } from "@/lib/data";
import { fmt } from "@/lib/format";
import { mockReducedMotion } from "@/test/motion";
import Encuestas from "./encuestas";

afterEach(() => vi.unstubAllGlobals());

// Against the real web/data files.
describe("/encuestas/", () => {
  it("gives every block its title, a lede and the criterion", async () => {
    mockReducedMotion(true);
    const { container } = render(await Encuestas());
    for (const b of chapterById("encuestas").blocks) {
      const block = container.querySelector<HTMLElement>(`#${b.id}`)!;
      expect(within(block).getByRole("heading", { level: 3, name: b.title })).toBeInTheDocument();
      expect(block.querySelector("[data-criterion]"), b.id).not.toBeNull();
    }
  });

  it("states the total and the top creator, and records the most voted poll", async () => {
    mockReducedMotion(true);
    const [g, polls] = await Promise.all([loadGlobal(), loadPolls()]);
    const { container } = render(await Encuestas());
    const creator = polls.byPerson[0]!;
    const name = g.people.find((p) => p.slug === creator.slug)!.name;
    expect(container.querySelector("#by-person")).toHaveTextContent(
      `El grupo armó ${fmt(polls.total)} encuestas; ${name}, ${fmt(creator.n)}: más que nadie.`,
    );
    const block = within(container.querySelector<HTMLElement>("#top")!);
    const voted = polls.mostVoted[0]!;
    expect(block.getByText("La más votada")).toBeInTheDocument();
    expect(block.getByTestId("record-value")).toHaveAttribute("aria-label", fmt(voted.totalVotes));
    expect(block.getAllByTestId("poll-item")).toHaveLength(Math.min(10, polls.mostVoted.length));
  });
});
