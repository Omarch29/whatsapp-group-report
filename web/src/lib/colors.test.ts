import { describe, expect, it } from "vitest";
import { FALLBACK_COLOR, PALETTE, colorFor } from "./colors";

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** CIE L*a*b* (D65) of a #rrggbb colour. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference. */
function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

describe("palette", () => {
  it("has twelve distinct colours, the new four last", () => {
    expect(PALETTE).toHaveLength(12);
    expect(new Set(PALETTE).size).toBe(12);
    expect(PALETTE.slice(8)).toEqual(["#b5e655", "#06d6a0", "#82aaff", "#f4a261"]);
  });

  it("keeps every pair of the twelve at least CIE76 25 apart", () => {
    // The closest pair (#ff7a59 / #f4a261) is 25.4; anything under 25 reads as the same person on the dark page.
    const close: string[] = [];
    PALETTE.forEach((a, i) =>
      PALETTE.slice(i + 1).forEach((b) => {
        if (deltaE(a, b) < 25) close.push(`${a} ${b} ${deltaE(a, b).toFixed(1)}`);
      }),
    );
    expect(close).toEqual([]);
  });

  it("computes CIE76 like the reference values", () => {
    expect(deltaE("#ffffff", "#000000")).toBeCloseTo(100, 1);
    expect(lab("#ff0000")[0]).toBeCloseTo(53.24, 1);
  });

  it("keeps the four new colours within relative luminance 0.35 to 0.8", () => {
    for (const c of PALETTE.slice(8)) {
      const l = luminance(c);
      expect(l, c).toBeGreaterThanOrEqual(0.35);
      expect(l, c).toBeLessThanOrEqual(0.8);
    }
  });

  it("keeps all twelve legible on the dark background and clearly lighter than the grey", () => {
    // The two oldest pinks/violets (#ff5ca8, #b388ff) sit just under 0.35, so the shared floor is 0.3.
    for (const c of PALETTE) {
      const l = luminance(c);
      expect(l, c).toBeGreaterThanOrEqual(0.3);
      expect(l, c).toBeLessThanOrEqual(0.8);
      expect(l, c).toBeGreaterThan(luminance(FALLBACK_COLOR) * 2);
    }
  });

  it("gives the first twelve their colour and the 13th onwards the grey fallback", () => {
    PALETTE.forEach((c, i) => expect(colorFor(i)).toBe(c));
    expect(colorFor(12)).toBe(FALLBACK_COLOR);
    expect(colorFor(-1)).toBe(FALLBACK_COLOR);
    expect(PALETTE as readonly string[]).not.toContain(FALLBACK_COLOR);
  });
});
