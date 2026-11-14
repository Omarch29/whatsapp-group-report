import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chapterById } from "@/lib/chapters";
import { loadGlobal, loadMentions } from "@/lib/data";
import { fmt } from "@/lib/format";
import { topPair } from "@/lib/mentions";
import { mockReducedMotion } from "@/test/motion";
import Menciones from "./menciones";

afterEach(() => vi.unstubAllGlobals());

// Against the real web/data files.
describe("/menciones/", () => {
  it("gives every block its title, a lede and the criterion", async () => {
    mockReducedMotion(true);
    const { container } = render(await Menciones());
    for (const b of chapterById("menciones").blocks) {
      const block = container.querySelector<HTMLElement>(`#${b.id}`)!;
      expect(within(block).getByRole("heading", { level: 3, name: b.title })).toBeInTheDocument();
      expect(block.querySelector("[data-criterion]"), b.id).not.toBeNull();
    }
  });

  it("draws the full grid and gives it the biggest pair as lede and record, distinct from the records block", async () => {
    mockReducedMotion(true);
    const [g, mentions] = await Promise.all([loadGlobal(), loadMentions()]);
    const { container } = render(await Menciones());
    const n = mentions.slugs.length;
    const matrix = within(container.querySelector<HTMLElement>("#matrix")!);
    expect(matrix.getAllByRole("gridcell")).toHaveLength(n * n);
    const pair = topPair(mentions)!;
    const name = (slug: string) => g.people.find((p) => p.slug === slug)!.name;
    expect(matrix.getByTestId("record-value")).toHaveAttribute("aria-label", fmt(pair.n));
    expect(container.querySelector("#matrix")).toHaveTextContent(
      `${name(pair.from)} es quien más etiqueta a ${name(pair.to)}: ${fmt(pair.n)} ${pair.n === 1 ? "vez" : "veces"}`,
    );
    expect(matrix.getByText(`${name(pair.from)}, a ${name(pair.to)}`)).toBeInTheDocument();
    const mm = mentions.mostMentioned!;
    expect(container.querySelector("#matrix")).not.toHaveTextContent("es el más mencionado");
    expect(container.querySelector("#records")).toHaveTextContent(`${name(mm.slug)} recibió ${fmt(mm.n)} menciones`);
    expect(within(container.querySelector<HTMLElement>("#records")!).getAllByTestId("mention-record")).toHaveLength(2);
  });
});
