import { copy } from "../../../../content/copy";
import { PersonBars } from "@/components/PersonBars";
import { fmt } from "@/lib/format";
import type { Person, PollsData } from "@/lib/schema";
import styles from "./ByPerson.module.css";

type Props = {
  data: PollsData;
  people: Person[];
  /** Profile mode: only this person's row. */
  person?: string;
};

/** Polls created per person, most first, as bars that grow on first view. */
export function ByPerson({ data, people, person }: Props) {
  const rows = (person === undefined ? data.byPerson : data.byPerson.filter((p) => p.slug === person)).filter(
    (p) => p.n > 0,
  );
  if (rows.length === 0) return <p className={styles.empty}>{copy.empty}</p>;
  return (
    <PersonBars
      label={copy.polls.byPersonLabel}
      people={people}
      threshold={0.1}
      rows={rows.map((p) => ({ slug: p.slug, value: p.n, display: fmt(p.n) }))}
    />
  );
}
