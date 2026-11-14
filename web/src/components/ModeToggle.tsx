import { copy } from "../../content/copy";
import styles from "./ModeToggle.module.css";

export type Mode = "total" | "perMil";

/** Total / Por mil toggle buttons (aria-pressed). */
export function ModeToggle({ value, onChange }: { value: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className={styles.toggle} role="group" aria-label={copy.census.modeLabel}>
      {(["total", "perMil"] as const).map((m) => (
        <button key={m} type="button" className={styles.chip} aria-pressed={value === m} onClick={() => onChange(m)}>
          {m === "total" ? copy.census.total : copy.census.perMil}
        </button>
      ))}
    </div>
  );
}
