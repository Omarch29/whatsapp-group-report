import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { stubSilentIO } from "@/test/io";
import { mockReducedMotion } from "@/test/motion";
import { Rings } from "./Rings";

afterEach(() => vi.unstubAllGlobals());

describe("Rings", () => {
  it("draws 7 weekday and 12 month segments, the busiest in gold", () => {
    mockReducedMotion(true);
    render(<Rings data={fx.rhythm.rings} />);
    const dow = screen.getByRole("figure", { name: "Por día de la semana" });
    const segs = within(dow).getAllByTestId("segment");
    expect(segs).toHaveLength(7);
    expect(segs.filter((s) => s.dataset.peak === "true").map((s) => s.dataset.label)).toEqual(["dom"]);
    expect(within(dow).getAllByRole("listitem").at(-1)).toHaveTextContent("dom: 70");
    const month = screen.getByRole("figure", { name: "Por mes del año" });
    expect(within(month).getAllByTestId("segment")).toHaveLength(12);
    expect(within(month).getAllByText("ene")[0]).toBeInTheDocument();
    // Final state: every segment drawn.
    for (const s of segs) expect(Number(s.style.strokeDashoffset)).toBe(0);
  });

  it("keeps the segments undrawn until seen", () => {
    stubSilentIO();
    render(<Rings data={fx.rhythm.rings} />);
    const segs = within(screen.getByRole("figure", { name: "Por día de la semana" })).getAllByTestId("segment");
    expect(segs.every((s) => Number(s.style.strokeDashoffset) > 0)).toBe(true);
  });
});
