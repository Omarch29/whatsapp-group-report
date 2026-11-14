import { notFound } from "next/navigation";
import { copy } from "../../content/copy";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Departures } from "@/components/sections/Departures";
import { loadDepartures, loadFacts, loadGlobal } from "@/lib/data";

/** Only exists when report.config.json names a departer (departures.json has a person). */
export default async function Salidas() {
  const [g, facts, departures] = await Promise.all([loadGlobal(), loadFacts(), loadDepartures()]);
  const { person } = departures;
  if (!person) notFound();
  return (
    <main>
      <Departures
        blockIds={{ door: "door", quotes: "quotes" }}
        data={departures}
        facts={facts}
        name={person.name}
        polls={g.people.find((p) => p.slug === person.slug)?.polls ?? 0}
        people={g.people}
        criterion={copy.departures.criterion}
        copyLinks
      />
      <ChapterPager id="salidas" />
    </main>
  );
}
