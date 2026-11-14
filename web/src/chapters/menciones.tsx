import { notFound } from "next/navigation";
import { copy } from "../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { Block } from "@/components/report/Block";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Painted } from "@/components/report/Painted";
import { Matrix } from "@/components/sections/mentions/Matrix";
import { MentionRecords } from "@/components/sections/mentions/MentionRecords";
import { PerMil } from "@/components/sections/mentions/PerMil";
import { chapterById } from "@/lib/chapters";
import { loadGlobal, loadMentions } from "@/lib/data";
import { personName } from "@/lib/language";
import { top } from "@/lib/media";
import { topPair } from "@/lib/mentions";
import styles from "./chapter.module.css";

export default async function Menciones() {
  const [g, mentions] = await Promise.all([loadGlobal(), loadMentions()]);
  // Only exists when somebody was mentioned (chaptersFor drops it otherwise).
  if (mentions.mostMentioned === null) notFound();
  const { people } = g;
  const title = (id: string) => chapterById("menciones").blocks.find((b) => b.id === id)!.title;
  const nameOf = (slug: string) => personName(slug, people);
  const m = copy.mentions;

  const { mostMentioned: mm, topTagger: tagger } = mentions;
  const both = [mm?.slug, tagger?.slug].filter((s) => s !== undefined);
  // The matrix speaks for its biggest cell; the records block keeps the most mentioned and the top tagger.
  const pair = topPair(mentions);
  const matrixLede = pair ? m.matrixLede(nameOf(pair.from), nameOf(pair.to), pair.n) : copy.empty;
  const recordsLede = mm && tagger ? m.recordsLede(nameOf(mm.slug), mm.n, nameOf(tagger.slug), tagger.n) : copy.empty;

  const perMilTop = top(mentions.perMil, (p) => p.perMil);
  const perMilLede = perMilTop ? m.perMilLede(nameOf(perMilTop.slug), perMilTop.perMil) : copy.empty;

  return (
    <main className={styles.chapter}>
      <h2 className={styles.heading}>{chapterById("menciones").title}</h2>

      <Block
        id="matrix"
        title={title("matrix")}
        lede={<Painted text={matrixLede} who={pair ? [pair.from, pair.to] : []} people={people} />}
        criterion={m.matrixCriterion}
        record={
          pair && (
            <RecordPair
              label={m.pairRecord.label}
              record={{
                value: pair.n,
                unit: m.pairRecord.unit(pair.n),
                who: pair.from,
                when: "",
                whenLabel: m.pairRecord.when(nameOf(pair.to)),
              }}
              people={people}
            />
          )
        }
      >
        <Matrix data={mentions} people={people} />
      </Block>

      <Block
        id="records"
        title={title("records")}
        lede={<Painted text={recordsLede} who={both} people={people} />}
        criterion={m.recordsCriterion}
      >
        <MentionRecords data={mentions} people={people} />
      </Block>

      <Block
        id="per-mil"
        title={title("per-mil")}
        lede={<Painted text={perMilLede} who={perMilTop ? [perMilTop.slug] : []} people={people} />}
        criterion={m.perMilCriterion}
        record={
          perMilTop && (
            <RecordPair
              label={m.perMilRecord.label}
              record={{
                value: perMilTop.perMil,
                unit: m.perMilRecord.unit,
                who: perMilTop.slug,
                when: "",
                whenLabel: m.perMilRecord.when(perMilTop.n),
              }}
              people={people}
            />
          )
        }
      >
        <PerMil data={mentions.perMil} people={people} />
      </Block>

      <ChapterPager id="menciones" />
    </main>
  );
}
