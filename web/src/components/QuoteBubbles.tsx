import { copy } from "../../content/copy";
import { blockAnchor } from "@/lib/blockAnchor";
import type { DeparturesData, Person } from "@/lib/schema";
import styles from "./QuoteBubbles.module.css";

type Props = {
  quotes: DeparturesData["quotesRepeated"];
  attributed: DeparturesData["quotesAttributed"];
  people: Person[];
  /** Who the attributed quotes are pinned on. */
  name: string;
  /** Chapter block id for this section (anchor + sidebar spy); none on profiles. */
  blockId?: string;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Chat bubbles: what the group keeps repeating, and what gets pinned on `name`. */
export function QuoteBubbles({ quotes, attributed, people, name, blockId }: Props) {
  const nameOf = (slug: string) => people.find((p) => p.slug === slug)?.name ?? capitalize(slug);
  return (
    <div {...blockAnchor(blockId)} className={styles.quotes}>
      <section className={styles.col}>
        <h3 className={styles.title}>{copy.departures.quotesTitle}</h3>
        {quotes.map((q) => (
          <figure key={`${q.when}-${q.text}`} className={styles.bubble} data-testid="quote">
            <blockquote>{q.text}</blockquote>
            <figcaption className={styles.meta}>{copy.departures.quoteMeta(q.times, q.people)}</figcaption>
          </figure>
        ))}
      </section>
      <section className={styles.col}>
        <h3 className={styles.title}>{copy.departures.attributedTitle(name)}</h3>
        {attributed.map((q) => (
          <figure
            key={`${q.when}-${q.text}`}
            className={`${styles.bubble} ${styles.mine}`}
            data-testid="quote-attributed"
          >
            <blockquote>{q.text}</blockquote>
            <figcaption className={styles.meta}>{copy.departures.attributedMeta(nameOf(q.by))}</figcaption>
          </figure>
        ))}
      </section>
    </div>
  );
}
