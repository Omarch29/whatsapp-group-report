import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { stubSilentIO } from "@/test/io";
import { mockReducedMotion } from "@/test/motion";
import { Top } from "./Top";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;

describe("emojis Top", () => {
  it("sizes each emoji by use, biggest first", () => {
    mockReducedMotion(true);
    render(<Top data={fx.emojis.top} people={people} />);
    const emojis = screen.getAllByTestId("emoji");
    expect(emojis.map((e) => e.textContent)).toEqual(["😂", "❌", "🤝"]);
    const sizes = emojis.map((e) => parseFloat(e.style.fontSize));
    expect(sizes[0]).toBeGreaterThan(sizes[1]!);
    expect(sizes[1]).toBeGreaterThan(sizes[2]!);
  });

  it("tapping an emoji shows who uses it most (aria-expanded); tapping again or Escape closes it", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<Top data={fx.emojis.top} people={people} />);
    const laugh = screen.getAllByTestId("emoji")[0]!;
    expect(laugh).toHaveAttribute("aria-expanded", "false");
    await user.click(laugh);
    expect(laugh).toHaveAttribute("aria-expanded", "true");
    const item = laugh.closest("li")!;
    expect(item).toHaveAttribute("data-open");
    expect(within(item).getByRole("note")).toHaveTextContent("120 veces · lo usa más: Tomi");
    await user.click(laugh);
    expect(laugh).toHaveAttribute("aria-expanded", "false");
    await user.click(laugh);
    await user.keyboard("{Escape}");
    expect(laugh).toHaveAttribute("aria-expanded", "false");
  });

  it("says only the count when nobody with a profile tops it", () => {
    mockReducedMotion(true);
    render(<Top data={fx.emojis.top} people={people} />);
    const shake = screen.getAllByTestId("emoji")[2]!.closest("li")!;
    expect(within(shake).getByRole("note")).toHaveTextContent(/^3 veces$/);
  });

  it("hides the emojis until seen with motion on, and shows them under reduced motion", () => {
    mockReducedMotion(false);
    stubSilentIO();
    const { unmount } = render(<Top data={fx.emojis.top} people={people} />);
    expect(screen.getAllByTestId("emoji")[0]!.closest("li")).toHaveAttribute("data-hidden");
    unmount();
    vi.unstubAllGlobals();
    mockReducedMotion(true);
    render(<Top data={fx.emojis.top} people={people} />);
    expect(screen.getAllByTestId("emoji")[0]!.closest("li")).not.toHaveAttribute("data-hidden");
  });

  it("shows the empty state without emojis", () => {
    render(<Top data={[]} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
