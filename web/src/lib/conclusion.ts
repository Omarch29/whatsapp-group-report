import { readFile } from "node:fs/promises";
import { resolveContentFile } from "./data";

export const DRAFT_WARNING = "content/conclusion.md is still a draft (it says BORRADOR or DRAFT): rewrite it before publishing";

/** Readers never see the draft marker (comments are dropped), so the build says it out loud. */
export function warnIfDraft(md: string): void {
  if (/BORRADOR|DRAFT/.test(md)) console.warn(DRAFT_WARNING);
}

/** Paragraphs of a tiny markdown text: HTML comments dropped, split on blank lines, wrapped lines joined. */
export function parseConclusion(md: string): string[] {
  return md
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s*\n\s*/g, " "))
    .filter((p) => p.length > 0);
}

/** content/conclusion.md, as paragraphs. */
export async function loadConclusion(): Promise<string[]> {
  const md = await readFile(resolveContentFile("conclusion.md"), "utf8");
  warnIfDraft(md);
  return parseConclusion(md);
}
