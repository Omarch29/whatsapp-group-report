import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Race } from "./Race";

const people = fx.global.people;
const months = ["2023-09", "2023-10"];
const series = { tomi: [0, 5], ana: [3, 1] };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const rowOrder = () =>
  screen.getAllByTestId(/^row-/).map((el) => el.getAttribute("data-testid")?.replace("row-", ""));

describe("Race", () => {
  it("renders a dimmed zero bar for people without messages that month", () => {
    mockReducedMotion(true);
    render(<Race months={months} series={series} people={people} lede="" autoplay={false} />);
    expect(screen.getByTestId("row-tomi")).toHaveAttribute("data-zero", "true");
    expect(screen.getByTestId("row-ana")).toHaveAttribute("data-zero", "false");
    expect(screen.getByTestId("row-tomi")).not.toHaveTextContent("NaN");
  });

  it("animates month changes with full motion and lands on the final values", async () => {
    mockReducedMotion(false);
    render(<Race months={months} series={series} people={people} lede="" autoplay={false} />);
    fireEvent.change(screen.getByRole("slider", { name: "Mes" }), { target: { value: "1" } });
    expect(screen.getByText("2023-10")).toBeInTheDocument();
    expect(rowOrder()).toEqual(["tomi", "ana"]);
    await waitFor(() => expect(screen.getByTestId("row-tomi")).toHaveTextContent("5"));
    expect(screen.getByTestId("row-ana")).toHaveTextContent("4");
  });

  it("only shows profiled people that appear in the series", () => {
    mockReducedMotion(true);
    render(<Race months={months} series={{ ...series, resto: [9, 9] }} people={people} lede="" autoplay={false} />);
    expect(rowOrder()).toEqual(["ana", "tomi"]);
  });

  it("slider changes the month label and the order", () => {
    mockReducedMotion(true);
    render(<Race months={months} series={series} people={people} lede="" autoplay={false} />);
    expect(screen.getByText("2023-09")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "Mes" }), { target: { value: "1" } });
    expect(screen.getByText("2023-10")).toBeInTheDocument();
    expect(rowOrder()).toEqual(["tomi", "ana"]);
    expect(screen.getByTestId("row-tomi")).toHaveAttribute("data-zero", "false");
  });

  it("play advances a month every 650 ms and reset goes back", () => {
    mockReducedMotion(true);
    vi.useFakeTimers();
    render(<Race months={months} series={series} people={people} lede="" autoplay={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pausa" })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(650));
    expect(screen.getByText("2023-10")).toBeInTheDocument();
    // reached the last month: back to "Play"
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver al inicio" }));
    expect(screen.getByText("2023-09")).toBeInTheDocument();
  });

  it("autoplay starts playing once the section is seen", () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    render(<Race months={months} series={series} people={people} lede="" />);
    expect(screen.getByRole("button", { name: "Pausa" })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(650));
    expect(screen.getByText("2023-10")).toBeInTheDocument();
  });

  it("clears the interval on unmount", () => {
    mockReducedMotion(true);
    vi.useFakeTimers();
    const { unmount } = render(<Race months={months} series={series} people={people} lede="" autoplay={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("under reduced motion autoplay jumps to the last month without playing", () => {
    mockReducedMotion(true);
    render(<Race months={months} series={series} people={people} lede="" />);
    expect(screen.getByText("2023-10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("marks the highlighted person", () => {
    mockReducedMotion(true);
    render(<Race months={months} series={series} people={people} highlight="ana" lede="" autoplay={false} />);
    expect(screen.getByTestId("row-ana")).toHaveAttribute("data-highlight", "true");
    expect(screen.getByTestId("row-tomi")).not.toHaveAttribute("data-highlight");
  });
});
