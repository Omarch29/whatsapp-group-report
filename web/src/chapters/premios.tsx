import { copy } from "../../content/copy";
import { Block } from "@/components/report/Block";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Awards } from "@/components/sections/awards/Awards";
import { chapterById } from "@/lib/chapters";
import { loadAwards, loadFacts, loadGlobal, loadNicknames } from "@/lib/data";
import styles from "./chapter.module.css";

export default async function Premios() {
  const [g, awards, facts, nicknames] = await Promise.all([loadGlobal(), loadAwards(), loadFacts(), loadNicknames()]);
  const title = (id: string) => chapterById("premios").blocks.find((b) => b.id === id)!.title;

  // No record block: the awards are the records.
  return (
    <main className={styles.chapter}>
      <h2 className={styles.heading}>{chapterById("premios").title}</h2>
      <Block id="awards" title={title("awards")} hideTitle lede={copy.awards.lede(facts.awardsCount)} criterion={copy.awards.criterion}>
        <Awards awards={awards} people={g.people} nicknames={nicknames} />
      </Block>
      <ChapterPager id="premios" />
    </main>
  );
}
