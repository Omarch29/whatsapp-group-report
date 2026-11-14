import { copy } from "../../content/copy";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Pairs } from "@/components/sections/Pairs";
import { loadGlobal } from "@/lib/data";

export default async function Parejas() {
  const g = await loadGlobal();
  return (
    <main>
      <Pairs
        blockId="graph"
        people={g.people}
        edges={g.edges}
        lede={copy.pairs.lede}
        criterion={copy.pairs.criterion}
        copyLink
      />
      <ChapterPager id="parejas" />
    </main>
  );
}
