import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../content/copy";
import { chapterById } from "@/lib/chapters";
import { loadFacts, loadGlobal, loadRhythm } from "@/lib/data";
import { fmt } from "@/lib/format";
import { longestStreak } from "@/lib/rhythm";
import { mockReducedMotion } from "@/test/motion";
import Ritmo from "./ritmo";

afterEach(() => vi.unstubAllGlobals());

// Against the real web/data files.
describe("/ritmo/", () => {
  it("gives every block its title, a lede, the criterion and a record", async () => {
    mockReducedMotion(true);
    const { container } = render(await Ritmo());
    for (const b of chapterById("ritmo").blocks) {
      const block = container.querySelector<HTMLElement>(`#${b.id}`)!;
      expect(within(block).getByRole("heading", { level: 3, name: b.title })).toBeInTheDocument();
      expect(block.querySelector("[data-criterion]"), b.id).not.toBeNull();
      expect(within(block).getAllByTestId("record-value").length, b.id).toBeGreaterThan(0);
    }
  });

  it("names the top starter and killer, the fastest replier, the longest streak and the busiest weekday", async () => {
    mockReducedMotion(true);
    const [g, rhythm, facts] = await Promise.all([loadGlobal(), loadRhythm(), loadFacts()]);
    const name = (slug: string) => g.people.find((p) => p.slug === slug)!.name;
    const { container } = render(await Ritmo());
    const s = facts.startersTop!;
    const k = facts.killersTop!;
    expect(container.querySelector("#starters-killers")).toHaveTextContent(
      `${name(s.slug)} arrancó la charla ${fmt(s.n)} veces, más que nadie; ${name(k.slug)} la mató ${fmt(k.n)} veces.`,
    );
    // The synthetic chat has 500+ quick replies for several people: the fastest replier is named, not the empty copy.
    const f = facts.fastest!;
    expect(f).not.toBeNull();
    expect(container.querySelector("#latency")).toHaveTextContent(
      copy.rhythm.latencyLede(name(f.slug), f.medianFromSec),
    );
    expect(container.querySelector("#latency")).not.toHaveTextContent(copy.empty);
    const fastestPair = rhythm.fastest!;
    const pair = within(container.querySelector<HTMLElement>("#latency")!).getByRole("list", { name: "Los dos mensajes" });
    expect(pair).toHaveTextContent(fastestPair.a.text);
    expect(pair).toHaveTextContent(fastestPair.b.text);
    const streak = longestStreak(rhythm.streaks)!;
    const block = within(container.querySelector<HTMLElement>("#streaks")!);
    expect(block.getByTestId("record-value")).toHaveAttribute("aria-label", fmt(streak.streak.days));
    // The busiest weekday overall (the rings), not facts.peakDow: that one is the day of the heatmap's brightest cell.
    const dowMax = Math.max(...rhythm.rings.dow);
    expect(container.querySelector("#rings")).toHaveTextContent(
      `El ${copy.dow[rhythm.rings.dow.indexOf(dowMax)]} es el día más movido de la semana, con ${fmt(dowMax)} mensajes;`,
    );
  });
});
