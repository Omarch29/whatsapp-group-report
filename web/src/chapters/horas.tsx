import { copy } from "../../content/copy";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Heatmap } from "@/components/sections/Heatmap";
import { listPeopleSlugs, loadFacts, loadGlobal, loadPerson } from "@/lib/data";
import { heatPeak, heatPeople } from "./shared";

export default async function Horas() {
  const [g, facts, slugs] = await Promise.all([loadGlobal(), loadFacts(), listPeopleSlugs()]);
  // Every profile file (listed slugs must have one: a missing file fails the build, as on /p/[slug]).
  const profiles = await Promise.all(slugs.map((s) => loadPerson(s)));
  return (
    <main>
      <Heatmap
        blockId="heatmap"
        group={g.heatmap}
        people={heatPeople(profiles, g.people)}
        lede={copy.heatmap.lede}
        peak={heatPeak(facts)}
        criterion={copy.heatmap.criterion}
        copyLink
      />
      <ChapterPager id="horas" />
    </main>
  );
}
