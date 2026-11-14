import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { Pairs } from "./Pairs";

// Capture the nodes handed to each simulation so tests can read fx/fy.
type N = { id: string; x?: number; y?: number; fx?: number | null; fy?: number | null };
const sims = vi.hoisted(() => ({
  nodes: [] as N[][],
  restarts: [] as Array<{ mock: { calls: unknown[] } }>,
  radial: [] as Array<{ radius: (d: N) => number; x: number; y: number }>,
}));
vi.mock("d3-force", async (importOriginal) => {
  const mod = await importOriginal<typeof import("d3-force")>();
  return {
    ...mod,
    forceSimulation: ((nodes: N[]) => {
      sims.nodes.push(nodes);
      const sim = mod.forceSimulation(nodes as never[]);
      sims.restarts.push(vi.spyOn(sim, "restart"));
      return sim;
    }) as unknown as typeof mod.forceSimulation,
    forceRadial: ((radius: (d: N) => number, x: number, y: number) => {
      sims.radial.push({ radius, x, y });
      return mod.forceRadial(radius as never, x, y);
    }) as unknown as typeof mod.forceRadial,
  };
});
const simNode = (id: string) => {
  const n = sims.nodes.at(-1)?.find((d) => d.id === id);
  if (!n) throw new Error(`no simulation node ${id}`);
  return n;
};

const { people } = fx.global;
// Three people and three edges: fewer than the K the derived threshold keeps, so every link renders.
const edges = fx.global.edges;

// Positions are published from requestAnimationFrame; hold those frames so the
// simulation never updates React state outside act(). Tests assert attributes only.
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const graph = () => screen.getByTestId("graph");
const circle = (id: string) => {
  const c = screen.getByTestId(`node-${id}`).querySelector("circle");
  if (!c) throw new Error(`no circle for ${id}`);
  return c;
};

describe("Pairs", () => {
  it("renders the title, one node per profiled person and the strong links", () => {
    mockReducedMotion(true);
    render(<Pairs people={people} edges={edges} lede="Lede" />);
    expect(screen.getByRole("heading", { name: "Quién le habla a quién" })).toBeInTheDocument();
    expect(screen.getByText("Lede")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^node-/).map((n) => n.dataset.testid)).toEqual([
      "node-bruno",
      "node-tomi",
      "node-ana",
    ]);
    expect(graph().querySelectorAll("line")).toHaveLength(3);
    expect(graph()).toHaveAttribute("viewBox", "0 0 700 440");
    expect(graph()).toHaveAttribute("data-focus", "");
  });

  it("clicking a node marks it focused", async () => {
    mockReducedMotion(false);
    const user = userEvent.setup();
    render(<Pairs people={people} edges={edges} lede="" />);
    await user.click(screen.getByText("Tomi"));
    expect(graph()).toHaveAttribute("data-focus", "tomi");
    // Still pinned once the pointer leaves; a second click unpins it.
    await user.unhover(screen.getByTestId("node-tomi"));
    expect(graph()).toHaveAttribute("data-focus", "tomi");
    expect(screen.getByTestId("node-tomi")).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByTestId("node-tomi"));
    await user.unhover(screen.getByTestId("node-tomi"));
    expect(graph()).toHaveAttribute("data-focus", "");
  });

  it("hover previews a node and fades the unrelated ones", () => {
    mockReducedMotion(true);
    const two = edges.filter((e) => e.a === "tomi" && e.b === "bruno");
    render(<Pairs people={people} edges={two} lede="" />);
    fireEvent.pointerEnter(screen.getByTestId("node-tomi"), { pointerType: "mouse" });
    expect(graph()).toHaveAttribute("data-focus", "tomi");
    expect(screen.getByTestId("node-bruno").style.opacity).toBe("1");
    expect(screen.getByTestId("node-ana").style.opacity).toBe("0.25");
    fireEvent.pointerLeave(screen.getByTestId("node-tomi"), { pointerType: "mouse" });
    expect(graph()).toHaveAttribute("data-focus", "");
  });

  it("holds the focused node in place and releases it on unfocus", () => {
    mockReducedMotion(false);
    render(<Pairs people={people} edges={edges} lede="" />);
    const tomi = simNode("tomi");
    expect(tomi.fx ?? null).toBeNull();
    fireEvent.pointerEnter(screen.getByTestId("node-tomi"), { pointerType: "mouse" });
    expect(graph()).toHaveAttribute("data-focus", "tomi");
    expect(tomi.fx).toBe(tomi.x);
    expect(tomi.fy).toBe(tomi.y);
    expect(simNode("bruno").fx ?? null).toBeNull();
    // Moving to another node hands the hold over.
    fireEvent.pointerLeave(screen.getByTestId("node-tomi"), { pointerType: "mouse" });
    fireEvent.pointerEnter(screen.getByTestId("node-bruno"), { pointerType: "mouse" });
    expect(tomi.fx).toBeNull();
    expect(simNode("bruno").fx).toBe(simNode("bruno").x);
    fireEvent.pointerLeave(screen.getByTestId("node-bruno"), { pointerType: "mouse" });
    expect(graph()).toHaveAttribute("data-focus", "");
    expect(simNode("bruno").fx).toBeNull();
    expect(simNode("bruno").fy).toBeNull();
  });

  it("does not kick the simulation on mount without focus", () => {
    mockReducedMotion(false);
    render(<Pairs people={people} edges={edges} lede="" />);
    expect(sims.restarts.at(-1)?.mock.calls).toHaveLength(0);
  });

  it("pulls around the focused node, with radii scaled to the width", () => {
    mockReducedMotion(false);
    const two = edges.filter((e) => e.a === "tomi" && e.b === "bruno");
    const { unmount } = render(<Pairs people={people} edges={two} lede="" />);
    fireEvent.pointerEnter(screen.getByTestId("node-tomi"), { pointerType: "mouse" });
    let pull = sims.radial.at(-1)!;
    const tomi = simNode("tomi");
    expect([pull.x, pull.y]).toEqual([tomi.x, tomi.y]);
    expect([pull.radius(tomi), pull.radius(simNode("bruno")), pull.radius(simNode("ana"))]).toEqual([0, 110, 230]);
    unmount();

    // A 350 px container halves them.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private cb: (e: Array<{ contentRect: { width: number } }>) => void) {}
        observe() {
          this.cb([{ contentRect: { width: 350 } }]);
        }
        disconnect() {}
      },
    );
    render(<Pairs people={people} edges={two} lede="" />);
    expect(graph()).toHaveAttribute("viewBox", "0 0 350 440");
    fireEvent.pointerEnter(screen.getByTestId("node-tomi"), { pointerType: "mouse" });
    pull = sims.radial.at(-1)!;
    expect([pull.radius(simNode("bruno")), pull.radius(simNode("ana"))]).toEqual([55, 115]);
  });

  it("a drag swallows its own click but not the next one", async () => {
    mockReducedMotion(false);
    render(<Pairs people={people} edges={edges} lede="" />);
    const node = screen.getByTestId("node-tomi");
    const drag = () => {
      fireEvent.pointerDown(node, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(node, { pointerId: 1, clientX: 40, clientY: 40 });
      fireEvent.pointerUp(node, { pointerId: 1, clientX: 40, clientY: 40 });
    };
    drag();
    fireEvent.click(node);
    expect(node).toHaveAttribute("aria-pressed", "false");
    // A drag released without a click, then a click with no press of its own (assistive tech).
    drag();
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(node);
    expect(node).toHaveAttribute("aria-pressed", "true");
  });

  it("Enter toggles focus from the keyboard", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<Pairs people={people} edges={edges} lede="" />);
    await user.tab();
    expect(screen.getByTestId("node-bruno")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(graph()).toHaveAttribute("data-focus", "bruno");
    await user.keyboard("{Enter}");
    expect(graph()).toHaveAttribute("data-focus", "");
  });

  it("focus prop preselects", () => {
    mockReducedMotion(true);
    const { rerender } = render(<Pairs people={people} edges={edges} focus="ana" lede="" />);
    expect(graph()).toHaveAttribute("data-focus", "ana");
    rerender(<Pairs people={people} edges={edges} focus="tomi" lede="" />);
    expect(graph()).toHaveAttribute("data-focus", "tomi");
  });

  it("focus prop keeps a low-traffic person's top links even under the derived threshold", () => {
    mockReducedMotion(true);
    // Six people, so K = 9 of 15 edges: the nine strongest of the ten between the other five. Ana's are all weaker.
    const slugs = ["bruno", "tomi", "carla", "diego", "eva", "ana"];
    const crowd = slugs.map((slug, i) => ({
      ...people[0],
      slug,
      name: slug[0].toUpperCase() + slug.slice(1),
      colorIndex: i,
    }));
    const strong = slugs.slice(0, 5).flatMap((a, i) => slugs.slice(i + 1, 5).map((b) => ({ a, b, w: 500 - i * 10 })));
    const anaEdges = [
      { a: "ana", b: "bruno", w: 40 },
      { a: "ana", b: "tomi", w: 30 },
      { a: "ana", b: "carla", w: 20 },
      { a: "ana", b: "diego", w: 10 },
      { a: "ana", b: "eva", w: 5 },
    ];
    const all = [...strong, ...anaEdges];
    const { unmount } = render(<Pairs people={crowd} edges={all} lede="" />);
    // A group graph shows lines, and none of them is Ana's.
    expect(graph().querySelectorAll("line")).toHaveLength(9);
    unmount();
    render(<Pairs people={crowd} edges={all} focus="ana" lede="" />);
    // Her three strongest come back; the fourth and fifth stay out and fade.
    expect(graph().querySelectorAll("line")).toHaveLength(12);
    for (const id of ["bruno", "tomi", "carla"]) expect(screen.getByTestId(`node-${id}`)).toHaveStyle({ opacity: "1" });
    expect(screen.getByTestId("node-diego")).toHaveStyle({ opacity: "0.25" });
  });

  it("reduced motion renders nodes with final radius immediately", () => {
    mockReducedMotion(true);
    render(<Pairs people={people} edges={edges} lede="" />);
    // sqrt scale from 0..max msgs onto 8..42: Bruno has the most messages.
    expect(circle("bruno")).toHaveAttribute("r", "42");
    for (const id of ["tomi", "ana"]) {
      const r = Number(circle(id).getAttribute("r"));
      expect(r).toBeGreaterThan(8);
      expect(r).toBeLessThan(42);
    }
  });

  it("starts nodes at radius 0 for the entrance spring with full motion", () => {
    mockReducedMotion(false);
    render(<Pairs people={people} edges={edges} lede="" />);
    expect(circle("bruno")).toHaveAttribute("r", "0");
  });
});
