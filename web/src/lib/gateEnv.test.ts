import { describe, expect, it } from "vitest";
import { assertGateAuditAllowed, gateDisabled } from "./gateEnv";

describe("gate audit flag", () => {
  it("is on only for exactly NEXT_PUBLIC_GATE_DISABLED=1", () => {
    expect(gateDisabled({ NEXT_PUBLIC_GATE_DISABLED: "1" })).toBe(true);
    expect(gateDisabled({ NEXT_PUBLIC_GATE_DISABLED: "0" })).toBe(false);
    expect(gateDisabled({})).toBe(false);
  });

  it("throws when the gate is disabled on a Vercel or CI build", () => {
    expect(() => assertGateAuditAllowed({ NEXT_PUBLIC_GATE_DISABLED: "1", VERCEL: "1" })).toThrow(/audit-only/);
    expect(() => assertGateAuditAllowed({ NEXT_PUBLIC_GATE_DISABLED: "1", CI: "true" })).toThrow(/audit-only/);
  });

  it("allows a disabled gate on a local build", () => {
    expect(assertGateAuditAllowed({ NEXT_PUBLIC_GATE_DISABLED: "1" })).toBe(true);
  });

  it("allows Vercel and CI builds that keep the gate", () => {
    expect(assertGateAuditAllowed({ VERCEL: "1" })).toBe(false);
    expect(assertGateAuditAllowed({ CI: "true" })).toBe(false);
  });
});
