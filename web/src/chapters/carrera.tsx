import { copy } from "../../content/copy";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Race } from "@/components/sections/Race";
import { loadDepartures, loadFacts, loadGlobal } from "@/lib/data";
import { raceLede } from "./shared";

export default async function Carrera() {
  const [g, facts, departures] = await Promise.all([loadGlobal(), loadFacts(), loadDepartures()]);
  return (
    <main>
      <Race
        blockId="race"
        months={g.monthly.months}
        series={g.monthly.series}
        people={g.people}
        lede={raceLede(departures, facts)}
        criterion={copy.race.criterion}
        copyLink
      />
      <ChapterPager id="carrera" />
    </main>
  );
}
