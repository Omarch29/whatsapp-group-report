import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadGlobal = vi.fn();
vi.mock("next/font/google", () => ({ Archivo: () => ({ variable: "archivo" }) }));
vi.mock("@/lib/data", () => ({ loadGlobal: () => loadGlobal(), getTitle: async () => "Los del Parque 🌳" }));

async function layoutBody() {
  const { default: RootLayout } = await import("./layout");
  const { Gate } = await import("@/components/Gate");
  const html = (await RootLayout({ children: <p>hola</p> } as never)) as ReactElement<{ children: ReactElement<{ children: ReactNode }> }>;
  return { body: html.props.children.props.children, Gate };
}

describe("root layout gate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_GATE_WORD", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("renders the site without <Gate> when gate is false, with no word set", async () => {
    loadGlobal.mockResolvedValue({ title: "Los del Parque 🌳", gate: false });
    const { body, Gate } = await layoutBody();
    expect(isValidElement(body) && body.type === Gate).toBe(false);
  });

  it("wraps the site in <Gate> when gate is true", async () => {
    vi.stubEnv("NEXT_PUBLIC_GATE_WORD", "moño");
    loadGlobal.mockResolvedValue({ title: "Los del Parque 🌳", gate: true });
    const { body, Gate } = await layoutBody();
    expect(isValidElement(body) && body.type === Gate).toBe(true);
  });

  it("throws the known error when gate is true and the word is missing", async () => {
    loadGlobal.mockResolvedValue({ title: "Los del Parque 🌳", gate: true });
    await expect(layoutBody()).rejects.toThrow(
      "NEXT_PUBLIC_GATE_WORD is not set (web/.env.local locally, Vercel env in production)",
    );
  });
});
