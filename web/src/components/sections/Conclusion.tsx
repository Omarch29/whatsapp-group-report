import { copy } from "../../../content/copy";
import { fmt } from "@/lib/format";
import type { Facts } from "@/lib/schema";
import styles from "./Conclusion.module.css";

type Props = {
  /** web/content/conclusion.md, as paragraphs; a paragraph starting with "—" is the signature. */
  paragraphs: readonly string[];
  facts: Pick<Facts, "totalMsgs" | "daysActive" | "awardsCount">;
};

const c = copy.conclusion;

/** The author's closing text (content/conclusion.md) and three closing numbers. No chart. */
export function Conclusion({ paragraphs, facts }: Props) {
  const numbers = [
    { n: facts.totalMsgs, label: c.msgs },
    { n: facts.daysActive, label: c.days },
    { n: facts.awardsCount, label: c.awards },
  ];
  return (
    <div className={styles.root}>
      <div className={styles.text}>
        {paragraphs.map((p, i) =>
          p.startsWith("—") ? (
            <p key={i} className={styles.signature} data-signature>
              {p}
            </p>
          ) : (
            <p key={i}>{p}</p>
          ),
        )}
      </div>
      <ul className={styles.numbers} aria-label={c.numbersLabel}>
        {numbers.map((x) => (
          <li key={x.label} className={styles.tile}>
            <span className={`num ${styles.n}`}>{fmt(x.n)}</span>
            <span className={styles.label}>{x.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
