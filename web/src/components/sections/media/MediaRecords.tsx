import { copy } from "../../../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { fmtDate } from "@/lib/format";
import { personName } from "@/lib/language";
import type { Person, RecordsData } from "@/lib/schema";
import styles from "./MediaRecords.module.css";

/** The three "el más …" records, in this order. */
export const RECORD_KINDS = ["sticker", "audio", "image"] as const;

type Props = { media: RecordsData["media"]; people: Person[] };

/** The top sender of each kind, as three big records side by side; each counts up on view. */
export function MediaRecords({ media, people }: Props) {
  const cards = RECORD_KINDS.flatMap((kind) => {
    const stat = media[kind];
    const top = stat?.byPerson[0];
    return stat && top ? [{ kind, stat, top }] : [];
  });
  if (cards.length === 0) return <p className={styles.empty}>{copy.empty}</p>;

  return (
    <div className={styles.wrap}>
      <div className={styles.records}>
        {cards.map(({ kind, stat, top }) => {
          const c = copy.media.records[kind]!;
          const day = stat.recordDay;
          return (
            <div key={kind} data-testid="media-record">
              <RecordPair
                label={c.label}
                record={{ value: top.n, unit: c.unit(top.n), who: top.slug, when: day.date, whenLabel: copy.media.inTotal }}
                caption={copy.media.peakDay(personName(day.who, people), day.n, fmtDate(day.date))}
                people={people}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
