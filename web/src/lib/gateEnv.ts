type Env = Record<string, string | undefined>;

/** NEXT_PUBLIC_GATE_DISABLED=1: audit-only build that renders the site without the gate. */
export function gateDisabled(env: Env): boolean {
  return env.NEXT_PUBLIC_GATE_DISABLED === "1";
}

/**
 * Returns whether the gate is disabled, and fails the build if it is disabled on
 * Vercel or CI: the flag is for local Lighthouse audits only and would otherwise ship
 * the whole private site ungated.
 */
export function assertGateAuditAllowed(env: Env): boolean {
  const disabled = gateDisabled(env);
  if (disabled && (env.VERCEL || env.CI)) {
    throw new Error("NEXT_PUBLIC_GATE_DISABLED is audit-only and cannot be used on Vercel/CI builds");
  }
  return disabled;
}
