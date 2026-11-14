import { describe, expect, it } from "vitest";
import { fx } from "@/test/fixtures";
import {
  clip,
  clipRecord,
  RECORD_CHARS,
  defaultPerson,
  laughTotal,
  longestJaja,
  ledeMuletilla,
  longestWriter,
  personName,
  splitMatch,
  topBadwords,
  topLaughClass,
  topLaughed,
} from "./language";

describe("language helpers", () => {
  it("defaults to the first person, in people order, whose list passes the minimum", () => {
    const { muletillas } = fx.language;
    // Bruno has 4 phrases, Tomi 10.
    expect(defaultPerson(muletillas, fx.global.people, (l) => l.length >= 6)).toBe("tomi");
    // Nobody passes: the first with anything, then the first at all.
    expect(defaultPerson(muletillas, fx.global.people, (l) => l.length >= 99)).toBe("bruno");
    expect(defaultPerson({ tomi: [], ana: [] }, fx.global.people, (l) => l.length > 0)).toBe("tomi");
    expect(defaultPerson({}, fx.global.people, () => true)).toBe("");
  });

  it("picks the lede muletilla by the highest own / rest ratio", () => {
    const list = fx.language.muletillas.tomi!.map((m, i) => (i === 4 ? { ...m, ratio: 99 } : m));
    expect(ledeMuletilla(list)?.phrase).toBe("mi dios");
    expect(ledeMuletilla([])).toBeNull();
  });

  it("finds the group's most laughed-at message, skipping nulls", () => {
    expect(topLaughed(fx.language.laughed)).toMatchObject({ slug: "bruno", laughs: 11, text: "Gol en contra" });
    expect(topLaughed({ tomi: null })).toBeNull();
  });

  it("finds the longest writer and the top swearer by per mil", () => {
    expect(longestWriter(fx.language.style)?.slug).toBe("bruno");
    expect(longestWriter([])).toBeNull();
    expect(topBadwords([{ slug: "tomi", n: 30, perMil: 10 }, { slug: "ana", n: 5, perMil: 40 }])?.slug).toBe("ana");
    expect(topBadwords([])).toBeNull();
  });

  it("finds who stretches the jaja the most", () => {
    expect(longestJaja(fx.language.laughs.byPerson)?.slug).toBe("bruno");
    expect(longestJaja([])).toBeNull();
  });

  it("sums a laugh mix", () => {
    expect(laughTotal(fx.language.laughs.byPerson[0]!.mix)).toBe(79);
  });

  it("clips long texts on a word with an ellipsis", () => {
    expect(clip("corto", 80)).toBe("corto");
    expect(clip("uno dos tres cuatro", 10)).toBe("uno dos…");
    expect(clip("abcdefghijkl", 5)).toBe("abcd…");
  });

  it("closes record texts the pipeline cut at RECORD_CHARS on a word, with an ellipsis", () => {
    const cut = "palabra ".repeat(40).slice(0, RECORD_CHARS); // 300 chars, ends mid-word in "pala"
    expect(cut.endsWith(" pala")).toBe(true);
    const shown = clipRecord(cut);
    expect(shown.endsWith(" palabra…")).toBe(true);
    expect(shown.length).toBeLessThan(RECORD_CHARS);
    expect(clipRecord("Mierda, perdí el bondi")).toBe("Mierda, perdí el bondi");
    expect(clipRecord("x".repeat(RECORD_CHARS - 1))).toBe("x".repeat(RECORD_CHARS - 1));
  });

  it("names people, with a capitalized slug for unknown ones", () => {
    expect(personName("tomi", fx.global.people)).toBe("Tomi");
    expect(personName("nico", fx.global.people)).toBe("Nico");
  });

  it("splits a text around a phrase, ignoring case and accents", () => {
    expect(splitMatch("Qué mirá vos", "mira vos")).toEqual(["Qué ", "mirá vos", ""]);
    expect(splitMatch("Y SIN VUELTAS lo hago", "sin vueltas")).toEqual(["Y ", "SIN VUELTAS", " lo hago"]);
    expect(splitMatch("nada que ver", "sin vueltas")).toBeNull();
  });

  it("topLaughClass picks the most written laugh, first in class order on a tie, null without laughs", () => {
    const entry = (key: string, n: number) => ({ key, label: key, n });
    const mix = [entry("haha", 3), entry("hehe", 5), entry("lol", 5), entry("lmao", 0)];
    expect(topLaughClass(mix)).toEqual({ key: "hehe", label: "hehe", n: 5 });
    expect(topLaughClass([entry("haha", 0), entry("emoji", 0)])).toBeNull();
    expect(topLaughClass([])).toBeNull();
  });
});
