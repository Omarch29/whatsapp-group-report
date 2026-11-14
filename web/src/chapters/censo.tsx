import { copy } from "../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { Block } from "@/components/report/Block";
import { Painted } from "@/components/report/Painted";
import { ChapterPager } from "@/components/report/ChapterPager";
import { ByYear } from "@/components/sections/census/ByYear";
import { HourOfEach, ShareRecords } from "@/components/sections/census/HourOfEach";
import { Tenure } from "@/components/sections/census/Tenure";
import { NameRecords, Timeline } from "@/components/sections/census/Timeline";
import { EARLY_HOURS, MIN_GAP_DAYS, OWL_HOURS, topPersonYear } from "@/lib/census";
import { chapterById } from "@/lib/chapters";
import { loadCensus, loadGlobal } from "@/lib/data";
import { fmtDate, fmtShortDate } from "@/lib/format";
import styles from "./chapter.module.css";
import { timelineLede } from "./shared";

export default async function Censo() {
  const [g, census] = await Promise.all([loadGlobal(), loadCensus()]);
  const { people, period } = g;
  const title = (id: string) => chapterById("censo").blocks.find((b) => b.id === id)!.title;
  const nameOf = (slug: string) => people.find((p) => p.slug === slug)?.name ?? slug;

  const { absence } = census;
  const tenureLede = absence ? copy.census.tenureLede(nameOf(absence.slug), absence.days) : copy.census.tenureLedeEmpty;

  const { years, series } = census.byYear;
  const yearTotals = years.map((_, i) => Object.values(series).reduce((acc, v) => acc + (v[i] ?? 0), 0));
  const top = yearTotals.reduce((best, v, i) => (v > (yearTotals[best] ?? -1) ? i : best), 0);
  const byYearLede = years.length ? copy.census.byYearLede(years[top]!, yearTotals[top]!) : copy.empty;

  const topYear = topPersonYear(census.byYear);

  const { earlyBird, owl } = census;
  const hourLede =
    earlyBird && owl
      ? copy.census.hourLede(nameOf(earlyBird.slug), earlyBird.share, nameOf(owl.slug), owl.share)
      : copy.census.hourLedeEmpty;

  return (
    <main className={styles.chapter}>
      <h2 className={styles.heading}>{chapterById("censo").title}</h2>

      <Block
        id="timeline"
        title={title("timeline")}
        lede={timelineLede(census, period)}
        criterion={copy.census.timelineCriterion}
        record={<NameRecords names={census.names} />}
      >
        <Timeline items={census.timeline} period={period} people={people} />
      </Block>

      <Block
        id="tenure"
        title={title("tenure")}
        lede={<Painted text={tenureLede} who={absence ? [absence.slug] : []} people={people} />}
        criterion={copy.census.tenureCriterion(MIN_GAP_DAYS)}
        record={
          absence && (
            <RecordPair
              label={copy.census.absence.label}
              record={{ value: absence.days, unit: copy.census.absence.unit(absence.days), who: absence.slug, when: absence.from }}
              caption={copy.census.absence.caption(fmtDate(absence.to))}
              people={people}
            />
          )
        }
      >
        <Tenure tenure={census.tenure} period={period} people={people} />
      </Block>

      <Block
        id="by-year"
        title={title("by-year")}
        lede={byYearLede}
        criterion={years.length ? copy.census.byYearCriterion(years.at(-1)!, fmtShortDate(period.to)) : undefined}
        record={
          topYear && (
            <RecordPair
              label={copy.census.topPersonYear.label}
              record={{
                value: topYear.value,
                unit: copy.census.topPersonYear.unit(topYear.value),
                who: topYear.slug,
                when: `${topYear.year}-01-01`,
                whenLabel: copy.census.topPersonYear.when(topYear.year),
              }}
              people={people}
            />
          )
        }
      >
        <ByYear data={census.byYear} people={people} />
      </Block>

      <Block
        id="hour-of-each"
        title={title("hour-of-each")}
        lede={
          <Painted text={hourLede} who={[earlyBird?.slug, owl?.slug].filter((s) => s !== undefined)} people={people} />
        }
        criterion={copy.census.hourCriterion(EARLY_HOURS[0], EARLY_HOURS[1], OWL_HOURS[0], OWL_HOURS[1])}
        record={<ShareRecords earlyBird={earlyBird} owl={owl} people={people} />}
      >
        <HourOfEach data={census.hourOfEach} people={people} />
      </Block>

      <ChapterPager id="censo" />
    </main>
  );
}
