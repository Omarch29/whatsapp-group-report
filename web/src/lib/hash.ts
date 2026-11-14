// SHA-256 hex digests for the group gate. Client: Web Crypto. Server (build): node:crypto,
// loaded lazily through process.getBuiltinModule so client bundles never import it.

/** Same normalization on both sides so "Moño " and "moño" open the gate. */
export function normalizeWord(word: string): string {
  return word.normalize("NFC").trim().toLowerCase();
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(s: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

export function sha256HexSync(s: string): string {
  const { createHash } = process.getBuiltinModule("node:crypto");
  return createHash("sha256").update(s, "utf8").digest("hex");
}
