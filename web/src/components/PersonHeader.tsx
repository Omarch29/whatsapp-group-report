import Link from "next/link";
import { copy } from "../../content/copy";
import { colorFor } from "@/lib/colors";
import type { Person } from "@/lib/schema";
import styles from "./PersonHeader.module.css";

type Props = {
  person: Person;
  /** From `nicknameFor(name)`; the line is left out when undefined. */
  nick?: string;
};

/** "Volver al grupo": used at the top (inside the header) and at the bottom of a profile. */
export function BackLink() {
  return (
    <Link href="/" className={styles.back}>
      <span aria-hidden="true">←</span> {copy.profile.back}
    </Link>
  );
}

/** Profile masthead: back link, the person's color, name big and nickname dim. */
export function PersonHeader({ person, nick }: Props) {
  return (
    <header className={styles.header}>
      <BackLink />
      <div className={styles.title}>
        <span
          className={styles.dot}
          data-testid="person-dot"
          aria-hidden="true"
          style={{ background: colorFor(person.colorIndex) }}
        />
        <h1 className={styles.name}>{person.name}</h1>
      </div>
      {nick ? (
        <p className={styles.nick} data-nick>
          {nick}
        </p>
      ) : null}
    </header>
  );
}
