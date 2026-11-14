import { describe, expect, it } from "vitest";
import { CONTENT_DIR, loadNicknames } from "./data";
import { nicknameFor } from "./nicknames";
import { fx } from "@/test/fixtures";

describe("nicknames", () => {
  it("reads content/nicknames.json from WGR_CONTENT_DIR (the fictional fixture under vitest)", async () => {
    expect(CONTENT_DIR).toMatch(/tests[\\/]fixtures[\\/]content$/);
    expect(await loadNicknames()).toEqual(fx.nicknames);
  });

  it("looks a nickname up by short name; none gives undefined", () => {
    expect(nicknameFor(fx.nicknames, "Tomi")).toBe("Tomate");
    expect(nicknameFor(fx.nicknames, "Pepe")).toBeUndefined();
    expect(nicknameFor({ Pepe: "" }, "Pepe")).toBeUndefined();
  });
});
