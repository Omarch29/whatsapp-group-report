import type { ReactNode } from "react";
import { personTextColor } from "@/lib/colors";
import type { Person } from "@/lib/schema";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A lede with the names of `who` painted in their person color (bold). Only whole-word
 * matches of those people's names are painted; everything else stays plain text.
 */
export function Painted({ text, who, people }: { text: string; who: readonly string[]; people: readonly Person[] }) {
  const named = who
    .map((slug) => people.find((p) => p.slug === slug))
    .filter((p): p is Person => p !== undefined)
    .sort((a, b) => b.name.length - a.name.length);
  if (named.length === 0) return <>{text}</>;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${named.map((p) => escape(p.name)).join("|")})(?![\\p{L}\\p{N}])`, "gu");
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const p = named.find((x) => x.name === m[1])!;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <b key={m.index} data-person={p.slug} style={{ color: personTextColor(p.slug, people) }}>
        {m[1]}
      </b>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
