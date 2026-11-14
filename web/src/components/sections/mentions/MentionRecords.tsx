import { copy } from "../../../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import type { MentionsData, Person } from "@/lib/schema";
import styles from "./MentionRecords.module.css";

type Props = { data: Pick<MentionsData, "mostMentioned" | "topTagger">; people: Person[] };

const m = copy.mentions;

/** The most mentioned and the top tagger as two big records side by side; each counts up on view. */
export function MentionRecords({ data, people }: Props) {
  const cards = [
    { key: "mostMentioned", c: m.mostMentioned, r: data.mostMentioned },
    { key: "topTagger", c: m.topTagger, r: data.topTagger },
  ].filter((x) => x.r !== null);
  if (cards.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  return (
    <div className={styles.wrap}>
      <div className={styles.records}>
        {cards.map(({ key, c, r }) => (
          <div key={key} data-testid="mention-record">
            <RecordPair
              label={c.label}
              record={{ value: r!.n, unit: c.unit(r!.n), who: r!.slug, when: "", whenLabel: c.when }}
              people={people}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
