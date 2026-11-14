import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../content/copy";
import ReportLayout from "@/app/(report)/layout";
import Home from "@/app/(report)/page";
import { CHAPTER_PAGES } from "@/chapters";
import * as data from "@/lib/data";
import { mockReducedMotion } from "@/test/motion";

vi.mock("@/lib/data", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/data")>()) }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The ten sections of the long page, in order; Records brings its three anchors (length, per-day, night). */
const ALL = ["intro", "timeline", "race", "heatmap", "graph", "muletillas", "signature", "length", "per-day", "night", "awards", "text"];

/** The report shell in single mode around the root page, both rendered from the example data. */
async function renderSingle() {
  mockReducedMotion(true);
  vi.spyOn(data, "loadMode").mockResolvedValue("single");
  const props = { children: await Home(), params: Promise.resolve({}) } as LayoutProps<"/">;
  return render(await ReportLayout(props));
}

/** Ids of the page's anchored blocks, in document order. */
const pageBlocks = (main: Element) => Array.from(main.querySelectorAll("[data-block][id]"), (el) => el.id);

/** Every rendering of the floating index (the desktop list and the mobile sheet), as the anchor ids it links. */
const indexLists = (root: Element) =>
  Array.from(root.querySelectorAll("[data-floating-index]"), (nav) =>
    Array.from(nav.querySelectorAll("a"), (a) => a.getAttribute("href")!.replace(/^#/, "")),
  );

describe("single page", () => {
  it("renders the ten sections in order, with an index of exactly those anchors and no chapter chrome", async () => {
    const { container } = await renderSingle();
    const main = container.querySelector("main")!;
    expect(pageBlocks(main)).toEqual(ALL);
    const lists = indexLists(container);
    expect(lists).toHaveLength(2);
    for (const list of lists) expect(list).toEqual(ALL);
    // Titles come from the chapters' blocks, or from the heading the section prints when it has its own.
    expect(screen.getAllByRole("link", { name: "Línea de tiempo" })[0]).toHaveAttribute("href", "#timeline");
    expect(screen.getAllByRole("link", { name: copy.records.length.label })[0]).toHaveAttribute("href", "#length");
    // No sidebar, drawer or pager, and no link to a route the single export does not emit.
    expect(screen.queryByRole("navigation", { name: copy.nav.chapters })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: copy.nav.pager })).not.toBeInTheDocument();
    for (const a of container.querySelectorAll("a[href]")) expect(a.getAttribute("href"), a.outerHTML).toMatch(/^#/);
    // The timeline keeps every milestone, as plain text: its chapter and profile links have no page here.
    const milestones = screen.getByRole("list", { name: copy.census.timelineList });
    expect(milestones.querySelectorAll("li")).toHaveLength((await data.loadCensus()).timeline.length);
    expect(milestones.querySelector("a")).toBeNull();
  });

  it("is unchanged without departures or polls: neither is on the long page", async () => {
    const [departures, polls] = await Promise.all([data.loadDepartures(), data.loadPolls()]);
    vi.spyOn(data, "loadDepartures").mockResolvedValue({ ...departures, person: null });
    vi.spyOn(data, "loadPolls").mockResolvedValue({ ...polls, total: 0 });
    const { container } = await renderSingle();
    expect(pageBlocks(container.querySelector("main")!)).toEqual(ALL);
    for (const list of indexLists(container)) expect(list).toEqual(ALL);
  });

  it("omits the emoji block, with no heading left behind, when there is no signature emoji, and the index does not list it", async () => {
    const emojis = await data.loadEmojis();
    vi.spyOn(data, "loadEmojis").mockResolvedValue({ ...emojis, signature: [] });
    const { container } = await renderSingle();
    const expected = ALL.filter((id) => id !== "signature");
    expect(pageBlocks(container.querySelector("main")!)).toEqual(expected);
    for (const list of indexLists(container)) expect(list).toEqual(expected);
    expect(screen.queryByRole("heading", { name: "El emoji de cada uno" })).not.toBeInTheDocument();
    expect(screen.queryByText(copy.empty)).not.toBeInTheDocument();
  });

  it("builds each shared block exactly as its chapter does (lede, record, chips), from the same data", async () => {
    // A departer who takes the lead, so the race lede reads the departer's name and month too.
    const facts = await data.loadFacts();
    vi.spyOn(data, "loadFacts").mockResolvedValue({ ...facts, departerOvertakeMonth: "2025-03", departerMonthsToTop: 4 });
    const cases: [keyof typeof CHAPTER_PAGES, string][] = [
      ["censo", "timeline"],
      ["carrera", "race"],
      ["horas", "heatmap"],
      ["emojis", "signature"],
      ["records", "length"],
    ];
    mockReducedMotion(true);
    const inChapter = new Map<string, string>();
    for (const [chapter, id] of cases) {
      const { container, unmount } = render(await CHAPTER_PAGES[chapter]());
      inChapter.set(id, container.querySelector(`#${id}`)!.textContent!);
      unmount();
    }
    const { container } = await renderSingle();
    for (const [chapter, id] of cases) {
      expect(container.querySelector(`#${id}`)!.textContent, `${chapter}#${id}`).toBe(inChapter.get(id));
    }
    // The cases above are not vacuous: the race lede names the departer.
    const departer = (await data.loadDepartures()).person!.name;
    expect(container.querySelector("#race")!.textContent).toContain(departer);
  });

  it("gives every indexed block one visible heading that reads as its index entry, and every section an h2", async () => {
    const { container } = await renderSingle();
    const main = container.querySelector("main")!;
    const nav = container.querySelector("[data-floating-index]")!;
    const visible = (h: Element) => !/hiddenTitle/.test(h.className);
    const entries = Array.from(nav.querySelectorAll("a"), (a) => [a.getAttribute("href")!.slice(1), a.textContent!] as const);
    expect(entries.map(([id]) => id)).toEqual(ALL);
    // The intro is the page itself: its heading is the page's h1 (the total), not a section title.
    for (const [id, title] of entries.filter(([id]) => id !== "intro")) {
      const headings = Array.from(main.querySelector(`[id="${id}"]`)!.querySelectorAll("h1, h2, h3, h4, h5, h6"));
      expect(headings.filter(visible).map((h) => h.textContent), id).toEqual([title]);
    }
    // Each top-level section opens with an h2 (the hero with the page's h1), whatever component renders it.
    const levels = Array.from(main.children, (el) => el.querySelector("h1, h2, h3, h4, h5, h6")!.tagName);
    expect(levels).toEqual(["H1", ...Array(levels.length - 1).fill("H2")]);
  });

  it("omits the night record when there is none, from the page and from the index", async () => {
    const records = await data.loadRecords();
    vi.spyOn(data, "loadRecords").mockResolvedValue({ ...records, latestNight: null });
    const { container } = await renderSingle();
    const expected = ALL.filter((id) => id !== "night");
    expect(pageBlocks(container.querySelector("main")!)).toEqual(expected);
    for (const list of indexLists(container)) expect(list).toEqual(expected);
  });
});
