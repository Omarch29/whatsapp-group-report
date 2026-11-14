import { colorFor } from "@/lib/colors";
import type { Person } from "@/lib/schema";
import styles from "./PersonChips.module.css";

/** The value of the optional "all" chip. */
export const ALL_PEOPLE = "*";

type Props = {
  people: readonly Pick<Person, "slug" | "name" | "colorIndex">[];
  /** The selected slug, or ALL_PEOPLE. */
  value: string;
  onChange: (slug: string) => void;
  /** Adds a first chip for everyone, with this label. */
  allLabel?: string;
  /** Accessible name of the chip group. */
  label?: string;
};

/**
 * A row of person chips (toggle buttons with the person's color dot). Scrolls sideways on phones.
 * Clicking the chip that is already pressed reports nothing.
 */
export function PersonChips({ people, value, onChange, allLabel, label }: Props) {
  const chips = [
    ...(allLabel ? [{ slug: ALL_PEOPLE, name: allLabel, color: undefined as string | undefined }] : []),
    ...people.map((p) => ({ slug: p.slug, name: p.name, color: colorFor(p.colorIndex) })),
  ];
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {chips.map((c) => (
        <button
          key={c.slug}
          type="button"
          className={styles.chip}
          aria-pressed={value === c.slug}
          onClick={() => value !== c.slug && onChange(c.slug)}
        >
          {c.color && <span className={styles.dot} data-dot style={{ backgroundColor: c.color }} aria-hidden="true" />}
          {c.name}
        </button>
      ))}
    </div>
  );
}
