import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { stubSilentIO } from "@/test/io";
import { mockReducedMotion } from "@/test/motion";
import { StartersKillers } from "./StartersKillers";

afterEach(() => vi.unstubAllGlobals());

const people = fx.global.people;
const rows = () => within(screen.getByRole("list", { name: "Arranques y cierres por persona" })).getAllByRole("listitem");

describe("StartersKillers", () => {
  it("draws a starter and a killer bar per person on one shared scale", () => {
    mockReducedMotion(true);
    render(<StartersKillers starters={fx.rhythm.starters} killers={fx.rhythm.killers} people={people} />);
    expect(rows().map((r) => r.dataset.slug)).toEqual(["tomi", "bruno", "ana"]);
    const tomi = within(rows()[0]!);
    expect(tomi.getByTestId("starts-bar")).toHaveAttribute("title", "Tomi · arranca: 30");
    expect(tomi.getByTestId("kills-bar")).toHaveAttribute("title", "Tomi · mata: 9");
    expect(tomi.getByTestId("starts-bar").style.width).toBe("100%");
    const ana = within(rows()[2]!);
    expect(parseFloat(ana.getByTestId("kills-bar").style.width)).toBeCloseTo((25 / 30) * 100, 2);
    expect(ana.getByTestId("starts-bar").style.width).toBe("0%");
    expect(screen.getByRole("list", { name: "Arranca y mata" })).toHaveTextContent("mata");
  });

  it("starts collapsed until seen, final under reduced motion", () => {
    stubSilentIO();
    const { container, unmount } = render(
      <StartersKillers starters={fx.rhythm.starters} killers={fx.rhythm.killers} people={people} />,
    );
    expect(container.querySelector("[data-seen]")).toHaveAttribute("data-seen", "false");
    unmount();
    mockReducedMotion(true);
    const again = render(<StartersKillers starters={fx.rhythm.starters} killers={fx.rhythm.killers} people={people} />);
    expect(again.container.querySelector("[data-seen]")).toHaveAttribute("data-seen", "true");
  });

  it("shows the empty state without data", () => {
    render(<StartersKillers starters={[]} killers={[]} people={people} />);
    expect(screen.getByText("Nada que mostrar todavía.")).toBeInTheDocument();
  });
});
