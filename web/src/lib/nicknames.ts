/** Short canonical name ("Tomi") -> nickname ("Tomate"); content/nicknames.json, read by `loadNicknames` (data.ts). */
export type Nicknames = Readonly<Record<string, string>>;

/** Client-safe: the lookup has no file access, so charts that run in the browser can use it. */
export function nicknameFor(nicknames: Nicknames, name: string): string | undefined {
  return nicknames[name] || undefined;
}
