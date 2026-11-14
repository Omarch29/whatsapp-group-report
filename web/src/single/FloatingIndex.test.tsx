import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../content/copy";
import { FloatingIndex } from "./FloatingIndex";

afterEach(() => vi.unstubAllGlobals());

const BLOCKS = [
  { id: "intro", title: "Introducción" },
  { id: "timeline", title: "Línea de tiempo" },
  { id: "race", title: "La carrera" },
];

describe("FloatingIndex", () => {
  it("lists the blocks it is given as in-page anchors", () => {
    render(<FloatingIndex blocks={BLOCKS} />);
    const nav = screen.getByRole("navigation", { name: copy.single.index });
    expect(within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Introducción", "#intro"],
      ["Línea de tiempo", "#timeline"],
      ["La carrera", "#race"],
    ]);
  });

  it("marks the block being read", () => {
    const observers: { cb: IntersectionObserverCallback }[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(public cb: IntersectionObserverCallback) {
          observers.push(this);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
        takeRecords() {
          return [];
        }
      },
    );
    render(
      <>
        <section id="intro" data-block />
        <section id="timeline" data-block />
        <FloatingIndex blocks={BLOCKS} />
      </>,
    );
    const timeline = document.getElementById("timeline")!;
    act(() => observers[0]!.cb([{ target: timeline, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
    const nav = screen.getByRole("navigation", { name: copy.single.index });
    expect(within(nav).getByRole("link", { name: "Línea de tiempo" })).toHaveAttribute("aria-current", "location");
    expect(within(nav).getByRole("link", { name: "Introducción" })).not.toHaveAttribute("aria-current");
  });

  it("on mobile, the button opens a sheet that closes on Escape and gives focus back", async () => {
    const user = userEvent.setup();
    render(<FloatingIndex blocks={BLOCKS} />);
    const btn = screen.getByRole("button", { name: copy.single.open });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await user.click(btn);
    const sheet = screen.getByRole("dialog", { name: copy.single.index });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(within(sheet).getByRole("button", { name: copy.single.close })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(btn).toHaveFocus();
  });

  it("closes the sheet when an item is chosen, the backdrop is clicked or the close button is pressed", async () => {
    const user = userEvent.setup();
    render(<FloatingIndex blocks={BLOCKS} />);
    const btn = screen.getByRole("button", { name: copy.single.open });
    await user.click(btn);
    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "La carrera" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(btn);
    await user.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(btn);
    await user.click(screen.getByRole("button", { name: copy.single.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
