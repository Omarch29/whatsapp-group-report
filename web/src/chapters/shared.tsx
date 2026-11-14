import type { ReactNode } from "react";
import { copy, type Copy } from "../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { Painted } from "@/components/report/Painted";
import { loadPerson } from "@/lib/data";
import { strongestSignature } from "@/lib/emojis";
import { personName } from "@/lib/language";
import type { CensusData, DeparturesData, EmojisData, Facts, Person, PersonData, RecordsData } from "@/lib/schema";

// What a chapter body and the single page both build for the same block: one definition, two call sites.

/** Censo's timeline lede: how many names and photos, then the longest and shortest names when there are both. */
export function timelineLede(census: CensusData, period: { to: string }): string {
  const count = (kind: string) => census.timeline.filter((t) => t.kind === kind).length;
  const { longest, shortest } = census.names;
  return [
    copy.census.timelineLede(count("name"), count("photo")),
    longest && shortest ? copy.census.namesLede(longest, shortest, longest.to.slice(0, 10) === period.to) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** La carrera's lede, around the departer when the data has one. */
export function raceLede(departures: DeparturesData, facts: Facts): string {
  return copy.race.lede(departures.person?.name ?? "", facts.departerOvertakeMonth, facts.departerMonthsToTop);
}

/**
 * Horas' peak line. `facts.peakDow` is the pipeline's singular day name in the report's language; the line wants the
 * plural ("los sábados", "Saturdays"). A day the copy does not list is kept as given.
 */
export function heatPeak(facts: Pick<Facts, "peakDow" | "peakHour">, c: Copy = copy): string {
  const i = c.dow.indexOf(facts.peakDow);
  return c.heatmap.peak(c.dowPlural[i] ?? facts.peakDow, facts.peakHour);
}

/** Horas' person chips: every profile's heatmap, with that person's color. */
export function heatPeople(profiles: readonly PersonData[], people: readonly Person[]) {
  return profiles.map((p) => ({
    slug: p.slug,
    name: p.name,
    heatmap: p.heatmap,
    colorIndex: people.find((q) => q.slug === p.slug)?.colorIndex,
  }));
}

/** Emojis' signature lede: the strongest signature, its person painted. */
export function signatureLede(signature: EmojisData["signature"], people: Person[]): ReactNode {
  const sig = strongestSignature(signature);
  const text = sig ? copy.emojis.signatureLede(personName(sig.slug, people), sig.e, sig.ratio) : copy.empty;
  return <Painted text={text} who={sig ? [sig.slug] : []} people={people} />;
}

/** Emojis' signature record: the strongest signature's own uses; nothing without one. */
export function signatureRecord(signature: EmojisData["signature"], people: Person[]): ReactNode {
  const sig = strongestSignature(signature);
  const r = copy.emojis.signatureRecord;
  return (
    sig && (
      <RecordPair
        label={r.label}
        record={{ value: sig.own, unit: r.unit(sig.own), who: sig.slug, when: "", whenLabel: r.when(sig.ratio) }}
        caption={sig.e}
        people={people}
      />
    )
  );
}

/**
 * Récords' longest-message length. The record text is cleaned (mentions shortened), so the counted length lives in
 * that person's file; without a profile, undefined (Records then counts the text).
 */
export async function loadRecordLength(records: RecordsData, slugs: readonly string[]): Promise<number | undefined> {
  const who = records.messageLength.record.who;
  return slugs.includes(who) ? (await loadPerson(who)).records.longest.value : undefined;
}
