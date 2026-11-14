import { PeopleIndex } from "@/components/PeopleIndex";
import { ChapterPager } from "@/components/report/ChapterPager";
import { loadGlobal, loadNicknames } from "@/lib/data";

export default async function Personas() {
  const [g, nicknames] = await Promise.all([loadGlobal(), loadNicknames()]);
  return (
    <main>
      <PeopleIndex blockId="index" people={g.people} nicknames={nicknames} copyLink />
      <ChapterPager id="personas" />
    </main>
  );
}
