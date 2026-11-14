import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { EventCard } from "./EventCard";

afterEach(() => vi.unstubAllGlobals());

describe("EventCard", () => {
  it("escapes html-like text in samples", () => {
    render(<EventCard rank={1} event={{ ...fx.events[0]!, sampleOrigin: ["<b>hola</b>"] }} />);
    expect(screen.getByText("<b>hola</b>")).toBeInTheDocument();
    expect(document.querySelector("b")).toBeNull();
  });

  it("shows rank, title, kind and stats on the front, samples and note on the back", () => {
    const event = fx.events[0]!;
    render(<EventCard rank={3} event={event} />);
    const card = screen.getByTestId("event-card");
    expect(card).toHaveAttribute("data-kind", "saga");
    expect(card).toHaveAttribute("aria-label", event.title);
    expect(card).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("heading", { level: 3, name: event.title })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/saga · origen 11\/10\/2023/)).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("Nadie se mueve hasta los penales", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(event.note)).toBeInTheDocument();
  });

  it("renders at most 3 origin samples", () => {
    const sampleOrigin = ["uno", "dos", "tres", "cuatro"];
    render(<EventCard rank={1} event={{ ...fx.events[0]!, sampleOrigin }} />);
    expect(screen.getByText("tres")).toBeInTheDocument();
    expect(screen.queryByText("cuatro")).not.toBeInTheDocument();
  });

  it("tap toggles flip", () => {
    render(<EventCard rank={1} event={fx.events[0]!} />);
    const card = screen.getByTestId("event-card");
    expect(card).toHaveAttribute("role", "button");
    expect(card).toHaveAttribute("aria-pressed", "false");
    fireEvent.pointerDown(card, { pointerType: "touch" });
    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "false");
  });

  it("flips only on Enter/Space, not on focus, and ignores key repeat", async () => {
    const user = userEvent.setup();
    render(<EventCard rank={1} event={fx.events[0]!} />);
    const card = screen.getByTestId("event-card");
    card.focus();
    expect(card).toHaveAttribute("aria-pressed", "false");
    await user.keyboard("{Enter}");
    expect(card).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Enter}");
    expect(card).toHaveAttribute("aria-pressed", "false");
    await user.keyboard(" ");
    expect(card).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(card, { key: " ", repeat: true });
    expect(card).toHaveAttribute("aria-pressed", "true");
    card.blur();
    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles on a click with no preceding pointerdown (assistive tech)", () => {
    render(<EventCard rank={1} event={fx.events[0]!} />);
    const card = screen.getByTestId("event-card");
    fireEvent.pointerEnter(card, { pointerType: "mouse" });
    fireEvent.pointerDown(card, { pointerType: "mouse" });
    fireEvent.click(card);
    fireEvent.pointerLeave(card, { pointerType: "mouse" });
    expect(card).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("describes the card with its stats, samples and note", () => {
    render(<EventCard rank={1} event={fx.events[0]!} />);
    const ids = screen.getByTestId("event-card").getAttribute("aria-describedby")!.split(" ");
    const text = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
    expect(ids).toHaveLength(2);
    expect(text).toContain("días lo volvieron a nombrar");
    expect(text).toContain("Nadie se mueve hasta los penales");
    expect(text).toContain(fx.events[0]!.note);
  });

  it("flips on mouse hover and back on leave, and a mouse click does not undo the hover", () => {
    render(<EventCard rank={1} event={fx.events[0]!} />);
    const card = screen.getByTestId("event-card");
    fireEvent.pointerEnter(card, { pointerType: "mouse" });
    expect(card).toHaveAttribute("aria-pressed", "true");
    fireEvent.pointerDown(card, { pointerType: "mouse" });
    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    fireEvent.pointerLeave(card, { pointerType: "mouse" });
    expect(card).toHaveAttribute("aria-pressed", "false");
  });

  it("ignores touch pointerenter (tap toggles instead)", () => {
    render(<EventCard rank={1} event={fx.events[0]!} />);
    const card = screen.getByTestId("event-card");
    fireEvent.pointerEnter(card, { pointerType: "touch" });
    expect(card).toHaveAttribute("aria-pressed", "false");
  });
});
