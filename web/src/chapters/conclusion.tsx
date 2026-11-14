import { Block } from "@/components/report/Block";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Conclusion } from "@/components/sections/Conclusion";
import { chapterById } from "@/lib/chapters";
import { loadConclusion } from "@/lib/conclusion";
import { loadFacts } from "@/lib/data";
import styles from "./chapter.module.css";

export default async function ConclusionPage() {
  const [paragraphs, facts] = await Promise.all([loadConclusion(), loadFacts()]);
  const chapter = chapterById("conclusion");
  const block = chapter.blocks.find((b) => b.id === "text")!;

  // ChapterPager renders "Volver al principio": conclusion is the last chapter.
  return (
    <main className={styles.chapter}>
      <h2 className={styles.heading}>{chapter.title}</h2>
      <Block id="text" title={block.title} hideTitle>
        <Conclusion paragraphs={paragraphs} facts={facts} />
      </Block>
      <ChapterPager id="conclusion" />
    </main>
  );
}
