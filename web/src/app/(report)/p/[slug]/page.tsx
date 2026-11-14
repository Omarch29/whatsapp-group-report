import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { copy } from "../../../../../content/copy";
import { BackLink, PersonHeader } from "@/components/PersonHeader";
import { Block } from "@/components/report/Block";
import { Painted } from "@/components/report/Painted";
import { PersonAwards } from "@/components/sections/awards/PersonAwards";
import { Dictionary } from "@/components/sections/Dictionary";
import { Signature } from "@/components/sections/emojis/Signature";
import { Events } from "@/components/sections/Events";
import { Heatmap } from "@/components/sections/Heatmap";
import { Hero } from "@/components/sections/Hero";
import { Laughed } from "@/components/sections/language/Laughed";
import { Laughs } from "@/components/sections/language/Laughs";
import { Muletillas } from "@/components/sections/language/Muletillas";
import { Repeated } from "@/components/sections/language/Repeated";
import { Kinds } from "@/components/sections/media/Kinds";
import { Matrix } from "@/components/sections/mentions/Matrix";
import { Pairs } from "@/components/sections/Pairs";
import { Race } from "@/components/sections/Race";
import { Records } from "@/components/sections/Records";
import { Latency } from "@/components/sections/rhythm/Latency";
import { personAwards } from "@/lib/awards";
import { PROFILE_BLOCKS, SINGLE_PLACEHOLDER } from "@/lib/chapters";
import { listPeopleSlugs, loadAwards, loadEmojis, loadEvents, loadFacts, loadGlobal, loadLanguage, loadLore, loadMedia, loadMode, loadMentions, loadNicknames, loadPerson, loadRecords, loadRhythm } from "@/lib/data";
import { laughTotal, personName, topLaughClass } from "@/lib/language";
import { kindGroups, topKind } from "@/lib/media";
import { mentionsOf } from "@/lib/mentions";
import { nicknameFor } from "@/lib/nicknames";
import styles from "./page.module.css";

/** One static page per profiled person; anything else is a 404, never generated. Single mode has no profiles. */
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // Single mode has no profiles, but Next 16 refuses an empty list under `output: "export"` ("at least one route
  // must be generated"). The one placeholder param, "_", is no person: the page below answers it with
  // notFound(), so the export only holds Next's 404 for it.
  if ((await loadMode()) === "single") return [{ slug: SINGLE_PLACEHOLDER }];
  return (await listPeopleSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const g = await loadGlobal();
  const person = g.people.find((p) => p.slug === slug);
  return person ? { title: `${person.name} · ${g.title}` } : {};
}

const title = (id: string) => PROFILE_BLOCKS.find((b) => b.id === id)!.title;

export default async function Profile({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  if (!(await listPeopleSlugs()).includes(slug)) notFound();

  // A listed slug whose file is missing or invalid is a data bug: let it fail the build.
  // Client charts get only this person's slice of the chapter data, so the page ships no one else's.
  const [g, data, events, records, lore, lang, media, emojis, rhythm, mentions, awards, nicknames, { thresholds }] = await Promise.all([
    loadGlobal(),
    loadPerson(slug),
    loadEvents(),
    loadRecords(),
    loadLore(),
    loadLanguage(),
    loadMedia(),
    loadEmojis(),
    loadRhythm(),
    loadMentions(),
    loadAwards(),
    loadNicknames(),
    loadFacts(),
  ]);
  const person = g.people.find((p) => p.slug === slug);
  if (!person) notFound();
  const { name } = person;
  const nick = nicknameFor(nicknames, name);
  const { people } = g;
  const p = copy.profile;
  const me = [slug];
  const painted = (text: string) => <Painted text={text} who={me} people={people} />;

  // Frases que otros le repitieron
  const repeated = lang.repeated[slug] ?? [];
  const repeatedLede =
    repeated.length > 0
      ? p.repeatedLede(name, repeated.length, Math.max(...repeated.map((r) => r.times)))
      : p.repeatedEmpty(name);

  // La que más hizo reír
  const laughed = lang.laughed[slug] ?? null;
  const laughedLede = laughed ? p.laughedLede(name, laughed.laughs, laughed.people) : p.laughedEmpty(name);

  // Cómo se ríe: the chapter chart, with only this person's row
  const laughs = { ...lang.laughs, byPerson: lang.laughs.byPerson.filter((r) => r.slug === slug) };
  const laughRow = laughs.byPerson[0];
  const laughTop = laughRow ? topLaughClass(laughRow.mix) : null;
  const laughsLede =
    laughRow && laughTop
      ? p.laughsLede(name, laughTop.label, laughTop.n / laughTotal(laughRow.mix), laughRow.avgJa)
      : p.laughsEmpty(name);

  // Su emoji
  const signature = emojis.signature.find((s) => s.slug === slug);
  const signatureLede = signature ? p.signatureLede(name, signature.e, signature.ratio) : p.signatureEmpty(name);

  // Qué manda
  const kindLabel = (kind: string) => copy.media.kindLabels[kind] ?? kind;
  const kindsRow = media.kinds.byPerson.filter((r) => r.slug === slug);
  const ownKind = topKind({ kinds: media.kinds.kinds, byPerson: kindsRow });
  const kindsLede = ownKind && ownKind.n > 0 ? p.kindsLede(name, kindLabel(ownKind.kind), ownKind.n) : p.kindsEmpty(name);
  const folded = kindGroups(media.kinds.kinds).other.map(kindLabel).join(", ");

  // Menciones
  const { to, by } = mentionsOf(mentions, slug);
  const named = (r: { slug: string; n: number } | undefined) => (r ? { name: personName(r.slug, people), n: r.n } : null);
  const mentionsLede = p.mentionsLede(name, named(to[0]), named(by[0]));
  const mentionsWho = [slug, to[0]?.slug, by[0]?.slug].filter((s) => s !== undefined);
  // The two bar lists read only the matrix: the message samples (the whole group's) stay off the page.
  const mentionsSlice = { ...mentions, samples: {} };

  // Cuánto tarda en contestar: without replies to measure, the chart says so (no lede to repeat it)
  const latency = rhythm.latency.find((l) => l.slug === slug);

  // Premios
  const { won, finalist } = personAwards(awards, slug);

  return (
    <main>
      <PersonHeader person={person} nick={nick} />
      <Hero
        total={data.msgs}
        daysActive={data.activeDays}
        bubbles={[...copy.hero.bubbles]}
        person={{ name, nick }}
      />
      <Race
        blockId="race"
        months={g.monthly.months}
        series={g.monthly.series}
        people={people}
        highlight={slug}
        lede={p.raceLede(name)}
        autoplay
      />
      <Heatmap blockId="heatmap" group={data.heatmap} lede={p.heatmapLede(name)} />
      <Pairs blockId="graph" people={people} edges={g.edges} focus={slug} lede={p.pairsLede(name)} />
      <Records data={records} people={people} person={data} />
      <Dictionary blockId="cloud" terms={lore} people={people} highlight={slug} lede={p.dictionaryLede(name)} />
      <Events blockId="rail" events={events} filterSlug={slug} lede={p.eventsLede(name)} />

      <div className={styles.blocks}>
        {/* The lede follows the person's own top phrase, so the chart renders it (and the criterion after it). */}
        <Block id="muletillas" title={title("muletillas")}>
          <Muletillas data={{ [slug]: lang.muletillas[slug] ?? [] }} people={people} person={slug} criterion={copy.language.muletillasCriterion} />
        </Block>

        <Block
          id="repeated"
          title={title("repeated")}
          lede={painted(repeatedLede)}
          criterion={copy.language.repeatedCriterion(thresholds.quoteMinTimes)}
        >
          <Repeated data={{ [slug]: repeated }} people={people} person={slug} />
        </Block>

        <Block id="laughed" title={title("laughed")} lede={painted(laughedLede)} criterion={copy.language.laughedCriterion(thresholds.funnyMinLaughs)}>
          <Laughed data={{ [slug]: laughed }} people={people} person={slug} />
        </Block>

        <Block id="laughs" title={title("laughs")} lede={painted(laughsLede)} criterion={copy.language.laughsCriterion}>
          <Laughs data={laughs} people={people} />
        </Block>

        <Block
          id="signature"
          title={title("signature")}
          lede={painted(signatureLede)}
          criterion={copy.emojis.signatureCriterion(thresholds.signatureMinOwn)}
        >
          <Signature data={emojis.signature} people={people} person={slug} />
        </Block>

        <Block id="kinds" title={title("kinds")} lede={painted(kindsLede)} criterion={copy.media.kindsCriterion(folded)}>
          <Kinds data={media.kinds} people={people} person={slug} />
        </Block>

        <Block
          id="mentions"
          title={title("mentions")}
          lede={<Painted text={mentionsLede} who={mentionsWho} people={people} />}
          criterion={copy.mentions.matrixCriterion}
        >
          <Matrix data={mentionsSlice} people={people} person={slug} />
        </Block>

        <Block
          id="latency"
          title={title("latency")}
          lede={latency ? painted(p.latencyLede(name, latency.medianFromSec, latency.medianToSec)) : undefined}
          criterion={copy.rhythm.latencyCriterion(thresholds.fastestMinReplies)}
        >
          <Latency data={rhythm.latency} people={people} person={slug} minuteResolution={g.timeResolution === "minute"} />
        </Block>

        <Block
          id="premios"
          title={title("premios")}
          lede={painted(p.awardsLede(name, won.length, finalist.length))}
          criterion={p.awardsCriterion}
        >
          <PersonAwards awards={awards} slug={slug} />
        </Block>
      </div>

      <footer className={styles.footer}>
        <BackLink />
      </footer>
    </main>
  );
}
