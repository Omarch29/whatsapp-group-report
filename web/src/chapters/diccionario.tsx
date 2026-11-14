import { copy } from "../../content/copy";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Dictionary } from "@/components/sections/Dictionary";
import { loadGlobal, loadLore } from "@/lib/data";

export default async function Diccionario() {
  const [g, lore] = await Promise.all([loadGlobal(), loadLore()]);
  return (
    <main>
      <Dictionary blockId="cloud" terms={lore} people={g.people} criterion={copy.dictionary.criterion} copyLink />
      <ChapterPager id="diccionario" />
    </main>
  );
}
