import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonData, RecordsData } from "@/lib/schema";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { PollBars } from "../PollBars";
import { RecordPair } from "../RecordPair";
import { Typewriter } from "../Typewriter";
import { Records } from "./Records";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Typewriter", () => {
  it("shows the whole text under reduced motion", () => {
    mockReducedMotion(true);
    render(<Typewriter text="hola mundo" />);
    expect(screen.getByText("hola mundo")).toBeInTheDocument();
  });

  it("types progressively and stops when it is done", () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    const text = "x".repeat(440);
    render(<Typewriter text={text} speed={10} />);
    const typed = () => screen.getByTestId("typewriter").textContent ?? "";
    expect(typed().length).toBe(0);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(typed().length).toBeGreaterThan(0);
    expect(typed().length).toBeLessThan(text.length);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(typed()).toBe(text);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer on unmount", () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    const { unmount } = render(<Typewriter text={"y".repeat(500)} />);
    act(() => {
      vi.advanceTimersByTime(40);
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("PollBars", () => {
  it("marks the winner", () => {
    render(<PollBars poll={fx.records.poll!} />);
    expect(screen.getByTestId("poll-winner").textContent).toContain("Ana");
  });

  it("lists options by votes, highest first, with proportional widths", () => {
    mockReducedMotion(true);
    render(<PollBars poll={fx.records.poll!} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Ana"),
      expect.stringContaining("Tomi"),
      expect.stringContaining("Bruno"),
      expect.stringContaining("Nadie"),
    ]);
    expect(within(rows[1]).getByTestId("poll-bar")).toHaveStyle({ width: "50%" });
  });
});

describe("RecordPair", () => {
  it("shows who and when", () => {
    render(
      <RecordPair
        label="Largo de mensaje"
        average={{ value: 27, unit: "caracteres de promedio" }}
        record={{ value: 6412, who: "tomi", when: "2026-03-09T20:17:43" }}
        people={fx.global.people}
      />,
    );
    expect(screen.getByText("Tomi, 09/03/2026")).toBeInTheDocument();
    expect(screen.getByText("27 caracteres de promedio")).toBeInTheDocument();
  });

  it("falls back to the capitalized slug and shows the final value under reduced motion", () => {
    mockReducedMotion(true);
    render(
      <RecordPair
        label="Racha"
        record={{ value: 6412, who: "pepe", when: "2026-03-09", unit: "días" }}
        caption="del 18/02/2026 al 09/03/2026"
        people={fx.global.people}
      />,
    );
    expect(screen.getByText("Pepe, 09/03/2026")).toBeInTheDocument();
    expect(screen.getByTestId("record-value").textContent).toBe("6.412");
    expect(screen.getByText(/del 18\/02\/2026 al 09\/03\/2026/)).toBeInTheDocument();
  });
});

describe("Records", () => {
  const people = fx.global.people;

  it("shows the group records, the poll and the quotes", () => {
    mockReducedMotion(true);
    render(<Records data={fx.records} people={people} recordLength={6412} />);
    expect(screen.getByRole("heading", { level: 2, name: "Récords" })).toBeInTheDocument();
    expect(screen.getAllByTestId("record-value").map((n) => n.textContent)).toEqual(["6.412", "120"]);
    expect(screen.getByText(/28 caracteres de promedio/)).toBeInTheDocument();
    expect(screen.getByTestId("poll-winner")).toBeInTheDocument();
    expect(screen.getAllByTestId("quote-funniest")).toHaveLength(fx.records.funniest.length);
    expect(screen.getAllByTestId("quote-replied")).toHaveLength(fx.records.mostReplied.length);
    expect(screen.getByText("11 risas · 3 personas")).toBeInTheDocument();
    expect(screen.getByText("81 respuestas · 3 personas")).toBeInTheDocument();
  });

  it("shows the latest-night message with who, date and time", () => {
    mockReducedMotion(true);
    render(<Records data={fx.records} people={people} />);
    const block = screen.getByTestId("latest-night");
    expect(block).toHaveTextContent("Sigo despierto");
    expect(screen.getByText("El mensaje más tarde de la historia")).toBeInTheDocument();
    expect(screen.getByText("Ana, 14/10/2023 a las 05:59")).toBeInTheDocument();
  });

  it("falls back to the record text length without recordLength", () => {
    mockReducedMotion(true);
    render(<Records data={fx.records} people={people} />);
    expect(screen.getAllByTestId("record-value")[0].textContent).toBe(
      String(fx.records.messageLength.record.text.length),
    );
  });

  it("reads the busiest day's count from msgs, not from the text", () => {
    mockReducedMotion(true);
    const data: RecordsData = {
      ...fx.records,
      messagesPerDay: { value: 54.2, record: { who: "bruno", when: "2025-10-04", text: "muchos", msgs: 1597 } },
    };
    render(<Records data={data} people={people} recordLength={6412} />);
    expect(screen.getAllByTestId("record-value")[1].textContent).toBe("1.597");
  });

  it("hides the poll when null", () => {
    mockReducedMotion(true);
    const data: RecordsData = { ...fx.records, poll: null, latestNight: null };
    render(<Records data={data} people={people} />);
    expect(screen.queryByTestId("poll-winner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("latest-night")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Récords" })).toBeInTheDocument();
  });

  it("renders only the parts it is given, anchored and with their criteria", () => {
    mockReducedMotion(true);
    const blockIds = { length: "length", perDay: "per-day", poll: "poll", night: "night", quotes: "quotes" };
    const criteria = { length: "c-length", perDay: "c-per-day", poll: "c-poll", night: "c-night", quotes: "c-quotes" };
    const { container } = render(
      <Records data={fx.records} people={people} blockIds={blockIds} criteria={criteria} parts={["length", "perDay", "night"]} copyLinks />,
    );
    expect(Array.from(container.querySelectorAll("[data-block]"), (el) => el.id)).toEqual(["length", "per-day", "night"]);
    expect(screen.getAllByTestId("record-value")).toHaveLength(2);
    expect(screen.getByTestId("latest-night")).toBeInTheDocument();
    expect(screen.queryByTestId("poll-winner")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("quote-funniest")).toHaveLength(0);
    expect(screen.queryAllByTestId("quote-replied")).toHaveLength(0);
    expect(screen.queryByText("c-poll")).not.toBeInTheDocument();
    expect(screen.queryByText("c-quotes")).not.toBeInTheDocument();
    expect(screen.getByText("c-night")).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll("[data-copy-link]"), (el) => el.getAttribute("data-copy-link"))).toEqual([
      "length", "per-day", "night",
    ]);
  });

  it("without parts renders every part (the chapter)", () => {
    mockReducedMotion(true);
    const blockIds = { length: "length", perDay: "per-day", poll: "poll", night: "night", quotes: "quotes" };
    const { container } = render(<Records data={fx.records} people={people} blockIds={blockIds} />);
    expect(Array.from(container.querySelectorAll("[data-block]"), (el) => el.id)).toEqual([
      "length", "per-day", "poll", "night", "quotes",
    ]);
  });

  it("person mode shows streak and silence, without poll or quotes", () => {
    mockReducedMotion(true);
    const person: PersonData = fx.person;
    render(<Records data={fx.records} people={people} person={person} />);
    expect(screen.getByText("Tomi, 01/10/2023")).toBeInTheDocument();
    expect(screen.getByText(/hasta el 21\/10\/2023/)).toBeInTheDocument();
    expect(screen.getByText("Tomi, 02/11/2023")).toBeInTheDocument();
    expect(screen.getByText(/hasta el 08\/11\/2023/)).toBeInTheDocument();
    expect(screen.queryByTestId("latest-night")).not.toBeInTheDocument();
    expect(screen.getByText("640")).toBeInTheDocument();
    expect(screen.queryByTestId("poll-winner")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("quote-funniest")).toHaveLength(0);
    expect(screen.queryAllByTestId("quote-replied")).toHaveLength(0);
  });
});
