import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as data from "@/lib/data";
import { mockReducedMotion } from "@/test/motion";
import Profile, { generateStaticParams as generateProfileParams } from "../p/[slug]/page";
import ChapterRoute, { generateMetadata, generateStaticParams } from "./page";

vi.mock("@/lib/data", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/data")>()) }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404/;
const props = (chapter: string) => ({ params: Promise.resolve({ chapter }) }) as PageProps<"/[chapter]">;

// One dynamic route for every chapter: the public slug of the build's language (vitest pins es).
// The example data is a full report; single mode is simulated through loadMode.
describe("/[chapter]/", () => {
  it("generates the 17 Spanish slugs when every chapter is on", async () => {
    expect((await generateStaticParams()).map((p) => p.chapter)).toEqual([
      "censo", "carrera", "horas", "parejas", "lenguaje", "multimedia", "emojis", "encuestas", "ritmo",
      "menciones", "salidas", "eventos", "records", "diccionario", "premios", "personas", "conclusion",
    ]);
  });

  it("generates 14 when salidas, encuestas and menciones are off", async () => {
    vi.spyOn(data, "loadChapterFlags").mockResolvedValue({ departures: false, polls: false, mentions: false, audios: true });
    const slugs = (await generateStaticParams()).map((p) => p.chapter);
    expect(slugs).toHaveLength(14);
    for (const off of ["salidas", "encuestas", "menciones"]) expect(slugs).not.toContain(off);
  });

  it("generates no chapter and no profile in single mode, only the placeholder Next 16 requires, which is a 404", async () => {
    vi.spyOn(data, "loadMode").mockResolvedValue("single");
    expect(await generateStaticParams()).toEqual([{ chapter: "_" }]);
    expect(await generateProfileParams()).toEqual([{ slug: "_" }]);
    await expect(ChapterRoute(props("_"))).rejects.toThrow(NOT_FOUND);
    await expect(Profile({ params: Promise.resolve({ slug: "_" }) } as PageProps<"/p/[slug]">)).rejects.toThrow(NOT_FOUND);
  });

  it("renders the chapter of a slug and titles it with the report's title", async () => {
    mockReducedMotion(true);
    const { container } = render(await ChapterRoute(props("censo")));
    expect(container.querySelector("#timeline[data-block]")).not.toBeNull();
    expect(await generateMetadata(props("carrera"))).toEqual({ title: `La carrera · ${await data.getTitle()}` });
  });

  it("is a 404 for an unknown slug, the intro's empty slug and a profile segment", async () => {
    for (const slug of ["nope", "", "p", "census"]) {
      await expect(ChapterRoute(props(slug)), slug).rejects.toThrow(NOT_FOUND);
      await expect(generateMetadata(props(slug)), slug).rejects.toThrow(NOT_FOUND);
    }
  });
});
