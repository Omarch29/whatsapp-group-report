/**
 * Spread onto a section's own element to make it a chapter block anchor (`#id`, `[data-block]`)
 * without the Block wrapper, for sections that already render their own heading. No id, no anchor:
 * the same section on a profile stays a plain section.
 */
export function blockAnchor(id?: string): { id?: string; "data-block"?: true } {
  return id ? { id, "data-block": true } : {};
}
