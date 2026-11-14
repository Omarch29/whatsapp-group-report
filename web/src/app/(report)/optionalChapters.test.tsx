import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAPTER_PAGES } from "@/chapters";
import * as data from "@/lib/data";
import { mockReducedMotion } from "@/test/motion";

vi.mock("@/lib/data", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/data")>()) }));

const { encuestas: Encuestas, menciones: Menciones, multimedia: Multimedia, ritmo: Ritmo, salidas: Salidas } = CHAPTER_PAGES;

afterEach(() => vi.restoreAllMocks());

const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404/;

// A static export emits no page for a chapter the data has nothing for: the route 404s at build time.
describe("optional chapters", () => {
  it("/salidas/ is not generated when there is no departer", async () => {
    const real = await data.loadDepartures();
    vi.spyOn(data, "loadDepartures").mockResolvedValue({ ...real, person: null });
    await expect(Salidas()).rejects.toThrow(NOT_FOUND);
  });

  it("/encuestas/ is not generated when the chat has no polls", async () => {
    const empty = { byPerson: [], total: 0, mostVoted: [], unanimous: [], divided: [] };
    vi.spyOn(data, "loadPolls").mockResolvedValue(empty);
    await expect(Encuestas()).rejects.toThrow(NOT_FOUND);
  });

  it("/menciones/ is not generated when nobody was mentioned", async () => {
    const real = await data.loadMentions();
    vi.spyOn(data, "loadMentions").mockResolvedValue({ ...real, mostMentioned: null, topTagger: null });
    await expect(Menciones()).rejects.toThrow(NOT_FOUND);
  });

  it("/multimedia/ has no audios block when the chat has no audio, and keeps the rest", async () => {
    mockReducedMotion(true);
    const real = await data.loadMedia();
    const audios = { byPerson: [], byHour: Array.from({ length: 24 }, () => 0), byYear: { years: [], n: [] } };
    vi.spyOn(data, "loadMedia").mockResolvedValue({ ...real, audios });
    const { container } = render(await Multimedia());
    expect(container.querySelector("#audios")).toBeNull();
    for (const id of ["kinds", "media-records", "links", "deleted-edited"]) {
      expect(container.querySelector(`#${id}`), id).not.toBeNull();
    }
  });

  it("/ritmo/ says the times are per minute only for a minute-resolution export", async () => {
    mockReducedMotion(true);
    const note = "Este export no trae segundos: los tiempos están al minuto.";
    const real = await data.loadGlobal();
    const { container, unmount } = render(await Ritmo());
    expect(container.querySelector("#latency")).not.toHaveTextContent(note);
    unmount();
    vi.spyOn(data, "loadGlobal").mockResolvedValue({ ...real, timeResolution: "minute" });
    const again = render(await Ritmo());
    expect(again.container.querySelector("#latency")).toHaveTextContent(note);
  });
});
