import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAPTERS, chaptersFor, PROFILE_BLOCKS } from "@/lib/chapters";
import { ChapterNav } from "./ChapterNav";
import { ChapterPager } from "./ChapterPager";
import { Drawer } from "./Drawer";
import { ReportProvider } from "./ReportContext";
import { Sidebar } from "./Sidebar";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

type Obs = { cb: IntersectionObserverCallback; opts?: IntersectionObserverInit; els: Element[] };

/** Records every IntersectionObserver the spy creates, so a test can fire its callback by hand. */
function stubIntersectionObserver(): Obs[] {
  const observers: Obs[] = [];
  class IO {
    els: Element[] = [];
    constructor(
      private cb: IntersectionObserverCallback,
      private opts?: IntersectionObserverInit,
    ) {
      observers.push(this as unknown as Obs);
    }
    observe(el: Element) {
      this.els.push(el);
    }
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", IO);
  return observers;
}

describe("report navigation", () => {
  afterEach(() => {
    pathname.value = "/";
    vi.unstubAllGlobals();
  });

  it("ChapterNav marks the current chapter and lists its blocks", () => {
    render(<ChapterNav current="lenguaje" />);
    expect(screen.getByRole("link", { name: "Lenguaje" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Muletillas" })).toHaveAttribute("href", "#muletillas");
    expect(screen.queryByRole("link", { name: "Línea de tiempo" })).toBeNull();
  });

  it("ChapterNav derives the current chapter from the pathname", () => {
    pathname.value = "/censo/";
    render(<ChapterNav />);
    const nav = screen.getByRole("navigation", { name: "Capítulos" });
    expect(within(nav).getByRole("link", { name: "Censo" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Censo" })).toHaveAttribute("href", "/censo/");
    expect(within(nav).getByRole("link", { name: "Línea de tiempo" })).toHaveAttribute("href", "#timeline");
    expect(within(nav).getByRole("link", { name: "Lenguaje" })).not.toHaveAttribute("aria-current");
  });

  it("ChapterNav marks no chapter on a profile and lists the profile's anchors under «Este perfil»", () => {
    pathname.value = "/p/tomi/";
    render(<ChapterNav />);
    expect(screen.getAllByRole("link")).toHaveLength(CHAPTERS.length + PROFILE_BLOCKS.length);
    expect(document.querySelector("[aria-current]")).toBeNull();
    const profile = screen.getByRole("list", { name: "Este perfil" });
    const anchors = within(profile).getAllByRole("link");
    expect(anchors.map((a) => a.getAttribute("href"))).toEqual(PROFILE_BLOCKS.map((b) => `#${b.id}`));
    expect(within(profile).getByRole("link", { name: "Muletillas" })).toHaveAttribute("href", "#muletillas");
    expect(within(profile).getByRole("link", { name: "Premios" })).toHaveAttribute("href", "#premios");
    // Above the chapters, so it is in view on a desktop sidebar.
    const chapters = screen.getByRole("link", { name: "Introducción" }).closest("ol")!;
    expect(profile.compareDocumentPosition(chapters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("ChapterNav shows no «Este perfil» list on a chapter", () => {
    pathname.value = "/lenguaje/";
    render(<ChapterNav />);
    expect(screen.queryByRole("list", { name: "Este perfil" })).toBeNull();
  });

  it("Sidebar marks the profile block being read", () => {
    pathname.value = "/p/tomi/";
    const observers = stubIntersectionObserver();
    render(
      <>
        <section id="muletillas" data-block />
        <section id="premios" data-block />
        <Sidebar />
      </>,
    );
    const [io] = observers;
    act(() => {
      io!.cb(
        [{ target: document.getElementById("premios")!, isIntersecting: true } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    const profile = within(screen.getByRole("complementary")).getByRole("list", { name: "Este perfil" });
    expect(within(profile).getByRole("link", { name: "Premios" })).toHaveAttribute("aria-current", "location");
  });

  it("Drawer opens, traps focus, closes on Escape and restores focus", async () => {
    render(<Drawer current="censo" />);
    const btn = screen.getByRole("button", { name: "Abrir capítulos" });
    await userEvent.click(btn);
    expect(screen.getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    // A closed <dialog> leaves the accessibility tree, so it is looked up among hidden nodes.
    expect(screen.queryByRole("dialog", { hidden: true })).not.toBeVisible();
    expect(btn).toHaveFocus();
  });

  it("Drawer shows the chapter title and one progress dot per chapter", () => {
    render(<Drawer current="censo" />);
    const bar = screen.getByRole("banner");
    expect(within(bar).getByText("Censo")).toBeInTheDocument();
    const dots = within(bar).getByRole("img", { name: `Capítulo 2 de ${CHAPTERS.length}` });
    expect(dots.querySelectorAll("[data-dot]")).toHaveLength(CHAPTERS.length);
    expect(dots.querySelectorAll("[data-dot][data-on]")).toHaveLength(1);
  });

  it("Drawer closes when a chapter is chosen or the backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(<Drawer current="censo" />);
    const btn = screen.getByRole("button", { name: "Abrir capítulos" });
    await user.click(btn);
    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Antigüedad" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(btn).toHaveFocus();

    await user.click(btn);
    await user.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(btn);
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Sidebar shows the logo, the counter and marks the visible block", () => {
    const observers = stubIntersectionObserver();
    render(
      <ReportProvider title="Los del Parque" chapters={CHAPTERS}>
        <section id="muletillas" data-block style={{ scrollMarginTop: "72px" }} />
        <section id="repeated" data-block />
        <Sidebar current="lenguaje" />
      </ReportProvider>,
    );
    const aside = screen.getByRole("complementary");
    expect(within(aside).getByRole("link", { name: "Los del Parque" })).toHaveAttribute("href", "/");
    expect(within(aside).getByText(`Capítulo 6 de ${CHAPTERS.length}`)).toBeInTheDocument();

    const [io] = observers;
    expect(io!.els.map((e) => e.id)).toEqual(["muletillas", "repeated"]);
    // The band starts just under the anchor offset, so a block landed on by a link is the one marked.
    expect(io!.opts?.rootMargin).toBe("-80px 0px -60% 0px");
    const repeated = document.getElementById("repeated")!;
    act(() => {
      io!.cb([{ target: repeated, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(within(aside).getByRole("link", { name: "Frases que otros le repitieron" })).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(within(aside).getByRole("link", { name: "Muletillas" })).not.toHaveAttribute("aria-current");
  });

  it("Sidebar marks the innermost block when one anchor sits inside another", () => {
    const observers = stubIntersectionObserver();
    render(
      <>
        <article id="per-day" data-block>
          <div id="poll" data-block />
        </article>
        <Sidebar current="records" />
      </>,
    );
    const aside = screen.getByRole("complementary");
    const [io] = observers;
    const entry = (id: string) =>
      ({ target: document.getElementById(id)!, isIntersecting: true }) as unknown as IntersectionObserverEntry;
    // Only the outer card in the band: it is the one marked.
    act(() => io!.cb([entry("per-day")], {} as IntersectionObserver));
    expect(within(aside).getByRole("link", { name: "Día más movido" })).toHaveAttribute("aria-current", "location");
    // The poll enters the band too: its ancestor no longer wins on document order.
    act(() => io!.cb([entry("poll")], {} as IntersectionObserver));
    expect(within(aside).getByRole("link", { name: "Encuesta récord" })).toHaveAttribute("aria-current", "location");
    expect(within(aside).getByRole("link", { name: "Día más movido" })).not.toHaveAttribute("aria-current");
  });

  it("ChapterPager shows neighbors and the return link at the end", () => {
    render(<ChapterPager id="censo" />);
    expect(screen.getByRole("link", { name: /Introducción/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /La carrera/ })).toHaveAttribute("href", "/carrera/");
    cleanup();
    render(<ChapterPager id="conclusion" />);
    expect(screen.getByRole("link", { name: "Volver al principio" })).toHaveAttribute("href", "/");
  });

  describe("with chapters switched off by the data", () => {
    const chapters = chaptersFor({ departures: false, polls: false, mentions: true, audios: true });
    const wrap = (ui: ReactElement) => (
      <ReportProvider title="Los del Parque" chapters={chapters}>
        {ui}
      </ReportProvider>
    );

    it("ChapterNav leaves their links out", () => {
      render(wrap(<ChapterNav current="menciones" />));
      const nav = screen.getByRole("navigation", { name: "Capítulos" });
      expect(within(nav).queryByRole("link", { name: "Las salidas" })).toBeNull();
      expect(within(nav).queryByRole("link", { name: "Encuestas" })).toBeNull();
      expect(within(nav).getByRole("link", { name: "Eventos" })).toHaveAttribute("href", "/eventos/");
    });

    it("Sidebar and Drawer count only the enabled chapters", () => {
      pathname.value = "/menciones/";
      render(wrap(<><Sidebar /><Drawer /></>));
      expect(within(screen.getByRole("complementary")).queryByRole("link", { name: "Las salidas" })).toBeNull();
      expect(within(screen.getByRole("complementary")).queryByRole("link", { name: "Encuestas" })).toBeNull();
      const n = chapters.length;
      expect(within(screen.getByRole("complementary")).getByText(`Capítulo ${chapters.findIndex((c) => c.slug === "menciones") + 1} de ${n}`)).toBeInTheDocument();
      expect(screen.getAllByRole("img", { name: new RegExp(`de ${n}$`) })[0]!.querySelectorAll("[data-dot]")).toHaveLength(n);
    });

    it("ChapterPager skips them", () => {
      render(wrap(<ChapterPager id="menciones" />));
      expect(screen.getByRole("link", { name: /Eventos/ })).toHaveAttribute("href", "/eventos/");
      expect(screen.queryByRole("link", { name: /Las salidas/ })).toBeNull();
    });
  });
});
