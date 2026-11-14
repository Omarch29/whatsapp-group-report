import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../content/copy";
import { chapterById } from "@/lib/chapters";
import { loadEmojis, loadGlobal } from "@/lib/data";
import { fmt } from "@/lib/format";
import { strongestSignature, yearRecord } from "@/lib/emojis";
import { mockReducedMotion } from "@/test/motion";
import Emojis from "./emojis";

afterEach(() => vi.unstubAllGlobals());

// Against the real web/data files.
describe("/emojis/", () => {
  it("gives every block its title, a lede and the criterion", async () => {
    mockReducedMotion(true);
    const { container } = render(await Emojis());
    for (const b of chapterById("emojis").blocks) {
      const block = container.querySelector<HTMLElement>(`#${b.id}`)!;
      expect(within(block).getByRole("heading", { level: 3, name: b.title })).toBeInTheDocument();
      expect(block.querySelector("[data-criterion]"), b.id).not.toBeNull();
    }
  });

  it("fills every block from the data: the top emoji, the strongest signature and the year record", async () => {
    mockReducedMotion(true);
    const [g, emojis] = await Promise.all([loadGlobal(), loadEmojis()]);
    const nameOf = (slug: string) => g.people.find((p) => p.slug === slug)!.name;
    const e = copy.emojis;
    const first = emojis.top[0];
    expect(first).toEqual({ e: "😂", n: 190, topUser: "flor" });
    const sig = strongestSignature(emojis.signature)!;
    expect(sig).not.toBeNull();
    const year = yearRecord(emojis.byYear)!;
    expect(year).not.toBeNull();
    const { container } = render(await Emojis());
    const block = (id: string) => container.querySelector<HTMLElement>(`#${id}`)!;
    expect(block("top")).toHaveTextContent(e.topLede(first.e, first.n));
    expect(block("signature")).toHaveTextContent(e.signatureLede(nameOf(sig.slug), sig.e, sig.ratio));
    for (const id of ["top", "signature", "by-year"]) {
      expect(block(id), id).not.toHaveTextContent(copy.empty);
      expect(within(block(id)).getByTestId("record-value"), id).toBeInTheDocument();
    }
    expect(within(block("top")).getByTestId("record-value")).toHaveAttribute("aria-label", "190");
    expect(within(block("by-year")).getByTestId("record-value")).toHaveAttribute("aria-label", fmt(year.n));
  });
});
