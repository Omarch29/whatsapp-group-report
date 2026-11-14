import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chapterById } from "@/lib/chapters";
import { loadGlobal, loadLanguage, loadRecords } from "@/lib/data";
import { fmt, fmtDate } from "@/lib/format";
import { mockReducedMotion } from "@/test/motion";
import Lenguaje from "./lenguaje";

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = "";
});

// Against the real web/data files.
describe("/lenguaje/", () => {
  it("renders the shared block link target for a deep link to #muletillas", async () => {
    mockReducedMotion(true);
    window.location.hash = "#muletillas";
    const { container } = render(await Lenguaje());
    expect(container.querySelector(window.location.hash)).not.toBeNull();
    expect(container.querySelector("#muletillas[data-block]")).not.toBeNull();
  });

  it("gives every block its title, a lede, the criterion, and keeps the anatomy order in muletillas", async () => {
    mockReducedMotion(true);
    const { container } = render(await Lenguaje());
    for (const b of chapterById("lenguaje").blocks) {
      const block = container.querySelector<HTMLElement>(`#${b.id}`)!;
      expect(within(block).getByRole("heading", { level: 3, name: b.title })).toBeInTheDocument();
      expect(block.querySelector("[data-criterion]"), b.id).not.toBeNull();
    }
    // Muletillas: the live lede sits between the title and the criterion.
    const mul = container.querySelector("#muletillas")!;
    const lede = mul.querySelector("h3 + div > p:first-child")!;
    expect(lede.textContent).toMatch(/dijo «.+» [\d.]+ veces?: [\d.]+ veces? más seguido que el resto del grupo\./);
    const criterion = mul.querySelector("[data-criterion]")!;
    expect(lede.compareDocumentPosition(criterion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(criterion).toHaveTextContent(
      "Frases de 2 a 5 palabras que una persona repite al menos 4 veces más por mil que el resto.",
    );
  });

  it("shows the records from the data", async () => {
    mockReducedMotion(true);
    const [g, lang] = await Promise.all([loadGlobal(), loadLanguage()]);
    const { container } = render(await Lenguaje());
    const top = lang.top.muletilla!;
    const mul = within(container.querySelector<HTMLElement>("#muletillas")!);
    expect(mul.getByText("La muletilla más propia del grupo")).toBeInTheDocument();
    expect(mul.getByTestId("record-value")).toHaveAttribute("aria-label", fmt(top.own));
    expect(mul.getByText(`· «${top.display}»`)).toBeInTheDocument();
    // Style: the record is the concrete longest message (the lede keeps the longest average).
    const records = await loadRecords();
    const rec = records.messageLength.record;
    const style = within(container.querySelector<HTMLElement>("#style")!);
    const name = g.people.find((p) => p.slug === rec.who)!.name;
    expect(style.getByText("El mensaje más largo")).toBeInTheDocument();
    expect(style.getByText(`${name}, ${fmtDate(rec.when)}`)).toBeInTheDocument();
    const value = Number(style.getByTestId("record-value").getAttribute("aria-label")!.replace(/\./g, ""));
    expect(value).toBeGreaterThanOrEqual(rec.text.length);
    expect(style.queryByText(/en todo el chat/)).toBeNull();
  });
});
