import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fx } from "@/test/fixtures";
import { Painted } from "./Painted";

describe("<Painted>", () => {
  it("paints whole-word names of the given people only", () => {
    const { container } = render(
      <p>
        <Painted text="Tomi le ganó a Ana y a Pepe." who={["tomi", "ana"]} people={fx.global.people} />
      </p>,
    );
    const bold = [...container.querySelectorAll("b")];
    expect(bold.map((b) => b.textContent)).toEqual(["Tomi", "Ana"]);
    expect(bold[0]!.style.color).toBe("rgb(242, 201, 76)");
    expect(container.textContent).toBe("Tomi le ganó a Ana y a Pepe.");
  });

  it("uses the paper color for people without a palette color", () => {
    const { container } = render(<Painted text="Resto ganó." who={["resto"]} people={fx.global.people} />);
    expect(container.querySelector("b")!.style.color).toBe("var(--paper)");
  });
});
