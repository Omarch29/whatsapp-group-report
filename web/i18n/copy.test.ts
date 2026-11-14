import { describe, expect, it } from "vitest";
import { en } from "./en";
import { es } from "./es";
import { copyFor } from "./index";

/** The copy's tree with every leaf replaced by its type, and functions by "fn/<arity>". */
function shape(v: unknown): unknown {
  if (typeof v === "function") return `fn/${v.length}`;
  if (Array.isArray(v)) return v.map(shape);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, x]) => [k, shape(x)]),
    );
  }
  return typeof v;
}

/** Every string leaf with its path. */
function strings(v: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof v === "string") out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) strings(x, `${path}.${k}`, out);
  return out;
}

const IDS = ["censo", "carrera", "horas", "parejas", "lenguaje", "multimedia", "emojis", "encuestas", "ritmo",
  "menciones", "salidas", "eventos", "records", "diccionario", "premios", "personas", "conclusion"];
const EN_SLUGS = ["census", "race", "hours", "pairs", "language", "media", "emojis", "polls", "rhythm", "mentions",
  "departures", "events", "records", "dictionary", "awards", "people", "conclusion"];

describe("i18n copy", () => {
  it("en has exactly the keys and function arities of es", () => {
    expect(shape(en)).toEqual(shape(es));
  });

  it("no criterion string embeds a threshold number", () => {
    // The fixed algorithm windows stay as text; thresholds the pipeline scales (facts.thresholds) never do.
    const allowed = ["Los 30 emojis más usados", "The top 30 emojis"];
    for (const [lang, c] of [["es", es], ["en", en]] as const) {
      for (const [path, s] of strings(c, lang)) {
        if (allowed.some((a) => s.includes(a))) continue;
        expect(/\b(500|5000|20|30)\b/.test(s), `${path}: ${s}`).toBe(false);
      }
    }
  });

  it("criteria that cite a threshold take it as an argument", () => {
    for (const c of [es, en]) {
      expect(c.language.repeatedCriterion(7)).toMatch(/\b7\b/);
      expect(c.language.laughedCriterion(7)).toMatch(/\b7\b/);
      expect(c.emojis.signatureCriterion(7)).toMatch(/\b7\b/);
      expect(c.rhythm.latencyCriterion(7)).toMatch(/\b7\b/);
      expect(c.polls.topCriterion(7)).toMatch(/\b7\b/);
    }
  });

  it("copyFor returns the requested language", () => {
    expect(copyFor("en").nav.prev).toBe("Previous");
    expect(copyFor("es").nav.prev).toBe("Anterior");
    expect(copyFor("en").htmlLang).toBe("en");
    expect(copyFor("es").htmlLang).toBe("es-AR");
  });

  it("lists the chapters in reading order: ids never change, slugs follow the language", () => {
    expect(es.chapters.map((c) => c.id)).toEqual(IDS);
    expect(es.chapters.map((c) => c.slug)).toEqual(IDS);
    expect(en.chapters.map((c) => c.id)).toEqual(IDS);
    expect(en.chapters.map((c) => c.slug)).toEqual(EN_SLUGS);
    expect(en.chapters.map((c) => c.blocks.map((b) => b.id))).toEqual(es.chapters.map((c) => c.blocks.map((b) => b.id)));
    expect(en.profile.blocks.map((b) => b.id)).toEqual(es.profile.blocks.map((b) => b.id));
  });

  it("names weekdays from Monday and months from January", () => {
    expect(es.dow[0]).toBe("lunes");
    expect(en.dow[0]).toBe("Monday");
    expect(es.dowPlural[4]).toBe("viernes");
    expect(es.dowPlural[5]).toBe("sábados");
    expect(en.dowPlural[4]).toBe("Fridays");
    expect(es.months[11]).toBe("diciembre");
    expect(en.months[2]).toBe("March");
    expect(es.dowShort).toEqual(["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]);
    expect(en.monthsShort).toHaveLength(12);
  });

  it("en copy uses the English plain-UI words", () => {
    expect(en.nav.counter(3, 17)).toBe("Chapter 3 of 17");
    expect(en.block.copy).toBe("Copy link");
    expect(en.empty).toBe("Nothing to show yet.");
    expect(en.hero.lede(5127, 1157)).toBe("5,127 messages over 1,157 days.");
  });

  it("counts of one read in the singular, and the swear-list criterion is neutral", () => {
    expect(es.emojis.ledYearsLede("😂", 1, 1)).toBe("😂 fue el número uno del único año.");
    expect(es.emojis.constantLede("😂", 1, 1)).toBe("😂 estuvo en el top 5 del único año.");
    expect(es.emojis.ledYearsLede("😂", 1, 3)).toBe("😂 fue el número uno en 1 de los 3 años.");
    expect(en.emojis.ledYearsLede("😂", 1, 1)).toBe("😂 was number one in the only year.");
    expect(en.emojis.constantLede("😂", 1, 1)).toBe("😂 made the top 5 in the only year.");
    expect(es.language.badwordsLede("Ana", 1, 2)).toContain("1 puteada;");
    expect(en.language.badwordsLede("Ana", 1, 2)).toContain("1 swear word;");
    expect(es.language.badwordsCriterion).toBe(
      "La lista de puteadas del grupo; por mil = cada mil mensajes de la persona.",
    );
    expect(en.language.badwordsCriterion).toBe(
      "The group's list of swear words; per thousand = per thousand of that person's messages.",
    );
  });
});
