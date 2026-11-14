// Removes the previous production build from .next before `next build` (the dev server's .next/dev stays).
// A build cache left by another kind of build (`vercel build`), followed by a change to .env.local, makes
// Turbopack fail with an internal error; starting clean costs a few seconds and always works.
import { readdirSync, rmSync } from "node:fs";

const next = new URL("../.next/", import.meta.url);
let entries = [];
try {
  entries = readdirSync(next);
} catch {
  // no previous build
}
for (const name of entries) {
  if (name !== "dev") rmSync(new URL(name, next), { recursive: true, force: true });
}
