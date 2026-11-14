import { act, fireEvent, render, screen } from "@testing-library/react";
import { gsap } from "gsap";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Heatmap } from "./Heatmap";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const cell = (d: number, h: number): HTMLElement => {
  const el = screen
    .getAllByRole("gridcell")
    .find(
      (c) =>
        c.getAttribute("data-d") === String(d) &&
        c.getAttribute("data-h") === String(h),
    );
  if (!el) throw new Error(`no cell ${d},${h}`);
  return el;
};

describe("Heatmap", () => {
  it("renders 168 cells with the peak labelled", () => {
    render(<Heatmap group={fx.global.heatmap} lede="" />);
    expect(
      screen.getByRole("grid", { name: "Mensajes por hora y día" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(168);
    const peaks = screen
      .getAllByRole("gridcell")
      .filter((c) => c.getAttribute("data-peak") === "true");
    expect(peaks).toHaveLength(1);
    expect(peaks[0]).toBe(cell(4, 11));
    expect(cell(4, 16)).toHaveAttribute("aria-label", "Vie 16:00 · 1 msg");
    expect(cell(4, 11)).toHaveAttribute("aria-label", "Vie 11:00 · 40 msgs");
  });

  it("cells are visible under reduced motion", () => {
    mockReducedMotion(true);
    render(<Heatmap group={fx.global.heatmap} lede="" />);
    for (const c of screen.getAllByRole("gridcell")) {
      expect(c.style.transform).not.toContain("scale(0)");
      expect(c.style.opacity).not.toBe("0");
    }
  });

  it("toggle switches dataset", () => {
    mockReducedMotion(true);
    const people = [
      { slug: "bruno", name: "Bruno", heatmap: fx.person.heatmap },
    ];
    render(<Heatmap group={fx.global.heatmap} people={people} lede="" />);
    const group = screen.getByRole("button", { name: "Grupo" });
    const bruno = screen.getByRole("button", { name: "Bruno" });
    expect(group).toHaveAttribute("aria-pressed", "true");
    expect(cell(4, 16)).toHaveAttribute(
      "data-v",
      String(fx.global.heatmap[4]?.[16]),
    );
    expect(cell(2, 22)).toHaveAttribute(
      "data-v",
      String(fx.global.heatmap[2]?.[22]),
    );
    fireEvent.click(bruno);
    expect(bruno).toHaveAttribute("aria-pressed", "true");
    expect(group).toHaveAttribute("aria-pressed", "false");
    expect(cell(4, 16)).toHaveAttribute(
      "data-v",
      String(fx.person.heatmap[4]?.[16]),
    );
    expect(cell(2, 22)).toHaveAttribute(
      "data-v",
      String(fx.person.heatmap[2]?.[22]),
    );
    expect(cell(2, 22)).toHaveAttribute("data-peak", "true");
    expect(cell(4, 11)).not.toHaveAttribute("data-peak", "true");
  });

  it("shows the tooltip on hover and touch, hides it on leave", () => {
    mockReducedMotion(true);
    render(<Heatmap group={fx.global.heatmap} lede="" />);
    expect(screen.queryByTestId("heat-tooltip")).toBeNull();
    fireEvent.pointerMove(cell(4, 11), {
      pointerType: "mouse",
      clientX: 50,
      clientY: 50,
    });
    expect(screen.getByTestId("heat-tooltip")).toHaveTextContent(
      "Vie 11:00 · 40 msgs",
    );
    fireEvent.pointerLeave(screen.getByRole("grid"), { pointerType: "mouse" });
    expect(screen.queryByTestId("heat-tooltip")).toBeNull();
    fireEvent.pointerDown(cell(0, 9), {
      pointerType: "touch",
      clientX: 10,
      clientY: 10,
    });
    expect(screen.getByTestId("heat-tooltip")).toHaveTextContent(
      "Lun 09:00 · 1 msg",
    );
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(screen.queryByTestId("heat-tooltip")).toBeNull();
  });

  it("shows the peak line under the grid when given", () => {
    mockReducedMotion(true);
    render(
      <Heatmap
        group={fx.global.heatmap}
        lede="x"
        peak="El pico: los viernes a las 11 h."
      />,
    );
    expect(
      screen.getByText("El pico: los viernes a las 11 h."),
    ).toBeInTheDocument();
  });

  it("hides the group's peak line while a person is selected", () => {
    mockReducedMotion(true);
    const people = [{ slug: "tomi", name: "Tomi", heatmap: fx.person.heatmap, colorIndex: 1 }];
    render(<Heatmap group={fx.global.heatmap} people={people} lede="x" peak="El pico del grupo" />);
    fireEvent.click(screen.getByRole("button", { name: "Tomi" }));
    expect(screen.queryByText("El pico del grupo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Grupo" }));
    expect(screen.getByText("El pico del grupo")).toBeInTheDocument();
  });
});

describe("Heatmap entrance", () => {
  it("hides cells before the reveal and reverts on unmount", () => {
    mockReducedMotion(false);
    const { unmount } = render(<Heatmap group={fx.global.heatmap} lede="" />);
    // jsdom has no IntersectionObserver, so the wave starts at once; cells begin from scale(0).
    expect(
      screen
        .getAllByRole("gridcell")
        .some((c) => c.style.transform.includes("scale(0")),
    ).toBe(true);
    const cells = screen.getAllByRole("gridcell");
    unmount();
    expect(cells.every((c) => !c.style.transform.includes("scale(0"))).toBe(
      true,
    );
  });
});

describe("Heatmap color ramp", () => {
  const sparse = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => (d === 2 && h === 5 ? 10 : 0)),
  );

  it("runs from mine (zero) to gold (max) and recolors on toggle", () => {
    mockReducedMotion(true);
    const people = [
      { slug: "bruno", name: "Bruno", heatmap: fx.person.heatmap },
    ];
    render(<Heatmap group={sparse} people={people} lede="" />);
    expect(cell(2, 5).style.backgroundColor).toBe("rgb(242, 201, 76)");
    expect(cell(0, 0).style.backgroundColor).toBe("rgb(0, 92, 75)");
    fireEvent.click(screen.getByRole("button", { name: "Bruno" }));
    expect(cell(2, 5).style.backgroundColor).not.toBe("rgb(242, 201, 76)");
    expect(cell(2, 22).style.backgroundColor).toBe("rgb(242, 201, 76)");
  });

  it("staggers the wave from Monday 9h with back.out(2)", () => {
    mockReducedMotion(false);
    const to = vi.spyOn(gsap, "to");
    render(<Heatmap group={fx.global.heatmap} lede="" />);
    expect(to).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ease: "back.out(2)",
        stagger: expect.objectContaining({
          each: 0.012,
          grid: [7, 24],
          from: [9.5 / 24, 0.5 / 7],
        }),
      }),
    );
  });
});

describe("Heatmap tooltip clamping", () => {
  it("keeps the tooltip inside the section on the very first show at the right edge", () => {
    mockReducedMotion(true);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(150);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 390,
      bottom: 800,
      width: 390,
      height: 800,
      toJSON: () => ({}),
    });
    render(<Heatmap group={fx.global.heatmap} lede="" />);
    fireEvent.pointerDown(cell(0, 23), {
      pointerType: "touch",
      clientX: 385,
      clientY: 100,
    });
    expect(screen.getByTestId("heat-tooltip").style.left).toBe("315px");
    fireEvent.pointerDown(cell(0, 0), {
      pointerType: "touch",
      clientX: 2,
      clientY: 100,
    });
    expect(screen.getByTestId("heat-tooltip").style.left).toBe("75px");
  });
});
