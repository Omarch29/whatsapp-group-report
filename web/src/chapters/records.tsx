import { copy } from "../../content/copy";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Records as RecordsSection } from "@/components/sections/Records";
import { listPeopleSlugs, loadGlobal, loadRecords } from "@/lib/data";
import { loadRecordLength } from "./shared";

export default async function Records() {
  const [g, records, slugs] = await Promise.all([loadGlobal(), loadRecords(), listPeopleSlugs()]);
  const recordLength = await loadRecordLength(records, slugs);
  return (
    <main>
      <RecordsSection
        blockIds={{ length: "length", perDay: "per-day", poll: "poll", night: "night", quotes: "quotes" }}
        data={records}
        people={g.people}
        recordLength={recordLength}
        criteria={copy.records.criterion}
        copyLinks
      />
      <ChapterPager id="records" />
    </main>
  );
}
