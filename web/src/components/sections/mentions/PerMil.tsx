import { copy } from "../../../../content/copy";
import { PersonBars } from "@/components/PersonBars";
import { fmt } from "@/lib/format";
import { personName } from "@/lib/language";
import type { MentionsData, Person } from "@/lib/schema";

type Props = { data: MentionsData["perMil"]; people: Person[] };

const m = copy.mentions;

/** Who tags the most per message: mentions per thousand of their messages, desc. */
export function PerMil({ data, people }: Props) {
  if (data.length === 0) return <p style={{ color: "var(--dim)" }}>{copy.empty}</p>;
  const rows = [...data]
    .sort((a, b) => b.perMil - a.perMil)
    .map((r) => ({
      slug: r.slug,
      value: r.perMil,
      display: `${fmt(r.perMil)} ‰`,
      title: m.perMilTitle(personName(r.slug, people), r.perMil, r.n),
    }));
  return <PersonBars rows={rows} people={people} label={m.perMilLabel} />;
}
