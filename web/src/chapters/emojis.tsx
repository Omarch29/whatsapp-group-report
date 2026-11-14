import { copy } from "../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { Block } from "@/components/report/Block";
import { ChapterPager } from "@/components/report/ChapterPager";
import { ByYear } from "@/components/sections/emojis/ByYear";
import { Signature } from "@/components/sections/emojis/Signature";
import { Top } from "@/components/sections/emojis/Top";
import { chapterById } from "@/lib/chapters";
import { loadEmojis, loadFacts, loadGlobal } from "@/lib/data";
import { mostConstant, yearLeaders, yearRecord } from "@/lib/emojis";
import styles from "./chapter.module.css";
import { signatureLede, signatureRecord } from "./shared";

export default async function Emojis() {
  const [g, emojis, { thresholds }] = await Promise.all([loadGlobal(), loadEmojis(), loadFacts()]);
  const { people } = g;
  const title = (id: string) => chapterById("emojis").blocks.find((b) => b.id === id)!.title;
  const e = copy.emojis;

  const first = emojis.top[0];

  const years = emojis.byYear.length;
  const { leaders, most } = yearLeaders(emojis.byYear);
  const constant = mostConstant(emojis.byYear);
  const byYearLede = most
    ? [
        most.years > 1 ? e.ledYearsLede(most.e, most.years, years) : e.leadersLede(leaders),
        constant && constant.years > 1 && constant.e !== (most.years > 1 ? most.e : null)
          ? e.constantLede(constant.e, constant.years, years)
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : copy.empty;
  const yearTop = yearRecord(emojis.byYear);

  return (
    <main className={styles.chapter}>
      <h2 className={styles.heading}>{chapterById("emojis").title}</h2>

      <Block
        id="top"
        title={title("top")}
        lede={first ? e.topLede(first.e, first.n) : copy.empty}
        criterion={e.topCriterion}
        record={
          first && (
            <RecordPair
              label={e.topRecord.label}
              record={{
                value: first.n,
                unit: e.topRecord.unit(first.n),
                who: first.topUser ?? undefined,
                when: "",
                whenLabel: first.topUser ? e.topRecord.who : e.topRecord.everyone,
              }}
              caption={first.e}
              people={people}
            />
          )
        }
      >
        <Top data={emojis.top} people={people} />
      </Block>

      <Block
        id="signature"
        title={title("signature")}
        lede={signatureLede(emojis.signature, people)}
        criterion={e.signatureCriterion(thresholds.signatureMinOwn)}
        record={signatureRecord(emojis.signature, people)}
      >
        <Signature data={emojis.signature} people={people} />
      </Block>

      <Block
        id="by-year"
        title={title("by-year")}
        lede={byYearLede}
        criterion={e.byYearCriterion}
        record={
          yearTop && (
            <RecordPair
              label={e.yearRecord.label}
              record={{
                value: yearTop.n,
                unit: e.yearRecord.unit(yearTop.n),
                when: `${yearTop.year}-01-01`,
                whenLabel: e.yearRecord.when(yearTop.year),
              }}
              caption={yearTop.e}
              people={people}
            />
          )
        }
      >
        <ByYear data={emojis.byYear} />
      </Block>

      <ChapterPager id="emojis" />
    </main>
  );
}
