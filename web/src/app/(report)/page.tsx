import Link from "next/link";
import { copy } from "../../../content/copy";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Hero } from "@/components/sections/Hero";
import { chaptersFor } from "@/lib/chapters";
import { loadChapterFlags, loadGlobal, loadMode } from "@/lib/data";
import { loadSingleSections, SinglePage } from "@/single/SinglePage";
import styles from "./page.module.css";

/** Full mode: Introducción, the hero, its lede and the way into the first chapter. Single mode: the whole report. */
export default async function Home() {
  if ((await loadMode()) === "single") return <SinglePage sections={await loadSingleSections()} />;
  const [g, flags] = await Promise.all([loadGlobal(), loadChapterFlags()]);
  return (
    <main>
      <Hero blockId="intro" total={g.totals.msgs} daysActive={g.totals.daysActive} bubbles={[...copy.hero.bubbles]}>
        <Link href={chaptersFor(flags)[1]!.href} className={styles.start}>
          {copy.intro.start}
        </Link>
      </Hero>
      <ChapterPager id="" />
    </main>
  );
}
