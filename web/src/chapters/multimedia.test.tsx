import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../content/copy";
import { chapterById } from "@/lib/chapters";
import { loadGlobal, loadMedia, loadRecords } from "@/lib/data";
import { fmt, fmtDate } from "@/lib/format";
import { top, topKind } from "@/lib/media";
import { mockReducedMotion } from "@/test/motion";
import Multimedia from "./multimedia";

afterEach(() => vi.unstubAllGlobals());

// Against the real web/data files.
describe("/multimedia/", () => {
  it("gives every block its title, a lede and the criterion", async () => {
    mockReducedMotion(true);
    const { container } = render(await Multimedia());
    for (const b of chapterById("multimedia").blocks) {
      const block = container.querySelector<HTMLElement>(`#${b.id}`)!;
      expect(within(block).getByRole("heading", { level: 3, name: b.title })).toBeInTheDocument();
      expect(block.querySelector("[data-criterion]"), b.id).not.toBeNull();
    }
  });

  it("builds the ledes from the data", async () => {
    mockReducedMotion(true);
    const [g, media] = await Promise.all([loadGlobal(), loadMedia()]);
    const nameOf = (slug: string) => g.people.find((p) => p.slug === slug)!.name;
    const { container } = render(await Multimedia());
    // The kind is ranked on the bars; the number is the whole group's (resto included), from records.json.
    const records = await loadRecords();
    const common = topKind(media.kinds)!;
    expect(common.kind).toBe("image");
    const total = records.media.image!.total;
    expect(total).toBeGreaterThanOrEqual(common.n);
    expect(container.querySelector("#kinds")).toHaveTextContent(`lo que más se manda son fotos: ${fmt(total)}.`);
    const audio = top(media.audios.byPerson, (p) => p.n)!;
    expect(container.querySelector("#audios")).toHaveTextContent(`${nameOf(audio.slug)} mandó ${fmt(audio.n)} audios`);
    const del = top(media.deletedEdited.byPerson, (p) => p.deletedPerMil)!;
    expect(container.querySelector("#deleted-edited")).toHaveTextContent(`${nameOf(del.slug)} es quien más borra`);
  });

  it("shows concrete records: the sticker day, the three tops, the audio day, the top sharer, the deleted day", async () => {
    mockReducedMotion(true);
    const [g, media, records] = await Promise.all([loadGlobal(), loadMedia(), loadRecords()]);
    const nameOf = (slug: string) => g.people.find((p) => p.slug === slug)!.name;
    const { container } = render(await Multimedia());
    const block = (id: string) => within(container.querySelector<HTMLElement>(`#${id}`)!);

    const sticker = records.media.sticker!.recordDay;
    expect(block("kinds").getByText("El día más stickero")).toBeInTheDocument();
    expect(block("kinds").getByTestId("record-value")).toHaveAttribute("aria-label", fmt(sticker.n));
    expect(block("kinds").getByText(`${nameOf(sticker.who)}, ${fmtDate(sticker.date)}`)).toBeInTheDocument();

    expect(block("media-records").getAllByTestId("record-value")).toHaveLength(3);

    const audioDay = records.media.audio!.recordDay;
    expect(block("audios").getByText("El día de más audios")).toBeInTheDocument();
    expect(block("audios").getByText(`${nameOf(audioDay.who)}, ${fmtDate(audioDay.date)}`)).toBeInTheDocument();

    // The links block: the top sharer's lede and record, and one bar per shared domain.
    const sharer = top(media.links.byPerson, (p) => p.n)!;
    const domain = top(media.links.domains, (d) => d.n)!;
    expect(domain.domain).toBe("maps.google.com");
    expect(container.querySelector("#links")).toHaveTextContent(
      copy.media.linksLede(nameOf(sharer.slug), sharer.n, domain.domain, domain.n),
    );
    expect(container.querySelector("#links")).not.toHaveTextContent(copy.empty);
    expect(block("links").getByTestId("record-value")).toHaveAttribute("aria-label", fmt(sharer.n));
    const domains = block("links").getByRole("list", { name: copy.media.domainsLabel });
    expect(within(domains).getAllByRole("listitem")).toHaveLength(media.links.domains.length);
    expect(domains).toHaveTextContent(domain.domain);

    const day = media.deletedEdited.recordDay!;
    expect(block("deleted-edited").getByText(fmtDate(day.date))).toBeInTheDocument();
    expect(block("deleted-edited").getByTestId("record-value")).toHaveAttribute("aria-label", fmt(day.n));
  });
});
