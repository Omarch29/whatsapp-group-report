import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CHAPTER_PAGES } from "@/chapters";
import { chapterIdFromSlug, chapterMetadata, chaptersFor, SINGLE_PLACEHOLDER } from "@/lib/chapters";
import { getTitle, loadChapterFlags, loadMode } from "@/lib/data";

/** One static page per chapter the data has, under its public slug in the build's language; anything else is a 404. */
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ chapter: string }[]> {
  // Single mode has no chapter pages, but Next 16 refuses an empty list under `output: "export"` ("at least one route
  // must be generated"). The one placeholder param, "_", is no chapter slug: the page below answers it with
  // notFound(), so the export only holds Next's 404 for it.
  if ((await loadMode()) === "single") return [{ chapter: SINGLE_PLACEHOLDER }];
  return chaptersFor(await loadChapterFlags())
    .filter((c) => c.slug !== "")
    .map((c) => ({ chapter: c.slug }));
}

/** The chapter id behind a route's slug; the introduction ("") and unknown slugs are a 404. */
async function chapterId({ params }: PageProps<"/[chapter]">) {
  const id = chapterIdFromSlug((await params).chapter);
  if (!id) notFound();
  return id;
}

export async function generateMetadata(props: PageProps<"/[chapter]">): Promise<Metadata> {
  return chapterMetadata(await chapterId(props), await getTitle());
}

export default async function ChapterRoute(props: PageProps<"/[chapter]">) {
  return CHAPTER_PAGES[await chapterId(props)]();
}
