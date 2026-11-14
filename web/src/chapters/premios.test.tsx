import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAwards } from "@/lib/data";
import { mockReducedMotion } from "@/test/motion";
import Premios from "./premios";

afterEach(() => vi.unstubAllGlobals());

// Against the real web/data files.
describe("/premios/", () => {
  it("shows the twelve awards, the lede with the count and the criterion; open under reduced motion", async () => {
    mockReducedMotion(true);
    const awards = await loadAwards();
    const { container } = render(await Premios());
    const block = within(container.querySelector<HTMLElement>("#awards")!);
    expect(block.getByRole("heading", { level: 3, name: "Premios" })).toBeInTheDocument();
    expect(container.querySelector("#awards")).toHaveTextContent("12 premios, cada uno con su ganador y dos finalistas.");
    expect(container.querySelector("#awards [data-criterion]")).toHaveTextContent("dos finalistas por premio");
    const envelopes = within(block.getByRole("list", { name: "Premios" })).getAllByRole("button");
    expect(envelopes).toHaveLength(awards.length);
    expect(envelopes.every((e) => e.getAttribute("aria-expanded") === "true")).toBe(true);
  });
});
