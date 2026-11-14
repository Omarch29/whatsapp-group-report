import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, Criterion, Lede } from "./Block";

describe("<Block>", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders title, lede, criterion and anchors the section by id", () => {
    render(
      <Block id="muletillas" title="Muletillas" lede="Tomi dijo «mirá vos» 412 veces." criterion="Frases de 2 a 5 palabras.">
        x
      </Block>,
    );
    const section = screen.getByRole("region", { name: "Muletillas" });
    expect(section).toHaveAttribute("id", "muletillas");
    expect(section).toHaveAttribute("data-block");
    expect(screen.getByText("Frases de 2 a 5 palabras.")).toBeInTheDocument();
    expect(screen.getByText("Tomi dijo «mirá vos» 412 veces.")).toBeInTheDocument();
  });

  it("keeps a hidden title as the region's name (single-block chapters)", () => {
    render(
      <Block id="awards" title="Premios" hideTitle>
        x
      </Block>,
    );
    const heading = screen.getByRole("heading", { level: 3, name: "Premios" });
    expect(heading.className).toContain("hiddenTitle");
    expect(screen.getByRole("region", { name: "Premios" })).toHaveAttribute("id", "awards");
  });

  it("renders children and record, and omits the criterion when absent", () => {
    render(
      <Block id="a" title="A" lede="l" record={<p>el récord</p>}>
        <p>el gráfico</p>
      </Block>,
    );
    expect(screen.getByText("el gráfico")).toBeInTheDocument();
    expect(screen.getByText("el récord")).toBeInTheDocument();
    expect(document.querySelector("[data-criterion]")).toBeNull();
  });

  it("omits the lede when absent so a child can render its own (Lede / Criterion)", () => {
    const { container } = render(
      <Block id="m" title="M">
        <Lede>lede viva</Lede>
        <Criterion>el criterio</Criterion>
      </Block>,
    );
    // No empty lede paragraph: the first thing after the title is the child's lede.
    expect(container.querySelector("section > h3 + p")).toHaveTextContent("lede viva");
    expect(screen.getByText("lede viva").tagName).toBe("P");
    expect(screen.getByText("el criterio")).toHaveAttribute("data-criterion");
  });

  it("copies the block link and announces it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <Block id="top" title="T" lede="l">
        x
      </Block>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(writeText).toHaveBeenCalledWith(`${location.origin}${location.pathname}#top`);
    expect(screen.getByRole("status")).toHaveTextContent("Link copiado");
  });

  it("clears the announcement after 2 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Block id="top" title="T" lede="l">
        x
      </Block>,
    );
    await user.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(screen.getByRole("status")).toHaveTextContent("Link copiado");
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says it could not copy when the clipboard is missing or rejects", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const { unmount } = render(
      <Block id="top" title="T" lede="l">
        x
      </Block>,
    );
    await user.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo copiar");
    unmount();

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    render(
      <Block id="top" title="T" lede="l">
        x
      </Block>,
    );
    await user.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo copiar");
  });
});
