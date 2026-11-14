import { en } from "./en";
import { es } from "./es";

/** The shape every language's copy has (es.ts is the reference; en.ts `satisfies` it). */
export type Copy = typeof es;
export type Lang = "es" | "en";

const COPIES: Record<Lang, Copy> = { es, en };

/** The whole UI copy of one language. The build picks it once, from global.json.lang (content/copy.ts). */
export function copyFor(lang: Lang): Copy {
  return COPIES[lang];
}
