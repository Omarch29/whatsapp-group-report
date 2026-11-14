import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PeopleIndex } from "@/components/PeopleIndex";
import { PersonHeader } from "@/components/PersonHeader";
import { Dictionary } from "@/components/sections/Dictionary";
import { Events } from "@/components/sections/Events";
import { Heatmap } from "@/components/sections/Heatmap";
import { Hero } from "@/components/sections/Hero";
import { Departures } from "@/components/sections/Departures";
import { Pairs } from "@/components/sections/Pairs";
import { Race } from "@/components/sections/Race";
import { Records } from "@/components/sections/Records";
import { ByYear as EmojiByYear } from "@/components/sections/emojis/ByYear";
import { Signature } from "@/components/sections/emojis/Signature";
import { Top as EmojiTop } from "@/components/sections/emojis/Top";
import { Audios } from "@/components/sections/media/Audios";
import { DeletedEdited } from "@/components/sections/media/DeletedEdited";
import { Kinds } from "@/components/sections/media/Kinds";
import { Links } from "@/components/sections/media/Links";
import { MediaRecords } from "@/components/sections/media/MediaRecords";
import { ByPerson as PollsByPerson } from "@/components/sections/polls/ByPerson";
import { TopPolls } from "@/components/sections/polls/TopPolls";
import { Awards } from "@/components/sections/awards/Awards";
import { Matrix } from "@/components/sections/mentions/Matrix";
import { MentionRecords } from "@/components/sections/mentions/MentionRecords";
import { PerMil } from "@/components/sections/mentions/PerMil";
import { FastestPair, Latency } from "@/components/sections/rhythm/Latency";
import { Rings } from "@/components/sections/rhythm/Rings";
import { StartersKillers } from "@/components/sections/rhythm/StartersKillers";
import { Streaks } from "@/components/sections/rhythm/Streaks";
import { ScrollTrigger } from "@/lib/scrollPins";
import { fx } from "./fixtures";
import { mockMedia, mockReducedMotion } from "./motion";

const g = fx.global;
const bruno = g.people.find((p) => p.slug === "bruno")!;
const tomi = g.people.find((p) => p.slug === "tomi")!;
const BUBBLES = ["uno", "dos", "tres"];

/** Every section of `/`, in page order. */
const Home = () => (
  <main>
    <Hero total={g.totals.msgs} daysActive={g.totals.daysActive} bubbles={BUBBLES} />
    <Race months={g.monthly.months} series={g.monthly.series} people={g.people} lede="" />
    <Heatmap group={g.heatmap} people={[{ ...tomi, heatmap: fx.person.heatmap }]} lede="" />
    <Pairs people={g.people} edges={g.edges} lede="" />
    <Departures data={fx.departures} facts={fx.facts} name="Bruno" polls={bruno.polls} people={g.people} />
    <Events events={fx.events22} />
    <Records data={fx.records} people={g.people} />
    <Dictionary terms={fx.lore} people={g.people} />
    <PeopleIndex people={g.people} nicknames={fx.nicknames} />
  </main>
);

/** Every section of a profile page (`/p/tomi`), in page order. */
const Profile = () => (
  <main>
    <PersonHeader person={tomi} nick="Tomate" />
    <Hero total={fx.person.msgs} daysActive={fx.person.activeDays} bubbles={BUBBLES} person={{ name: "Tomi" }} />
    <Race months={g.monthly.months} series={g.monthly.series} people={g.people} highlight="tomi" lede="" autoplay />
    <Heatmap group={fx.person.heatmap} lede="" />
    <Pairs people={g.people} edges={g.edges} focus="tomi" lede="" />
    <Records data={fx.records} people={g.people} person={fx.person} />
    <Dictionary terms={fx.lore} people={g.people} highlight="tomi" lede="" />
    <Events events={fx.events} filterSlug="tomi" lede="" />
  </main>
);

/** The charts of /multimedia/, /emojis/ and /encuestas/. */
const MediaChapters = () => (
  <main>
    <Kinds data={fx.media.kinds} people={g.people} />
    <MediaRecords media={fx.records.media} people={g.people} />
    <Audios data={fx.media.audios} people={g.people} />
    <Links data={fx.media.links} people={g.people} />
    <DeletedEdited data={fx.media.deletedEdited} people={g.people} />
    <EmojiTop data={fx.emojis.top} people={g.people} />
    <Signature data={fx.emojis.signature} people={g.people} />
    <EmojiByYear data={fx.emojis.byYear} />
    <PollsByPerson data={fx.polls} people={g.people} />
    <TopPolls data={fx.polls} people={g.people} />
  </main>
);

/** The charts of /ritmo/, /menciones/ and /premios/. */
const LaterChapters = () => (
  <main>
    <StartersKillers starters={fx.rhythm.starters} killers={fx.rhythm.killers} people={g.people} />
    <Latency data={fx.rhythm.latency} people={g.people} />
    <FastestPair fastest={fx.rhythm.fastest!} people={g.people} />
    <Streaks data={fx.rhythm.streaks} people={g.people} />
    <Rings data={fx.rhythm.rings} />
    <Matrix data={fx.mentions} people={g.people} />
    <MentionRecords data={fx.mentions} people={g.people} />
    <PerMil data={fx.mentions.perMil} people={g.people} />
    <Awards awards={fx.awards} people={g.people} nicknames={fx.nicknames} />
  </main>
);

/**
 * Elements a visitor would not see: inline opacity 0 or a zero scale (GSAP/Motion
 * start states), `data-hidden` (CSS opacity 0), and the CSS-only start states that
 * stay hidden unless an ancestor carries `data-static` (Hero bubbles, Bruno bars,
 * poll fills). CSS modules are not applied in jsdom, so those are checked by marker.
 */
function hiddenElements(root: HTMLElement): string[] {
  const out: string[] = [];
  const describe = (el: Element) => `<${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}">`;
  root.querySelectorAll<HTMLElement | SVGElement>("*").forEach((el) => {
    const { opacity, transform } = el.style;
    if (opacity === "0") out.push(`opacity 0: ${describe(el)}`);
    if (/scale[XY3d]*\(\s*0(\s*[,)])/.test(transform)) out.push(`scale 0: ${describe(el)}`);
    if (el.hasAttribute("data-hidden")) out.push(`data-hidden: ${describe(el)}`);
    if (el.tagName.toLowerCase() === "circle" && el.getAttribute("r") === "0") out.push(`r=0: ${describe(el)}`);
  });
  const needsStatic = ["[data-bubble]", "[data-bar]", "[class*='fill']"];
  root.querySelectorAll(needsStatic.join(",")).forEach((el) => {
    if (!el.closest("[data-static]")) out.push(`not static: ${describe(el)}`);
  });
  return out;
}

afterEach(() => {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  vi.unstubAllGlobals();
});

describe("prefers-reduced-motion across every section", () => {
  it.each([
    ["/", Home],
    ["/p/tomi", Profile],
    ["/multimedia, /emojis, /encuestas", MediaChapters],
    ["/ritmo, /menciones, /premios", LaterChapters],
  ])("%s shows every final state: nothing at opacity 0 or scale 0", (_, Page) => {
    mockReducedMotion(true);
    const { container } = render(<Page />);
    expect(hiddenElements(container)).toEqual([]);
  });

  it("creates no scroll pins under reduced motion, even on desktop", () => {
    mockMedia({ width: 1440, hover: true, reduced: true });
    render(<Home />);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it("the detector is not vacuous: with motion on, start states are hidden", () => {
    mockReducedMotion(false);
    const { container } = render(<Home />);
    expect(hiddenElements(container).length).toBeGreaterThan(0);
  });
});

describe("globals.css reduced-motion rule", () => {
  it("zeroes delays as well as durations, so staggered final states land at once", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(`${process.cwd()}/src/app/globals.css`, "utf8");
    const rule = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)![1]!;
    expect(rule).toContain("transition-delay: 0s !important");
    expect(rule).toContain("animation-delay: 0s !important");
  });
});
