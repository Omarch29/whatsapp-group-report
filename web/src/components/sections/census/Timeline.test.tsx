import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { gsap } from "gsap";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CensusData } from "@/lib/schema";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { NameRecords, Timeline } from "./Timeline";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Observer = { cb: IntersectionObserverCallback; opts?: IntersectionObserverInit; observed: Element[] };

/** Stubs IntersectionObserver and returns every instance created, with its callback and options. */
function stubObservers(): Observer[] {
  const made: Observer[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      rec: Observer;
      constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
        this.rec = { cb, opts, observed: [] };
        made.push(this.rec);
      }
      observe(el: Element) {
        this.rec.observed.push(el);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  return made;
}

const intersect = (o: Observer, target: Element) =>
  act(() => o.cb([{ target, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));

const props = { items: fx.census.timeline, period: fx.global.period, people: fx.global.people };

describe("Timeline", () => {
  it("renders every milestone as a listitem and one link to /salidas/", () => {
    mockReducedMotion(true);
    render(<Timeline {...props} />);
    const list = screen.getByRole("list", { name: "Hitos del grupo" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(fx.census.timeline.length);
    const departures = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "/salidas/");
    expect(departures).toHaveLength(1);
    expect(departures[0]).toHaveTextContent("12 vueltas");
    expect(departures[0]).toHaveTextContent("Las salidas");
  });

  it("shows the new group name, links joins to profiles and events to the events rail", () => {
    mockReducedMotion(true);
    render(<Timeline {...props} />);
    expect(screen.getByText("El club")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tomi/ })).toHaveAttribute("href", "/p/tomi/");
    expect(screen.getByRole("link", { name: /Día uno/ })).toHaveAttribute("href", "/eventos/#rail");
  });

  it("puts same-day milestones in one column", () => {
    mockReducedMotion(true);
    render(<Timeline {...props} />);
    const [event, join, name] = screen.getAllByRole("listitem");
    expect(event!.style.left).toBe(join!.style.left);
    expect(event!.style.bottom).not.toBe(join!.style.bottom);
    expect(name!.style.left).not.toBe(event!.style.left);
  });

  it("is a horizontally scrollable, keyboard-focusable rail with year ticks", () => {
    mockReducedMotion(true);
    const items: CensusData["timeline"] = [
      ...fx.census.timeline,
      { when: "2024-02-01T10:00:00", kind: "peak", label: "1.349 mensajes", slug: null, href: null },
    ];
    render(<Timeline {...props} items={items} period={{ from: "2023-09-01", to: "2024-03-01" }} />);
    const rail = screen.getByRole("region", { name: "Línea de tiempo del grupo" });
    expect(rail).toHaveAttribute("tabindex", "0");
    expect(within(rail).getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("1.349 mensajes")).toBeInTheDocument();
  });

  it("shows final states under reduced motion: no observer, nothing hidden, full axis", () => {
    mockReducedMotion(true);
    const made = stubObservers();
    const set = vi.spyOn(gsap, "set");
    render(<Timeline {...props} />);
    expect(set).not.toHaveBeenCalled();
    expect(made.filter((o) => o.opts?.root)).toHaveLength(0);
    for (const li of screen.getAllByRole("listitem")) {
      expect(li.style.opacity).not.toBe("0");
      expect(li.style.transform).not.toContain("scale(0");
    }
    expect(screen.getByTestId("timeline-axis").style.transform).not.toContain("scaleX(0");
  });

  it("does not observe or pop any column before the block is on screen", () => {
    mockReducedMotion(false);
    const made = stubObservers();
    const to = vi.spyOn(gsap, "to");
    render(<Timeline {...props} />);
    const rail = screen.getByRole("region", { name: "Línea de tiempo del grupo" });
    const io = made.find((o) => o.opts?.root === rail)!;
    expect(io.observed).toHaveLength(0);
    for (const li of screen.getAllByRole("listitem")) expect(li).not.toHaveAttribute("data-shown");
    expect(to).not.toHaveBeenCalled();
  });

  it("pops a column the first time it enters the rail, once the block is seen", () => {
    mockReducedMotion(false);
    const made = stubObservers();
    const to = vi.spyOn(gsap, "to");
    render(<Timeline {...props} />);
    const rail = screen.getByRole("region", { name: "Línea de tiempo del grupo" });
    const io = made.find((o) => o.opts?.root === rail)!;
    expect(io.opts?.threshold).toBe(0.5);
    // useOnce's viewport observer (no root) reports the block on screen.
    const view = made.find((o) => !o.opts?.root)!;
    intersect(view, view.observed[0]!);
    const [event, join, name] = screen.getAllByRole("listitem");
    expect(io.observed).toContain(event);
    expect(event).not.toHaveAttribute("data-shown");
    intersect(io, event!);
    // The whole column (same day) pops together; the next day waits for its own turn.
    expect(event).toHaveAttribute("data-shown", "true");
    expect(join).toHaveAttribute("data-shown", "true");
    expect(name).not.toHaveAttribute("data-shown");
    expect(to).toHaveBeenCalledWith(
      [event, join],
      expect.objectContaining({ scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2)" }),
    );
  });

  it("draws the axis over 1.6 s on first view and restores everything on unmount", () => {
    mockReducedMotion(false);
    const made = stubObservers();
    const to = vi.spyOn(gsap, "to");
    const { unmount } = render(<Timeline {...props} />);
    // useOnce's viewport observer (no root) reports the block on screen.
    const view = made.find((o) => !o.opts?.root)!;
    intersect(view, view.observed[0]!);
    expect(to).toHaveBeenCalledWith(
      screen.getByTestId("timeline-axis"),
      expect.objectContaining({ scaleX: 1, duration: 1.6 }),
    );
    const items = screen.getAllByRole("listitem");
    unmount();
    expect(items.every((li) => li.style.opacity !== "0")).toBe(true);
  });

  it("shows the empty state without milestones", () => {
    render(<Timeline {...props} items={[]} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("Timeline overview", () => {
  const items: CensusData["timeline"] = [
    ...fx.census.timeline,
    { when: "2024-02-01T10:00:00", kind: "peak", label: "1.349 mensajes", slug: null, href: null },
  ];
  const period = { from: "2023-09-01", to: "2024-03-01" };

  it("draws one dot per milestone on a fit-to-width date scale", () => {
    mockReducedMotion(true);
    render(<Timeline {...props} items={items} period={period} />);
    const dots = screen.getAllByTestId("overview-dot");
    expect(dots).toHaveLength(items.length);
    expect(dots[0]!.style.left).toBe("0%");
    expect(dots.map((d) => d.getAttribute("data-kind"))).toEqual(items.map((i) => i.kind));
  });

  it("year buttons scroll the rail to that year's first column", async () => {
    mockReducedMotion(true);
    render(<Timeline {...props} items={items} period={period} />);
    const scrollTo = vi.fn();
    screen.getByRole("region", { name: "Línea de tiempo del grupo" }).scrollTo = scrollTo;
    const peak = screen.getAllByRole("listitem").at(-1)!;
    fireEvent.click(screen.getByRole("button", { name: "2024" }));
    expect(scrollTo).toHaveBeenCalledWith({ left: parseFloat(peak.style.left) - 16, behavior: "auto" });
  });

  it("tapping the strip scrolls to the nearest column", () => {
    mockReducedMotion(true);
    render(<Timeline {...props} items={items} period={period} />);
    const scrollTo = vi.fn();
    screen.getByRole("region", { name: "Línea de tiempo del grupo" }).scrollTo = scrollTo;
    const strip = screen.getByTestId("overview-track");
    vi.spyOn(strip, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20, toJSON: () => ({}),
    });
    fireEvent.click(strip, { clientX: 99 });
    const peak = screen.getAllByRole("listitem").at(-1)!;
    expect(scrollTo).toHaveBeenLastCalledWith({ left: parseFloat(peak.style.left) - 16, behavior: "auto" });
  });
});

describe("NameRecords", () => {
  it("shows the longest and shortest group names in bubbles with their durations", () => {
    render(<NameRecords names={fx.census.names} />);
    expect(screen.getByText("El club")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument(); // whole days: 61.5 shows as 61
    expect(screen.queryByText("61,5")).toBeNull();
    expect(screen.getByText("Club de prueba")).toBeInTheDocument();
    expect(screen.getByText("51")).toBeInTheDocument();
    expect(screen.getByText("segundos")).toBeInTheDocument();
  });

  it("renders nothing without name changes", () => {
    const { container } = render(<NameRecords names={{ longest: null, shortest: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
