import { copy } from "../../content/copy";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Events } from "@/components/sections/Events";
import { loadEvents } from "@/lib/data";

export default async function Eventos() {
  const events = await loadEvents();
  return (
    <main>
      <Events blockId="rail" events={events} criterion={copy.events.criterion} copyLink />
      <ChapterPager id="eventos" />
    </main>
  );
}
