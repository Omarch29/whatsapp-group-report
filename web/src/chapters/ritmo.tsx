import { copy } from "../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { Block } from "@/components/report/Block";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Painted } from "@/components/report/Painted";
import { FastestPair, Latency } from "@/components/sections/rhythm/Latency";
import { Rings } from "@/components/sections/rhythm/Rings";
import { StartersKillers } from "@/components/sections/rhythm/StartersKillers";
import { Streaks } from "@/components/sections/rhythm/Streaks";
import { chapterById } from "@/lib/chapters";
import { loadFacts, loadGlobal, loadRhythm } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { personName } from "@/lib/language";
import { peakIndex, RESTO } from "@/lib/media";
import { longestSilence, longestStreak } from "@/lib/rhythm";
import chapter from "./chapter.module.css";
import styles from "./ritmo.module.css";

export default async function Ritmo() {
  const [g, rhythm, facts] = await Promise.all([loadGlobal(), loadRhythm(), loadFacts()]);
  const { people } = g;
  const title = (id: string) => chapterById("ritmo").blocks.find((b) => b.id === id)!.title;
  const nameOf = (slug: string) => personName(slug, people);
  const r = copy.rhythm;

  // Starters and killers
  const starter = facts.startersTop;
  const killer = facts.killersTop;
  const startersLede =
    starter && killer ? r.startersLede(nameOf(starter.slug), starter.n, nameOf(killer.slug), killer.n) : copy.empty;

  // Latency
  const fastest = facts.fastest;
  const latencyLede = fastest ? r.latencyLede(nameOf(fastest.slug), fastest.medianFromSec) : copy.empty;
  const pair = rhythm.fastest;

  // Streaks
  const streak = longestStreak(rhythm.streaks);
  const silence = longestSilence(rhythm.streaks);
  const streaksLede =
    streak && silence
      ? r.streaksLede(nameOf(streak.slug), streak.streak.days, nameOf(silence.slug), silence.silence.days)
      : copy.empty;

  // Rings
  const peakDow = peakIndex(rhythm.rings.dow);
  const peakMonth = peakIndex(rhythm.rings.month);
  const dowMsgs = rhythm.rings.dow[peakDow] ?? 0;
  const monthMsgs = rhythm.rings.month[peakMonth] ?? 0;
  // Lede and record share one guard: a busiest weekday with messages.
  const dowName = dowMsgs > 0 ? copy.dow[peakDow] : undefined;
  const ringsLede =
    dowName && monthMsgs > 0 ? r.ringsLede(dowName, dowMsgs, copy.months[peakMonth]!, monthMsgs) : copy.empty;

  return (
    <main className={chapter.chapter}>
      <h2 className={chapter.heading}>{chapterById("ritmo").title}</h2>

      <Block
        id="starters-killers"
        title={title("starters-killers")}
        lede={
          <Painted
            text={startersLede}
            who={[starter?.slug, killer?.slug].filter((s) => s !== undefined)}
            people={people}
          />
        }
        criterion={r.startersCriterion}
        record={
          starter && (
            <RecordPair
              label={r.startersRecord.label}
              record={{ value: starter.n, unit: r.startersRecord.unit(starter.n), who: starter.slug, when: "", whenLabel: r.startersRecord.when }}
              people={people}
            />
          )
        }
      >
        <StartersKillers starters={rhythm.starters} killers={rhythm.killers} people={people} />
      </Block>

      <Block
        id="latency"
        title={title("latency")}
        lede={<Painted text={latencyLede} who={fastest ? [fastest.slug] : []} people={people} />}
        criterion={r.latencyCriterion(facts.thresholds.fastestMinReplies)}
        record={
          pair && (
            <div className={styles.recordStack}>
              <FastestPair fastest={pair} people={people} />
              <RecordPair
                label={r.fastest.label}
                record={{
                  value: pair.seconds,
                  unit: r.fastest.unit,
                  who: pair.b.who === RESTO ? undefined : pair.b.who,
                  when: pair.b.when,
                }}
                caption={r.fastest.caption(nameOf(pair.a.who))}
                people={people}
              />
            </div>
          )
        }
      >
        <Latency data={rhythm.latency} people={people} minuteResolution={g.timeResolution === "minute"} />
      </Block>

      <Block
        id="streaks"
        title={title("streaks")}
        lede={
          <Painted
            text={streaksLede}
            who={[streak?.slug, silence?.slug].filter((s) => s !== undefined)}
            people={people}
          />
        }
        criterion={r.streaksCriterion}
        record={
          streak && (
            <RecordPair
              label={r.streakRecord.label}
              record={{
                value: streak.streak.days,
                unit: r.streakRecord.unit(streak.streak.days),
                who: streak.slug,
                when: streak.streak.from,
              }}
              caption={r.streakRecord.caption(fmtDate(streak.streak.to))}
              people={people}
            />
          )
        }
      >
        <Streaks data={rhythm.streaks} people={people} />
      </Block>

      <Block
        id="rings"
        title={title("rings")}
        lede={ringsLede}
        criterion={r.ringsCriterion}
        record={
          dowName && (
            <RecordPair
              label={r.ringsRecord.label}
              record={{
                value: dowMsgs,
                unit: r.ringsRecord.unit(dowMsgs),
                when: "",
                whenLabel: r.ringsRecord.when(copy.dowPlural[peakDow]!),
              }}
              caption={r.ringsRecord.caption}
              people={people}
            />
          )
        }
      >
        <Rings data={rhythm.rings} />
      </Block>

      <ChapterPager id="ritmo" />
    </main>
  );
}
