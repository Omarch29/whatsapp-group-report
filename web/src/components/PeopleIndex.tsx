import Link from "next/link";
import { copy } from "../../content/copy";
import { CopyLink } from "@/components/report/Block";
import { blockAnchor } from "@/lib/blockAnchor";
import { colorFor } from "@/lib/colors";
import { RESTO_SLUG } from "@/lib/data";
import { nicknameFor, type Nicknames } from "@/lib/nicknames";
import type { Person } from "@/lib/schema";
import styles from "./PeopleIndex.module.css";

type Props = {
  /** global.people; `resto` has no profile and is left out. */
  people: Person[];
  nicknames: Nicknames;
  /** Chapter block id for this section (anchor + sidebar spy); none on profiles. */
  blockId?: string;
  /** Chapter anatomy: a «Copiar link» button for `blockId` at the end of the section. */
  copyLink?: boolean;
};

/** One chip per profiled person, linking to /p/[slug]. */
export function PeopleIndex({ people, nicknames, blockId, copyLink }: Props) {
  const profiled = people.filter((p) => p.slug !== RESTO_SLUG);
  return (
    <section {...blockAnchor(blockId)} className={styles.index}>
      <h2>{copy.profile.indexTitle}</h2>
      <p className={styles.lede}>{copy.profile.indexLede}</p>
      <ul className={styles.chips}>
        {profiled.map((p) => {
          const nick = nicknameFor(nicknames, p.name);
          return (
            <li key={p.slug}>
              <Link href={`/p/${p.slug}`} className={styles.chip}>
                <span className={styles.dot} aria-hidden="true" style={{ background: colorFor(p.colorIndex) }} />
                <span className={styles.name}>{p.name}</span>
                {nick ? <span className={styles.nick}> {nick}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {copyLink && blockId && <CopyLink id={blockId} />}
    </section>
  );
}
