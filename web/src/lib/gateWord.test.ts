import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeWord } from "./hash";

// The gate word must never be committed: it lives in web/.env.local (git-ignored)
// and in the Vercel env. vitest does not load .env files into process.env, so read it.
if (!process.env.NEXT_PUBLIC_GATE_WORD && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
const word = process.env.NEXT_PUBLIC_GATE_WORD;

// web/data is generated from the chat itself and is not scanned: if the word is
// something the group writes, it legitimately appears there.
const SCANNED = ["src", "content", "app"];

describe("gate word", () => {
  it.skipIf(!word)("does not appear in any tracked source file (any case)", () => {
    const needle = normalizeWord(word ?? "");
    const files = execFileSync("git", ["ls-files", "-z", "--", ...SCANNED], { encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
    expect(files.length).toBeGreaterThan(0);
    const leaks = files.filter((f) => readFileSync(f, "utf8").normalize("NFC").toLowerCase().includes(needle));
    expect(leaks).toEqual([]);
  });
});
