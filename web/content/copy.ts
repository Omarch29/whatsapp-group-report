import { en } from "../i18n/en";
import { es } from "../i18n/es";
import type { Copy } from "../i18n";

export type { Copy } from "../i18n";

/**
 * The UI copy of this build. next.config.ts sets NEXT_PUBLIC_WGR_LANG from global.json.lang (vitest pins "es") and
 * Next inlines it, so this literal ternary folds at build time and the bundle carries one language only
 * (`copyFor` in web/i18n keeps both, for tests). The strings live in web/i18n/.
 */
export const copy: Copy = process.env.NEXT_PUBLIC_WGR_LANG === "en" ? en : es;
