import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { copy } from "../../../content/copy";
import Horas from "@/chapters/horas";
import { PROFILE_BLOCKS } from "@/lib/chapters";
import { listPeopleSlugs, loadAwards, loadEmojis, loadGlobal, loadPerson, loadRhythm } from "@/lib/data";
import { mockReducedMotion } from "@/test/motion";
import Profile from "./p/[slug]/page";

// Page composition against the real web/data files (server components rendered as plain async functions).
describe("pages", () => {
  it("/horas/ gives the heatmap a chip per profiled person", async () => {
    mockReducedMotion(true);
    render(await Horas());
    const grid = screen.getByRole("grid", { name: "Mensajes por hora y día" });
    const section = grid.closest("section")!;
    const g = await loadGlobal();
    const names = (await listPeopleSlugs()).map((s) => g.people.find((p) => p.slug === s)!.name);
    const buttons = within(section).getAllByRole("button");
    const chips = buttons.filter((b) => !b.hasAttribute("data-copy-link")).map((b) => b.textContent);
    expect(chips).toEqual(["Grupo", ...names]);
    expect(buttons.at(-1)).toHaveAttribute("data-copy-link", "heatmap"); // the block's «Copiar link», last
  });

  it("/p/[slug] uses the person's own active days in the hero", async () => {
    mockReducedMotion(true);
    const [slug] = await listPeopleSlugs();
    const p = await loadPerson(slug!);
    render(await Profile({ params: Promise.resolve({ slug: slug! }) } as PageProps<"/p/[slug]">));
    expect(screen.getByText(copy.hero.lede(p.msgs, p.activeDays))).toBeInTheDocument();
    // The profile heatmap stays person-only: no chip row.
    const section = screen.getByRole("grid", { name: "Mensajes por hora y día" }).closest("section")!;
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
  });

  /** A painted lede: the names are bold spans, so the paragraph is matched by its whole text. */
  const lede = (text: string) => (_: string, node: Element | null) => node?.tagName === "P" && node.textContent === text;

  const renderProfile = async (slug: string) =>
    render(await Profile({ params: Promise.resolve({ slug }) } as PageProps<"/p/[slug]">));

  it("/p/[slug] adds every profile block, anchored as the «Este perfil» nav lists them", async () => {
    mockReducedMotion(true);
    const [slug] = await listPeopleSlugs();
    await renderProfile(slug!);
    for (const b of PROFILE_BLOCKS) {
      const el = document.getElementById(b.id);
      expect(el, b.id).toBeInTheDocument();
      expect(el).toHaveAttribute("data-block");
      expect(within(el!).getByRole("heading", { name: b.title })).toBeInTheDocument();
    }
    expect(document.querySelector("#muletillas")).toBeInTheDocument();
    // The v1 sections stay as they were on profiles: the chapter anatomy (criterion, «Copiar link») is chapter-only.
    for (const id of ["race", "heatmap", "graph", "cloud", "rail"]) {
      expect(document.querySelector(`#${id} [data-copy-link]`), id).toBeNull();
      expect(document.querySelector(`#${id} [data-criterion]`), id).toBeNull();
    }
    // The first person won or was a finalist in something: the list, not the empty state.
    const premios = document.getElementById("premios")!;
    const awards = await loadAwards();
    const won = awards.filter((a) => a.winner?.slug === slug).length;
    const finalist = awards.filter((a) => a.winner?.slug !== slug && a.runnersUp.some((r) => r.slug === slug)).length;
    const name = (await loadGlobal()).people.find((p) => p.slug === slug)!.name;
    expect(within(premios).getByText(lede(copy.profile.awardsLede(name, won, finalist)))).toBeInTheDocument();
    expect(within(premios).queryByText(copy.empty)).not.toBeInTheDocument();
    // Profile mode everywhere: no person chips in the language blocks.
    expect(within(document.getElementById("muletillas")!).queryByRole("group", { name: copy.language.chips })).not.toBeInTheDocument();
  });

  it("/p/[slug] keeps every block for the person with the fewest messages, empty states where data is missing", async () => {
    mockReducedMotion(true);
    const [g, emojis, rhythm, slugs] = await Promise.all([loadGlobal(), loadEmojis(), loadRhythm(), listPeopleSlugs()]);
    const fewest = slugs.map((s) => g.people.find((p) => p.slug === s)!).sort((a, b) => a.msgs - b.msgs)[0]!;
    await renderProfile(fewest.slug);
    for (const b of PROFILE_BLOCKS) expect(document.getElementById(b.id), b.id).toBeInTheDocument();
    const latency = document.getElementById("latency")!;
    if (!rhythm.latency.some((l) => l.slug === fewest.slug)) {
      expect(within(latency).getByText(copy.profile.latencyEmpty)).toBeInTheDocument();
    }
    if (!emojis.signature.some((s) => s.slug === fewest.slug)) {
      expect(within(document.getElementById("signature")!).getByText(lede(copy.profile.signatureEmpty(fewest.name)))).toBeInTheDocument();
    }
  });

  it("/p/[slug] says once, in the lede, that the person has no signature emoji", async () => {
    mockReducedMotion(true);
    const [g, emojis, slugs] = await Promise.all([loadGlobal(), loadEmojis(), listPeopleSlugs()]);
    const slug = slugs.find((s) => !emojis.signature.some((e) => e.slug === s));
    if (!slug) return; // every profiled person has a signature on this export
    await renderProfile(slug);
    const name = g.people.find((p) => p.slug === slug)!.name;
    const block = document.getElementById("signature")!;
    expect(within(block).getByText(lede(copy.profile.signatureEmpty(name)))).toBeInTheDocument();
    // Only the personal line: the chart adds no generic empty state under it.
    expect(within(block).queryByText(copy.empty)).not.toBeInTheDocument();
  });
});
