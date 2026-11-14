import { notFound } from "next/navigation";
import { copy } from "../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { Block } from "@/components/report/Block";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Painted } from "@/components/report/Painted";
import { ByPerson } from "@/components/sections/polls/ByPerson";
import { TopPolls } from "@/components/sections/polls/TopPolls";
import { chapterById } from "@/lib/chapters";
import { loadFacts, loadGlobal, loadPolls } from "@/lib/data";
import { fmtShare } from "@/lib/format";
import { CAPTION_CHARS, clip, personName } from "@/lib/language";
import { RESTO, top } from "@/lib/media";
import styles from "./chapter.module.css";

export default async function Encuestas() {
  const [g, polls, facts] = await Promise.all([loadGlobal(), loadPolls(), loadFacts()]);
  if (polls.total === 0) notFound(); // no polls in the chat: the chapter is switched off
  const { people } = g;
  const title = (id: string) => chapterById("encuestas").blocks.find((b) => b.id === id)!.title;
  const p = copy.polls;

  const creator = top(polls.byPerson, (r) => r.n);
  const byPersonLede = creator ? p.byPersonLede(polls.total, personName(creator.slug, people), creator.n) : copy.empty;

  const voted = polls.mostVoted[0];
  const question = voted && clip(voted.question, CAPTION_CHARS);

  return (
    <main className={styles.chapter}>
      <h2 className={styles.heading}>{chapterById("encuestas").title}</h2>

      <Block
        id="by-person"
        title={title("by-person")}
        lede={<Painted text={byPersonLede} who={creator ? [creator.slug] : []} people={people} />}
        criterion={p.byPersonCriterion}
        record={
          creator && (
            <RecordPair
              label={p.creator.label}
              record={{
                value: creator.n,
                unit: p.creator.unit(creator.n),
                who: creator.slug,
                when: "",
                whenLabel: p.creator.share(fmtShare(polls.total > 0 ? creator.n / polls.total : 0)),
              }}
              people={people}
            />
          )
        }
      >
        <ByPerson data={polls} people={people} />
      </Block>

      <Block
        id="top"
        title={title("top")}
        lede={voted ? p.topLede(question!, voted.totalVotes) : copy.empty}
        criterion={p.topCriterion(facts.thresholds.pollMinVotes)}
        record={
          voted && (
            <RecordPair
              label={p.topRecord.label}
              record={{
                value: voted.totalVotes,
                unit: p.topRecord.unit(voted.totalVotes),
                // Someone without a profile stays unnamed: the caption starts at the date.
                who: voted.who === RESTO ? undefined : voted.who,
                when: voted.when,
              }}
              caption={copy.quote(question)}
              people={people}
            />
          )
        }
      >
        <TopPolls data={polls} people={people} />
      </Block>

      <ChapterPager id="encuestas" />
    </main>
  );
}
