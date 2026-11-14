import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { stubSilentIO } from "@/test/io";
import { mockReducedMotion } from "@/test/motion";
import { Audios } from "./Audios";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;

describe("Audios", () => {
  it("draws the senders as bars, with the per mil in the tooltip", () => {
    mockReducedMotion(true);
    render(<Audios data={fx.media.audios} people={people} />);
    const rows = within(screen.getByRole("list", { name: "Audios por persona" })).getAllByRole("listitem");
    expect(rows.map((r) => r.dataset.slug)).toEqual(["ana", "bruno"]);
    expect(rows[0]).toHaveTextContent("20");
    expect(rows[0]).toHaveAttribute("title", "Ana: 133,3 por mil mensajes");
  });

  it("draws a 24-bar waveform by hour from the baseline, the peak hour marked", () => {
    mockReducedMotion(true);
    render(<Audios data={fx.media.audios} people={people} />);
    const wave = screen.getByRole("img", { name: "Audios por hora del día" });
    expect(wave).toHaveAttribute("data-seen", "true");
    const bars = within(wave).getAllByTestId("wave-bar");
    expect(bars).toHaveLength(24);
    const heights = bars.map((b) => Number(b.getAttribute("height")));
    expect(heights.indexOf(Math.max(...heights))).toBe(21);
    // Every bar sits on the same baseline.
    expect(new Set(bars.map((b) => Number(b.getAttribute("y")) + Number(b.getAttribute("height")))).size).toBe(1);
    expect(bars[21]).toHaveAttribute("data-peak", "true");
    expect(bars[21]!.querySelector("title")).toHaveTextContent("21 h: 12");
  });

  it("keeps the waveform flat until seen when motion is on", () => {
    mockReducedMotion(false);
    stubSilentIO();
    render(<Audios data={fx.media.audios} people={people} />);
    expect(screen.getByRole("img", { name: "Audios por hora del día" })).toHaveAttribute("data-seen", "false");
  });

  it("lists the audios per year", () => {
    mockReducedMotion(true);
    render(<Audios data={fx.media.audios} people={people} />);
    const years = within(screen.getByRole("list", { name: "Audios por año" })).getAllByRole("listitem");
    expect(years.map((y) => y.textContent)).toEqual(["202330", "20243"]);
  });

  it("shows the empty state without audios", () => {
    render(
      <Audios
        data={{ byPerson: [], byHour: Array.from({ length: 24 }, () => 0), byYear: { years: [], n: [] } }}
        people={people}
      />,
    );
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
