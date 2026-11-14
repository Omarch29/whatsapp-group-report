import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fmt } from "@/lib/format";
import { loadCensus, loadGlobal } from "@/lib/data";
import { topPersonYear } from "@/lib/census";
import { mockReducedMotion } from "@/test/motion";
import Censo from "./censo";

afterEach(() => vi.unstubAllGlobals());

// Against the real web/data files.
describe("/censo/", () => {
  it("gives the by-year block a record: the biggest single person-year", async () => {
    mockReducedMotion(true);
    const [g, census] = await Promise.all([loadGlobal(), loadCensus()]);
    const top = topPersonYear(census.byYear)!;
    const name = g.people.find((p) => p.slug === top.slug)!.name;
    const { container } = render(await Censo());
    const block = within(container.querySelector<HTMLElement>("#by-year")!);
    expect(block.getByText("El año de una sola persona")).toBeInTheDocument();
    expect(block.getByText(`${name}, en ${top.year}`)).toBeInTheDocument();
    expect(block.getByTestId("record-value")).toHaveAttribute("aria-label", fmt(top.value));
  });

  it("shows whole days for the longest name and says «lleva» while it is still the group's name", async () => {
    mockReducedMotion(true);
    const [g, census] = await Promise.all([loadGlobal(), loadCensus()]);
    const longest = census.names.longest!;
    const current = longest.to.slice(0, 10) === g.period.to;
    const { container } = render(await Censo());
    const text = container.querySelector("#timeline")!.textContent;
    expect(text).toContain(`El nombre que más duró ${current ? "lleva" : "aguantó"} ${fmt(Math.floor(longest.days))} días`);
    expect(text).not.toMatch(/\d+,\d+ días/);
  });

  it("states the 30-day gap threshold in the tenure criterion (a value, not a client reference)", async () => {
    mockReducedMotion(true);
    const { container } = render(await Censo());
    expect(container.querySelector("#tenure [data-criterion]")).toHaveTextContent("más de 30 días seguidos");
  });
});
