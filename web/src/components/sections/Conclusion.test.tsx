import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConclusionPage from "@/chapters/conclusion";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Conclusion } from "./Conclusion";

afterEach(() => vi.unstubAllGlobals());

describe("Conclusion", () => {
  it("renders the paragraphs, the signature and three closing numbers", () => {
    render(<Conclusion paragraphs={["Uno.", "Dos.", "— Ana"]} facts={fx.facts} />);
    expect(screen.getByText("Uno.")).toBeInTheDocument();
    expect(screen.getByText("— Ana")).toHaveAttribute("data-signature");
    const tiles = within(screen.getByRole("list", { name: "El grupo en tres números" })).getAllByRole("listitem");
    expect(tiles.map((t) => t.textContent)).toEqual(["1.000mensajes", "80días con mensajes", "12premios"]);
  });

  it("the page ends with «Volver al principio»", async () => {
    mockReducedMotion(true);
    const { container } = render(await ConclusionPage());
    expect(screen.getByRole("link", { name: "Volver al principio" })).toHaveAttribute("href", "/");
    expect(container.querySelector("#text[data-block]")).not.toBeNull();
    expect(container).toHaveTextContent("— Ana");
    expect(container).not.toHaveTextContent("BORRADOR");
  });
});
