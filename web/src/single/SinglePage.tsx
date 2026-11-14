import { Fragment, type ReactNode } from "react";
import { copy } from "../../content/copy";
import chapterStyles from "@/chapters/chapter.module.css";
import { heatPeak, heatPeople, loadRecordLength, raceLede, signatureLede, signatureRecord, timelineLede } from "@/chapters/shared";
import { Block } from "@/components/report/Block";
import { Awards } from "@/components/sections/awards/Awards";
import { NameRecords, Timeline } from "@/components/sections/census/Timeline";
import { Conclusion } from "@/components/sections/Conclusion";
import { Signature } from "@/components/sections/emojis/Signature";
import { Heatmap } from "@/components/sections/Heatmap";
import { Hero } from "@/components/sections/Hero";
import { Muletillas } from "@/components/sections/language/Muletillas";
import { Pairs } from "@/components/sections/Pairs";
import { Race } from "@/components/sections/Race";
import { Records } from "@/components/sections/Records";
import type { ChapterId } from "@/chapters";
import { chapterById, type BlockRef } from "@/lib/chapters";
import { loadConclusion } from "@/lib/conclusion";
import {
  listPeopleSlugs,
  loadAwards,
  loadCensus,
  loadDepartures,
  loadEmojis,
  loadFacts,
  loadGlobal,
  loadLanguage,
  loadNicknames,
  loadPerson,
  loadRecords,
} from "@/lib/data";

/** One section of the long page: the anchors it renders (in page order) and the section itself. */
export type SingleSection = { blocks: BlockRef[]; node: ReactNode };

/**
 * A block of a chapter, under its chapter title in the build's language. `heading` replaces that title when the
 * section's component prints a heading of its own (the long page has no chapter titles, so the index must read what
 * the page shows).
 */
const blockOf = (chapter: ChapterId, id: string, heading?: string): BlockRef => {
  const block = chapterById(chapter).blocks.find((b) => b.id === id)!;
  return heading ? { ...block, title: heading } : block;
};

/** Records parts on the long page, with their chapter block ids and the heading each prints; the night only when the chat has one. */
const RECORD_PARTS = [
  ["length", "length", copy.records.length.label],
  ["perDay", "per-day", copy.records.perDay.label],
  ["night", "night", copy.records.latestNightTitle],
] as const;

/**
 * The single page's sections in reading order, each fed as its chapter feeds it, minus the ones whose data is empty.
 * The page renders these and the floating index lists their `blocks`, so the two cannot disagree. None of the
 * optional chapters (`chapterFlagsOf`: departures, polls, mentions, audios) is on this page, so no flag removes a block.
 */
export async function loadSingleSections(): Promise<SingleSection[]> {
  const [g, census, facts, departures, slugs, lang, emojis, records, awards, nicknames, paragraphs] = await Promise.all([
    loadGlobal(),
    loadCensus(),
    loadFacts(),
    loadDepartures(),
    listPeopleSlugs(),
    loadLanguage(),
    loadEmojis(),
    loadRecords(),
    loadAwards(),
    loadNicknames(),
    loadConclusion(),
  ]);
  const { people, period } = g;
  const { thresholds } = facts;
  const profiles = await Promise.all(slugs.map((s) => loadPerson(s)));
  const sections: SingleSection[] = [];
  const add = (present: boolean, blocks: BlockRef[], node: ReactNode) => {
    if (present) sections.push({ blocks, node });
  };
  /**
   * A Block-wrapped section gets the chapter column, as on its chapter page. Its Block takes `level={2}`: on the long
   * page every section is top-level, like the Race, Heatmap, Pairs and Records sections, whose headings are h2.
   */
  const column = (node: ReactNode) => <div className={chapterStyles.chapter}>{node}</div>;

  add(true, [blockOf("", "intro")],
    <Hero blockId="intro" total={g.totals.msgs} daysActive={g.totals.daysActive} bubbles={[...copy.hero.bubbles]} />,
  );

  // Censo: the timeline. Its milestones link to profiles and chapters (pipeline hrefs) that this export does not have:
  // without an href a milestone renders as plain text, and no route name reaches the page.
  const milestones = census.timeline.map((t) => ({ ...t, href: null }));
  const timeline = blockOf("censo", "timeline");
  add(census.timeline.length > 0, [timeline], column(
    <Block
      id={timeline.id}
      title={timeline.title}
      level={2}
      lede={timelineLede(census, period)}
      criterion={copy.census.timelineCriterion}
      record={<NameRecords names={census.names} />}
    >
      <Timeline items={milestones} period={period} people={people} />
    </Block>,
  ));

  add(true, [blockOf("carrera", "race", copy.race.title)],
    <Race
      blockId="race"
      months={g.monthly.months}
      series={g.monthly.series}
      people={people}
      lede={raceLede(departures, facts)}
      criterion={copy.race.criterion}
      copyLink
    />,
  );

  add(true, [blockOf("horas", "heatmap", copy.heatmap.title)],
    <Heatmap
      blockId="heatmap"
      group={g.heatmap}
      people={heatPeople(profiles, people)}
      lede={copy.heatmap.lede}
      peak={heatPeak(facts)}
      criterion={copy.heatmap.criterion}
      copyLink
    />,
  );

  add(true, [blockOf("parejas", "graph", copy.pairs.title)],
    <Pairs blockId="graph" people={people} edges={g.edges} lede={copy.pairs.lede} criterion={copy.pairs.criterion} copyLink />,
  );

  const muletillas = blockOf("lenguaje", "muletillas");
  add(Object.values(lang.muletillas).some((l) => l.length > 0), [muletillas], column(
    <Block id={muletillas.id} title={muletillas.title} level={2}>
      <Muletillas data={lang.muletillas} people={people} top={lang.top.muletilla} criterion={copy.language.muletillasCriterion} />
    </Block>,
  ));

  const signature = blockOf("emojis", "signature");
  add(emojis.signature.length > 0, [signature], column(
    <Block
      id={signature.id}
      title={signature.title}
      level={2}
      lede={signatureLede(emojis.signature, people)}
      criterion={copy.emojis.signatureCriterion(thresholds.signatureMinOwn)}
      record={signatureRecord(emojis.signature, people)}
    >
      <Signature data={emojis.signature} people={people} />
    </Block>,
  ));

  const recordLength = await loadRecordLength(records, slugs);
  const parts = RECORD_PARTS.filter(([part]) => part !== "night" || records.latestNight !== null);
  add(true, parts.map(([, id, heading]) => blockOf("records", id, heading)),
    <Records
      blockIds={Object.fromEntries(parts.map(([part, id]) => [part, id]))}
      parts={parts.map(([part]) => part)}
      data={records}
      people={people}
      recordLength={recordLength}
      criteria={copy.records.criterion}
      copyLinks
      headedParts
    />,
  );

  const awardsBlock = blockOf("premios", "awards");
  add(awards.length > 0, [awardsBlock], column(
    <Block id={awardsBlock.id} title={awardsBlock.title} level={2} lede={copy.awards.lede(facts.awardsCount)} criterion={copy.awards.criterion}>
      <Awards awards={awards} people={people} nicknames={nicknames} />
    </Block>,
  ));

  const text = blockOf("conclusion", "text");
  add(true, [text], column(
    <Block id={text.id} title={text.title} level={2}>
      <Conclusion paragraphs={paragraphs} facts={facts} />
    </Block>,
  ));

  return sections;
}

/** The floating index's items: every anchor of `sections`, in page order. */
export function indexOf(sections: readonly SingleSection[]): BlockRef[] {
  return sections.flatMap((s) => s.blocks);
}

/** The single-page report: the sections of `loadSingleSections`, one after another, with no pager. */
export function SinglePage({ sections }: { sections: readonly SingleSection[] }) {
  return (
    <main>
      {sections.map((s) => (
        <Fragment key={s.blocks[0]!.id}>{s.node}</Fragment>
      ))}
    </main>
  );
}
