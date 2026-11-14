import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { FastestPair, Latency } from "./Latency";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;
const rows = () => within(screen.getByRole("list", { name: "Mediana de respuesta por persona" })).getAllByRole("listitem");

describe("Latency", () => {
  it("puts each person's medians on a log axis, fastest repliers first", () => {
    mockReducedMotion(true);
    render(<Latency data={fx.rhythm.latency} people={people} />);
    expect(rows().map((r) => r.dataset.slug)).toEqual(["tomi", "bruno"]);
    // Domain [10, 60] s: 13 s sits at log(1.3) / log(6) of the way.
    const tomi = within(rows()[0]!);
    expect(parseFloat(tomi.getByTestId("dot-from").style.left)).toBeCloseTo((Math.log(1.3) / Math.log(6)) * 100, 2);
    expect(parseFloat(tomi.getByTestId("dot-to").style.left)).toBeCloseTo((Math.log(4) / Math.log(6)) * 100, 2);
    expect(rows()[0]).toHaveAttribute("title", "Tomi: responde en 13 s; le responden en 40 s");
    const ticks = screen.getAllByTestId("tick").map((t) => t.textContent);
    expect(ticks).toEqual(["10 s", "15 s", "20 s", "30 s", "1 min"]);
    expect(screen.getByRole("list", { name: "Velocidad de respuesta" })).toHaveTextContent("cuánto tarda en responder");
  });

  it("highlights one person in profile mode and dims the rest", () => {
    mockReducedMotion(true);
    render(<Latency data={fx.rhythm.latency} people={people} person="bruno" />);
    const [tomi, bruno] = rows();
    expect(bruno).toHaveAttribute("data-active", "true");
    expect(tomi).toHaveAttribute("data-dim", "true");
  });

  it("says the times are per minute only when the export has no seconds", () => {
    mockReducedMotion(true);
    const note = "Este export no trae segundos: los tiempos están al minuto.";
    const { unmount } = render(<Latency data={fx.rhythm.latency} people={people} />);
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    unmount();
    render(<Latency data={fx.rhythm.latency} people={people} minuteResolution />);
    expect(screen.getByText(note)).toBeInTheDocument();
  });

  it("shows the empty state without medians", () => {
    render(<Latency data={[]} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
  it("says so in profile mode when the person has no replies to measure, instead of dimming everyone", () => {
    mockReducedMotion(true);
    render(<Latency data={fx.rhythm.latency} people={people} person="ana" />);
    expect(screen.getByText("Sin respuestas para medir.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Mediana de respuesta por persona" })).not.toBeInTheDocument();
  });
});

describe("FastestPair", () => {
  it("shows the two messages in order with the gap between them", () => {
    mockReducedMotion(true);
    const fastest = { ...fx.rhythm.fastest!, seconds: 1.8 };
    render(<FastestPair fastest={fastest} people={people} />);
    const pair = screen.getByRole("list", { name: "Los dos mensajes" });
    const items = within(pair).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Bruno");
    expect(items[0]).toHaveTextContent("Ya saliste para el bar?");
    expect(items[1]).toHaveTextContent("1,8 s");
    expect(items[2]).toHaveTextContent("Tomi");
    expect(items[2]).toHaveTextContent("Llego en cinco");
  });
});
