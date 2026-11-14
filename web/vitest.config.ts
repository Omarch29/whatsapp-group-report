import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // next build defines this from `trailingSlash: true` (next.config.ts); without it next/link
    // strips the slash in tests and renders hrefs the static export never serves.
    env: {
      __NEXT_TRAILING_SLASH: "true",
      // next build takes the language from global.json (next.config.ts); tests pin the Spanish copy.
      NEXT_PUBLIC_WGR_LANG: "es",
      // The fictional group's content, so tests never depend on whoever's content/ sits at the repo root.
      // The committed fictional data, so tests never read a user's generated web/data/.
      WGR_DATA_DIR: fileURLToPath(new URL("./data/example", import.meta.url)),
      WGR_CONTENT_DIR: fileURLToPath(new URL("../tests/fixtures/content", import.meta.url)),
    },
    include: ["src/**/*.test.{ts,tsx}", "i18n/**/*.test.ts"],
  },
});
