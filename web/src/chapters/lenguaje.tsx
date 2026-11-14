import { copy } from "../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { Block } from "@/components/report/Block";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Painted } from "@/components/report/Painted";
import { Badwords, BadwordsRecord } from "@/components/sections/language/Badwords";
import { Laughed } from "@/components/sections/language/Laughed";
import { Laughs, LaughsRecord } from "@/components/sections/language/Laughs";
import { Muletillas } from "@/components/sections/language/Muletillas";
import { Repeated } from "@/components/sections/language/Repeated";
import { Style, StyleRecord } from "@/components/sections/language/Style";
import { chapterById } from "@/lib/chapters";
import { listPeopleSlugs, loadFacts, loadGlobal, loadLanguage, loadPerson, loadRecords } from "@/lib/data";
import { CAPTION_CHARS, clip, longestJaja, longestWriter, personName, topBadwords, topLaughed } from "@/lib/language";
import styles from "./chapter.module.css";

export default async function Lenguaje() {
  const [g, lang, records, slugs, { thresholds }] = await Promise.all([
    loadGlobal(),
    loadLanguage(),
    loadRecords(),
    listPeopleSlugs(),
    loadFacts(),
  ]);
  const { people } = g;
  const title = (id: string) => chapterById("lenguaje").blocks.find((b) => b.id === id)!.title;
  const nameOf = (slug: string) => personName(slug, people);
  const l = copy.language;

  const rep = lang.top.repeated;
  const repeatedLede = rep
    ? l.repeatedLede(nameOf(rep.slug), clip(rep.text, CAPTION_CHARS), rep.times, rep.people)
    : l.repeatedLedeEmpty;

  const laughed = topLaughed(lang.laughed);
  const laughedLede = laughed
    ? l.laughedLede(nameOf(laughed.slug), laughed.laughs, laughed.people)
    : l.laughedLedeEmpty;

  const swearer = topBadwords(lang.badwords.byPerson);
  const badwordsLede = swearer
    ? l.badwordsLede(nameOf(swearer.slug), lang.badwords.total, swearer.perMil)
    : l.badwordsLedeEmpty;

  const writer = longestWriter(lang.style);
  // Style's record is the concrete longest message, counted as the Records chapter does:
  // the text is cleaned (mentions shortened), so the counted length lives in that person's file.
  const longest = records.messageLength.record;
  const longestValue = slugs.includes(longest.who)
    ? (await loadPerson(longest.who)).records.longest.value
    : longest.text.length;
  const styleLede = writer ? l.styleLede(nameOf(writer.slug), writer.avgChars) : copy.empty;

  const jaja = longestJaja(lang.laughs.byPerson);
  const laughsLede = jaja ? l.laughsLede(nameOf(jaja.slug), jaja.avgJa) : l.laughsLedeEmpty;

  return (
    <main className={styles.chapter}>
      <h2 className={styles.heading}>{chapterById("lenguaje").title}</h2>

      {/* The lede follows the chip selection, so the chart renders it (and the criterion after it). */}
      <Block id="muletillas" title={title("muletillas")}>
        <Muletillas data={lang.muletillas} people={people} top={lang.top.muletilla} criterion={l.muletillasCriterion} />
      </Block>

      <Block
        id="repeated"
        title={title("repeated")}
        lede={<Painted text={repeatedLede} who={rep ? [rep.slug] : []} people={people} />}
        criterion={l.repeatedCriterion(thresholds.quoteMinTimes)}
        record={
          rep && (
            <RecordPair
              label={l.topRepeated.label}
              record={{ value: rep.times, unit: l.topRepeated.unit(rep.times), who: rep.slug, when: rep.when }}
              caption={copy.quote(clip(rep.text, CAPTION_CHARS))}
              people={people}
            />
          )
        }
      >
        <Repeated data={lang.repeated} people={people} />
      </Block>

      <Block
        id="laughed"
        title={title("laughed")}
        lede={<Painted text={laughedLede} who={laughed ? [laughed.slug] : []} people={people} />}
        criterion={l.laughedCriterion(thresholds.funnyMinLaughs)}
        record={
          laughed && (
            <RecordPair
              label={l.topLaughed.label}
              record={{ value: laughed.laughs, unit: l.topLaughed.unit(laughed.laughs), who: laughed.slug, when: laughed.when }}
              caption={copy.quote(clip(laughed.text, CAPTION_CHARS))}
              people={people}
            />
          )
        }
      >
        <Laughed data={lang.laughed} people={people} />
      </Block>

      <Block
        id="badwords"
        title={title("badwords")}
        lede={<Painted text={badwordsLede} who={swearer ? [swearer.slug] : []} people={people} />}
        criterion={l.badwordsCriterion}
        record={<BadwordsRecord record={lang.badwords.record} people={people} />}
      >
        <Badwords data={lang.badwords} people={people} />
      </Block>

      <Block
        id="style"
        title={title("style")}
        lede={<Painted text={styleLede} who={writer ? [writer.slug] : []} people={people} />}
        criterion={l.styleCriterion}
        record={<StyleRecord record={longest} value={longestValue} people={people} />}
      >
        <Style data={lang.style} people={people} />
      </Block>

      <Block
        id="laughs"
        title={title("laughs")}
        lede={<Painted text={laughsLede} who={jaja ? [jaja.slug] : []} people={people} />}
        criterion={l.laughsCriterion}
        record={<LaughsRecord record={lang.laughs.record} people={people} />}
      >
        <Laughs data={lang.laughs} people={people} />
      </Block>

      <ChapterPager id="lenguaje" />
    </main>
  );
}
