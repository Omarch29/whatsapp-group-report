import { Drawer } from "@/components/report/Drawer";
import { HashScroll } from "@/components/report/HashScroll";
import { ReportProvider } from "@/components/report/ReportContext";
import { Sidebar } from "@/components/report/Sidebar";
import { chaptersFor } from "@/lib/chapters";
import { getTitle, loadChapterFlags, loadMode } from "@/lib/data";
import { FloatingIndex } from "@/single/FloatingIndex";
import { indexOf, loadSingleSections } from "@/single/SinglePage";
import single from "@/single/single.module.css";
import styles from "./layout.module.css";

/**
 * Report shell. Full mode: sidebar on desktop, top bar + drawer on mobile, the chapter in the main column.
 * Single mode: the long page with a floating index of the very sections the page renders.
 */
export default async function ReportLayout({ children }: LayoutProps<"/">) {
  if ((await loadMode()) === "single") {
    // No ReportProvider: only the chapter navigation reads it, and its chapter list would ship routes this export lacks.
    return (
      <div className={single.shell}>
        <div className={single.main}>{children}</div>
        <FloatingIndex blocks={indexOf(await loadSingleSections())} />
        <HashScroll />
      </div>
    );
  }
  const [title, flags] = await Promise.all([getTitle(), loadChapterFlags()]);
  return (
    <ReportProvider title={title} chapters={chaptersFor(flags)}>
      <div className={styles.shell}>
        <Sidebar />
        <Drawer />
        <div className={styles.main}>{children}</div>
        <HashScroll />
      </div>
    </ReportProvider>
  );
}
