import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { processFrame } from "motion";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Muletillas, PAUSE_MS, STAGGER_MS, TYPING_MS } from "./Muletillas";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const people = fx.global.people;

/**
 * Advances the fake clock by `ms`, then runs one Motion frame at the new time. Motion's frame loop captured jsdom's
 * real requestAnimationFrame when it loaded, so under fake timers its animations (the previous thread's exit, which
 * AnimatePresence waits for) would only advance when a real ~16 ms frame happens to fire during the test: some runs
 * got one, some none. Processing the frame here ties every animation to the fake clock.
 */
async function tick(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    processFrame();
  });
}
const thread = (name: string) => screen.getByRole("list", { name: `Muletillas de ${name}` });

describe("Muletillas", () => {
  it("starts on the first person with 6+ phrases and lists their 10 as bubbles", () => {
    mockReducedMotion(true);
    render(<Muletillas data={fx.language.muletillas} people={people} />);
    expect(screen.getByRole("button", { name: "Tomi" })).toHaveAttribute("aria-pressed", "true");
    const items = within(thread("Tomi")).getAllByRole("listitem");
    expect(items).toHaveLength(10);
    expect(items[0]).toHaveTextContent("mirá vos");
    expect(items[0]).toHaveTextContent("40 veces · el resto 2");
    expect(items[0]).toHaveTextContent("desde octubre de 2023");
    // The lede: the phrase with the highest ratio, the name painted.
    expect(
      screen.getByText(/dijo «mirá vos» 40 veces: 20 veces más seguido que el resto del grupo\./),
    ).toBeInTheDocument();
  });

  it("shows each phrase as the person writes it (display), never the normalized key", () => {
    mockReducedMotion(true);
    const tomi = fx.language.muletillas.tomi!.map((m, i) =>
      i === 0 ? { ...m, phrase: "que ilusion", display: "qué ilusión", example: { ...m.example, text: "ay qué ilusión me hace" } } : m,
    );
    render(<Muletillas data={{ ...fx.language.muletillas, tomi }} people={people} />);
    const first = within(thread("Tomi")).getAllByRole("listitem")[0]!;
    expect(first).toHaveTextContent("qué ilusión");
    expect(first).not.toHaveTextContent("que ilusion");
    expect(screen.getByText(/dijo «qué ilusión» 40 veces/)).toBeInTheDocument();
  });

  it("swaps the thread and the lede when another chip is chosen", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    const data = {
      ...fx.language.muletillas,
      ana: fx.language.muletillas.ana!.map((m, i) => ({ ...m, ratio: 5 + i * 3.4 })),
    };
    render(<Muletillas data={data} people={people} />);
    await user.click(screen.getByRole("button", { name: "Ana" }));
    expect(screen.getByRole("button", { name: "Ana" })).toHaveAttribute("aria-pressed", "true");
    const items = within(await screen.findByRole("list", { name: "Muletillas de Ana" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(screen.queryByRole("list", { name: "Muletillas de Tomi" })).toBeNull();
    // Ana's highest ratio is his third phrase.
    expect(
      screen.getByText(/dijo «que lujo» 38 veces: 12 veces más seguido que el resto del grupo\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana", { selector: "b" })).toHaveAttribute("data-person", "ana");
  });

  it("toggles a phrase's real example in a sub-bubble, with its date and the phrase marked", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<Muletillas data={fx.language.muletillas} people={people} />);
    const bubble = screen.getByRole("button", { name: /^mirá vos/ });
    expect(bubble).toHaveAttribute("aria-expanded", "false");
    await user.click(bubble);
    expect(bubble).toHaveAttribute("aria-expanded", "true");
    const example = document.getElementById(bubble.getAttribute("aria-controls")!)!;
    expect(example).toHaveTextContent("Qué mirá vos");
    expect(example).toHaveTextContent("06/10/2023");
    expect(example.querySelector("mark")).toHaveTextContent("mirá vos");
    await user.click(bubble);
    expect(bubble).toHaveAttribute("aria-expanded", "false");
  });

  it("with a fixed person shows no chips nor 'Todas', and the empty state for 0 phrases", () => {
    mockReducedMotion(true);
    render(<Muletillas data={fx.language.muletillas} people={people} person="nico" />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByRole("button", { name: "Todas" })).toBeNull();
    expect(screen.getByText("Ninguna frase de Nico pasa el filtro de muletilla.")).toBeInTheDocument();
  });

  it("'Todas' shows one card per person with their first phrase, and the empty state for nobody's", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<Muletillas data={{ ...fx.language.muletillas, ana: [] }} people={people} />);
    const all = screen.getByRole("button", { name: "Todas" });
    expect(all).toHaveAttribute("aria-pressed", "false");
    await user.click(all);
    expect(all).toHaveAttribute("aria-pressed", "true");
    const cards = within(screen.getByRole("list", { name: "La muletilla número uno de cada uno" })).getAllByRole(
      "listitem",
    );
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Bruno");
    expect(cards[0]).toHaveTextContent("«mirá vos»");
    expect(cards[0]).toHaveTextContent("40 veces");
    expect(cards[2]).toHaveTextContent("Ana");
    expect(cards[2]).toHaveTextContent("Nada que mostrar todavía.");

    // A card picks that person.
    await user.click(within(cards[0]!).getByRole("button"));
    expect(screen.getByRole("button", { name: "Bruno" })).toHaveAttribute("aria-pressed", "true");
    expect(
      within(await screen.findByRole("list", { name: "Muletillas de Bruno" })).getAllByRole("listitem"),
    ).toHaveLength(4);
  });

  it("shows the group's top muletilla as the record", () => {
    mockReducedMotion(true);
    render(<Muletillas data={fx.language.muletillas} people={people} top={fx.language.top.muletilla} />);
    expect(screen.getByText("La muletilla más propia del grupo")).toBeInTheDocument();
    expect(screen.getByTestId("record-value")).toHaveAttribute("aria-label", "40");
    expect(screen.getByText("Tomi, desde octubre de 2023")).toBeInTheDocument();
    expect(screen.getByText("· «mirá vos»")).toBeInTheDocument();
  });

  it("types before each of the first three bubbles on the first selection only", async () => {
    mockReducedMotion(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Muletillas data={fx.language.muletillas} people={people} />);
    const items = () => within(thread("Tomi")).getAllByRole("listitem");
    const arrived = () => items().filter((li) => li.dataset.arrived === "true").length;
    const typing = () => items().findIndex((li) => li.dataset.typing === "true");

    await act(async () => vi.advanceTimersByTime(10));
    expect(typing()).toBe(0);
    expect(arrived()).toBe(0);
    await act(async () => vi.advanceTimersByTime(TYPING_MS));
    expect(arrived()).toBe(1);
    expect(typing()).toBe(-1);
    await act(async () => vi.advanceTimersByTime(PAUSE_MS));
    expect(typing()).toBe(1);
    // Third bubble lands at 3 typings + 2 pauses; the rest follow one per stagger, untyped.
    await act(async () => vi.advanceTimersByTime(2 * TYPING_MS + PAUSE_MS));
    expect(arrived()).toBe(3);
    await act(async () => vi.advanceTimersByTime(PAUSE_MS + STAGGER_MS));
    expect(arrived()).toBe(5);
    expect(typing()).toBe(-1);
    await act(async () => vi.advanceTimersByTime(5 * STAGGER_MS));
    expect(arrived()).toBe(10);

    // A later selection: no typing, straight stagger after the previous thread leaves.
    await user.click(screen.getByRole("button", { name: "Ana" }));
    // Step (the previous thread's exit runs on Motion frames, driven by `tick`) until Ana's three bubbles have
    // landed, sampling for typing dots on every step.
    const seenTyping: boolean[] = [];
    for (let k = 0; k < 25; k++) {
      await tick(STAGGER_MS);
      const list = screen.queryByRole("list", { name: "Muletillas de Ana" });
      if (!list) continue;
      const lis = within(list).getAllByRole("listitem");
      seenTyping.push(lis.some((li) => li.dataset.typing === "true"));
      if (lis.every((li) => li.dataset.arrived === "true")) break;
    }
    const ana = within(thread("Ana")).getAllByRole("listitem");
    expect(ana.every((li) => li.dataset.arrived === "true")).toBe(true);
    expect(seenTyping.length).toBeGreaterThan(0);
    expect(seenTyping.some(Boolean)).toBe(false);
  });

  it("never flashes a stale arrival when chips are toggled faster than the switch", async () => {
    mockReducedMotion(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Muletillas data={fx.language.muletillas} people={people} />);
    await act(async () => vi.advanceTimersByTime(5000));
    expect(
      within(thread("Tomi"))
        .getAllByRole("listitem")
        .every((li) => li.dataset.arrived === "true"),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "Ana" }));
    await user.click(screen.getByRole("button", { name: "Tomi" }));
    const counts: number[] = [];
    for (let k = 0; k < 90; k++) {
      const list = screen.queryByRole("list", { name: "Muletillas de Tomi" });
      if (list)
        counts.push(
          within(list)
            .getAllByRole("listitem")
            .filter((li) => li.dataset.arrived === "true").length,
        );
      await tick(20);
    }
    // Arrivals only grow: no jump to 10 followed by a reset to 1.
    expect(counts.length).toBeGreaterThan(0);
    for (let k = 1; k < counts.length; k++) expect(counts[k]).toBeGreaterThanOrEqual(counts[k - 1]!);
    expect(counts.at(-1)).toBe(10);
  });

  it("keeps the thread when the selected person's chip or card is clicked again", async () => {
    mockReducedMotion(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Muletillas data={fx.language.muletillas} people={people} />);
    const arrived = () =>
      within(thread("Tomi"))
        .getAllByRole("listitem")
        .filter((li) => li.dataset.arrived === "true");
    await act(async () => vi.advanceTimersByTime(5000));
    expect(arrived()).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: "Tomi" }));
    await act(async () => vi.advanceTimersByTime(2000));
    expect(arrived()).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: "Todas" }));
    const cards = within(screen.getByRole("list", { name: "La muletilla número uno de cada uno" })).getAllByRole(
      "listitem",
    );
    await user.click(within(cards[1]!).getByRole("button"));
    await act(async () => vi.advanceTimersByTime(2000));
    expect(arrived()).toHaveLength(10);
  });
});
