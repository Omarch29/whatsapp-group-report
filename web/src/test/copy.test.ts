import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { copyFor } from "../../i18n";

/** Lower case, accents stripped ("Muñóz" -> "munoz"): the guard's `_plain` (tests/test_no_private_data.py). */
const plain = (text: string): string =>
  Array.from(text.normalize("NFKD"))
    .filter((c) => c.charCodeAt(0) < 128)
    .join("")
    .toLowerCase();

/** Lower-case ascii letter runs of a text. */
const runs = (text: string): string[] => plain(text).match(/[a-z]+/g) ?? [];

/** (substrings, whole words) of a words file: one per line, `#` comments, a trailing ` whole` marks a whole word. */
function parseWords(text: string): { subs: string[]; wholes: string[] } {
  const subs = new Set<string>();
  const wholes = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split("#", 1)[0].split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    const whole = parts.length > 1 && parts[parts.length - 1] === "whole";
    const word = runs((whole ? parts.slice(0, -1) : parts).join(" ")).join("");
    if (word) (whole ? wholes : subs).add(word);
  }
  return { subs: [...subs], wholes: [...wholes] };
}

const WORDS_FILE = process.env.WGR_PRIVATE_WORDS;

describe.each(["es", "en"] as const)("copy (%s)", (lang) => {
  // The forbidden words never live in the repo: maintainers pass the file the pytest guard reads. This one also walks
  // the copy after evaluation, so it sees function bodies and keys as the build ships them.
  it.skipIf(!WORDS_FILE)("no copy string, key or function body contains a private word", () => {
    const { subs, wholes } = parseWords(readFileSync(WORDS_FILE!, "utf-8"));
    expect(subs.length + wholes.length).toBeGreaterThan(0);
    const bad = (r: string) => wholes.includes(r) || subs.some((w) => r.includes(w));
    const hit = (text: string) => runs(text).some(bad);
    // A path can itself hold the word (a key): report it with every offending letter run masked.
    const masked = (path: string) => path.replace(/\p{L}+/gu, (w) => (runs(w).some(bad) ? "***" : w));
    const hits: string[] = [];
    let seen = 0;
    const walk = (v: unknown, path: string): void => {
      seen++;
      if (hit(path)) hits.push(`key ${masked(path)}`);
      if (typeof v === "string" || typeof v === "function") {
        if (hit(String(v))) hits.push(masked(path));
      } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(copyFor(lang), "copy");
    // Masked paths only: printing the offending text would print the word.
    expect(hits).toEqual([]);
    expect(seen).toBeGreaterThan(200);
  });

  it("no copy string, key or function body calls this group a club", () => {
    // "club" may only appear inside a longer word, never standalone.
    const standalone = /\bclub\b/i;
    const hits: string[] = [];
    const walk = (v: unknown, path: string): void => {
      if (standalone.test(path)) hits.push(path);
      if (typeof v === "string" || typeof v === "function") {
        if (standalone.test(String(v))) hits.push(path);
      } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(copyFor(lang), "copy");
    expect(hits).toEqual([]);
  });
});

describe("copy (es)", () => {
  const copy = copyFor("es");

  it("race lede names whoever takes the lead, from the first month or later", () => {
    expect(copy.race.lede("Bruno", "2023-09", 0)).toBe(
      "Mensajes acumulados. Dale play y mirá cómo Bruno se pone adelante desde el primer mes.",
    );
    expect(copy.race.lede("Bruno", "2024-03", 6)).toBe(
      "Mensajes acumulados. Dale play y mirá cómo Bruno se pone adelante en marzo de 2024, a los 6 meses.",
    );
    expect(copy.race.lede("Bruno", "2024-03", 1)).toContain("a los un mes.");
  });

  it("race lede stays generic when nobody takes the lead (no departer)", () => {
    expect(copy.race.lede("", null, null)).toBe("Mensajes acumulados. Dale play y mirá quién se pone adelante.");
  });

  it("departures copy takes the departer's name instead of naming anyone", () => {
    const d = copy.departures;
    expect(d.lede("Bruno", 3)).toBe("Bruno se fue y volvió 3 veces.");
    expect(d.attributedTitle("Bruno")).toBe("Lo que le atribuyen a Bruno");
  });

  it("embeds numbers only through functions", () => {
    expect(copy.hero.lede(5127, 1157)).toBe("5.127 mensajes en 1.157 días.");
    expect(copy.verifiedOn).toBe("2026-11-09");
  });

  it("census ledes embed their numbers and say seconds for names that lasted under a day", () => {
    expect(copy.census.timelineLede(27, 19)).toBe("El grupo cambió de nombre 27 veces y de foto 19.");
    expect(copy.census.namesLede({ days: 371.5, seconds: 32097600 }, { days: 0, seconds: 51 })).toBe(
      "El nombre que más duró aguantó 371 días; el que menos, 51 segundos.",
    );
    // The longest name is still the group's name: it has not ended.
    expect(copy.census.namesLede({ days: 371.5, seconds: 32097600 }, { days: 0, seconds: 51 }, true)).toBe(
      "El nombre que más duró lleva 371 días; el que menos, 51 segundos.",
    );
    expect(copy.census.duration(371.5, 32097600)).toEqual({ n: 371, unit: "días" });
    expect(copy.census.duration(1.9, 164160)).toEqual({ n: 1, unit: "día" });
    expect(copy.census.duration(0, 1)).toEqual({ n: 1, unit: "segundo" });
    expect(copy.census.duration(0, 600)).toEqual({ n: 10, unit: "minutos" });
    expect(copy.census.duration(0, 7200)).toEqual({ n: 2, unit: "horas" });
    expect(copy.census.duration(1, 86400)).toEqual({ n: 1, unit: "día" });
    expect(copy.census.tenureLede("Lucas", 214)).toBe(
      "Lucas estuvo 214 días sin escribir: la ausencia más larga del grupo.",
    );
    expect(copy.census.byYearLede("2024", 2406)).toBe("2024 fue el año con más mensajes: 2.406.");
    expect(copy.census.hourLede("Ana", 0.032, "Lucas", 0.071)).toBe(
      "Ana es el más madrugador, con el 3,2 % de sus mensajes; Lucas, el más búho, con el 7,1 %.",
    );
    expect(copy.empty).toBe("Nada que mostrar todavía.");
  });

  it("language ledes and metas embed their numbers", () => {
    const l = copy.language;
    expect(l.muletillasLede("Ana", "cero apuro", 11, 41.3)).toBe(
      "Ana dijo «cero apuro» 11 veces: 41 veces más seguido que el resto del grupo.",
    );
    expect(l.muletillasLede("Tomi", "posta", 1, 4.6)).toBe(
      "Tomi dijo «posta» 1 vez: 5 veces más seguido que el resto del grupo.",
    );
    expect(l.muletillaMeta(1287, 26)).toBe("1.287 veces · el resto 26");
    expect(l.since("2023-10")).toBe("desde octubre de 2023");
    expect(l.repeatedMeta(11, 3)).toBe("× 11 · 3 personas");
    expect(l.repeatedMeta(1, 1)).toBe("× 1 · 1 persona");
    expect(l.repeatedLede("Bruno", "Q lindo el quincho de Rulo", 81, 8)).toBe(
      "«Q lindo el quincho de Rulo», de Bruno, la repitieron 8 personas 81 veces.",
    );
    expect(l.laughsLabel(11, 3)).toBe("11 risas de 3 personas");
    expect(l.laughsLabel(1, 1)).toBe("1 risa de 1 persona");
    expect(l.laughedLede("Caro", 11, 6)).toBe("El mensaje de Caro que más hizo reír juntó 11 risas de 6 personas.");
    expect(l.badwordsLede("Caro", 9512, 48.7)).toBe(
      "El grupo escribió 9.512 puteadas; Caro encabeza con 48,7 por mil mensajes.",
    );
    expect(l.styleRecord.label).toBe("El mensaje más largo");
    expect(l.styleRecord.unit(140)).toBe("caracteres");
    expect(l.styleRecord.unit(1)).toBe("carácter");
    expect(l.styleLede("Ana", 28.6)).toBe("Ana escribe los mensajes más largos: 28,6 caracteres de promedio.");
    expect(l.avgJa(8.2)).toBe("jaja ×8,2");
    expect(l.laughsLede("Caro", 4.2)).toBe("Caro es quien más estira la risa: 4,2 «ja» por jaja, de promedio.");
  });

  it("multimedia, emojis and encuestas ledes embed their numbers", () => {
    const m = copy.media;
    expect(m.kindsLede("fotos", 1587)).toBe("Después del texto, lo que más se manda son fotos: 1.587.");
    expect(m.kindsCriterion("GIFs, llamadas")).toContain("Otros: GIFs, llamadas.");
    expect(m.kindsCriterion("")).not.toContain("Otros");
    expect(
      m.recordsLede([
        { name: "Lucas", n: 4102, unit: "stickers" },
        { name: "Ana", n: 2967, unit: "audios" },
      ]),
    ).toBe("Lucas mandó 4.102 stickers; Ana, 2.967 audios.");
    expect(m.peakDay("Tomi", 39, "09/04/2026")).toBe("récord de un día: 39, Tomi el 09/04/2026");
    expect(m.audiosLede("Ana", 2967, 21)).toBe("Ana mandó 2.967 audios, más que nadie; el grupo manda más audios a las 21 h.");
    expect(m.audiosLede("Ana", 2967, 1)).toContain("a la 1 h.");
    expect(m.linksLede("Tomi", 1162, "instagram.com", 1937)).toBe(
      "Tomi compartió 1.162 links, más que nadie; el sitio más compartido es instagram.com, con 1.937.",
    );
    expect(m.deletedLede("Bruno", 3.6, "Tomi", 9.7)).toBe(
      "Bruno es quien más borra: 3,6 por mil mensajes; Tomi, quien más edita: 9,7 por mil.",
    );
    const e = copy.emojis;
    expect(e.topLede("😭", 412)).toBe("😭 es el emoji del grupo: 412 veces.");
    expect(e.detail(412, "Bruno")).toBe("412 veces · lo usa más: Bruno");
    expect(e.detail(1, null)).toBe("1 vez");
    expect(e.signatureLede("Lucas", "😬", 151.2)).toBe("La firma más fuerte es 😬, de Lucas: lo usa 151 veces más seguido que el resto.");
    expect(e.signatureSpoken("Tomi", "😂", 3, 3.2)).toBe("Tomi 😂 ×3, 3,2 veces más que el resto");
    expect(e.leadersLede([{ year: "2023", e: "😭" }, { year: "2024", e: "❤️" }, { year: "2025", e: "👀" }])).toBe(
      "El número uno de cada año: 😭 en 2023, ❤️ en 2024 y 👀 en 2025.",
    );
    expect(e.constantLede("😭", 3, 4)).toBe("😭 estuvo en el top 5 en 3 de los 4 años.");
    const p = copy.polls;
    expect(p.byPersonLede(1934, "Bruno", 862)).toBe("El grupo armó 1.934 encuestas; Bruno, 862: más que nadie.");
    expect(p.topLede("¿Vamos?", 1)).toBe("La encuesta más votada juntó 1 voto: «¿Vamos?».");
    expect(p.pollWhen("21/04/2024", 34)).toBe(", 21/04/2024 · 34 votos");
    expect(p.topCriterion(5)).toContain("al menos 5 votos");
  });

  it("heatmap peak takes the plural day as given", () => {
    expect(copy.heatmap.peak("sábados", 22)).toBe("El pico: los sábados a las 22 h.");
  });

  it("quotes user text with guillemets", () => {
    expect(copy.quote("¿Vamos?")).toBe("«¿Vamos?»");
  });

  it("units and counts agree at one", () => {
    expect(copy.polls.topRecord.unit(1)).toBe("voto");
    expect(copy.polls.topRecord.unit(2)).toBe("votos");
    expect(copy.rhythm.streakRecord.unit(1)).toBe("día seguido");
    expect(copy.language.topMuletilla.unit(1)).toBe("vez");
    expect(copy.records.person.silence.unit(1)).toBe("día sin escribir");
    expect(copy.media.records.audio!.unit(1)).toBe("audio");
    expect(copy.hero.lede(1, 1)).toBe("1 mensaje en 1 día.");
    expect(copy.departures.lede("Bruno", 1)).toBe("Bruno se fue y volvió 1 vez.");
    expect(copy.rhythm.streaksLede("Ana", 1, "Lucas", 1)).toBe(
      "La racha más larga es de Ana: 1 día seguido escribiendo; el silencio más largo, de Lucas: 1 día sin escribir.",
    );
    expect(copy.mentions.recordsLede("Bruno", 1, "Bruno", 1)).toBe(
      "Bruno recibió 1 mención e hizo 1: nadie etiqueta ni es etiquetado más.",
    );
    expect(copy.media.audiosLede("Ana", 1, 21)).toContain("Ana mandó 1 audio,");
    expect(copy.polls.byPersonLede(1, "Bruno", 1)).toBe("El grupo armó 1 encuesta; Bruno, 1: más que nadie.");
  });

  it("ritmo, menciones, premios and conclusión copy embed their numbers", () => {
    const r = copy.rhythm;
    expect(r.startersLede("Ana", 247, "Tomi", 263)).toBe(
      "Ana arrancó la charla 247 veces, más que nadie; Tomi la mató 263 veces.",
    );
    expect(r.latencyLede("Lucas", 10)).toBe(
      "Lucas es quien contesta más rápido: la mitad de sus respuestas salen en 10 s o menos.",
    );
    expect(r.latencyRow("Lucas", 10, 120)).toBe("Lucas: responde en 10 s; le responden en 2 min");
    expect(r.fastest.gap(1.8)).toBe("1,8 s");
    expect(r.streaksLede("Ana", 268, "Lucas", 214)).toBe(
      "La racha más larga es de Ana: 268 días seguidos escribiendo; el silencio más largo, de Lucas: 214 días sin escribir.",
    );
    expect(r.days(1)).toBe("1 día");
    expect(r.ringsLede("viernes", 1736, "octubre", 1236)).toBe(
      "El viernes es el día más movido de la semana, con 1.736 mensajes; octubre, el mes más movido del año, con 1.236.",
    );
    expect(r.ringsRecord.when("viernes")).toBe("todos los viernes");
    const m = copy.mentions;
    expect(m.cell("Tomi", "Ana", 120)).toBe("Tomi menciona a Ana: 120");
    expect(m.matrixLede("Tomi", "Bruno", 2316)).toBe("Tomi es quien más etiqueta a Bruno: 2.316 veces, la pareja récord.");
    expect(m.pairRecord.when("Bruno")).toBe("a Bruno");
    expect(m.recordsLede("Bruno", 1871, "Bruno", 1603)).toBe(
      "Bruno recibió 1.871 menciones e hizo 1.603: nadie etiqueta ni es etiquetado más.",
    );
    expect(m.samplesTitle("Tomi", "Ana", 1)).toBe("Tomi mencionó a Ana 1 vez");
    expect(m.perMilLede("Tomi", 67.4)).toBe("Tomi es quien más etiqueta por mensaje: 67,4 menciones cada mil mensajes.");
    expect(copy.awards.lede(12)).toBe("12 premios, cada uno con su ganador y dos finalistas. Abrí los sobres.");
    expect(copy.awards.nobody).toBe("Desierto");
  });

  it("profile ledes embed their numbers and read well at zero and one", () => {
    const p = copy.profile;
    expect(p.awardsLede("Tomi", 2, 3)).toBe("Tomi ganó 2 premios y fue finalista en 3.");
    expect(p.awardsLede("Tomi", 1, 0)).toBe("Tomi ganó 1 premio.");
    expect(p.awardsLede("Tomi", 0, 1)).toBe("Tomi no ganó ningún premio, pero fue finalista en 1.");
    expect(p.awardsLede("Tomi", 0, 0)).toBe("Tomi no ganó premios ni fue finalista.");
    expect(p.latencyEmpty).toBe("Sin respuestas para medir.");
    expect(p.latencyLede("Lucas", 10, 120)).toBe(
      "La mitad de las respuestas de Lucas salen en 10 s o menos; a Lucas le contestan en 2 min.",
    );
    expect(p.repeatedLede("Tomi", 1, 3)).toBe("Otros repitieron textual 1 frase de Tomi; la que más, 3 veces.");
    expect(p.repeatedLede("Tomi", 8, 12)).toBe("Otros repitieron textual 8 frases de Tomi; la que más, 12 veces.");
    expect(p.laughedLede("Tomi", 7, 1)).toBe("El mensaje de Tomi que más hizo reír juntó 7 risas de 1 persona.");
    expect(p.laughsLede("Tomi", "jaja", 0.812, 3.4)).toBe(
      "Tomi se ríe sobre todo con «jaja»: el 81,2 % de sus risas, y estira el jaja a 3,4 «ja» de promedio.",
    );
    expect(p.signatureLede("Tomi", "💀", 3.2)).toBe("La firma de Tomi es 💀: lo usa 3,2 veces más seguido que el resto.");
    expect(p.kindsLede("Tomi", "stickers", 1340)).toBe("Después del texto, lo que más manda Tomi son stickers: 1.340.");
    expect(p.mentionsLede("Tomi", { name: "Ana", n: 120 }, { name: "Bruno", n: 1 })).toBe(
      "Tomi etiqueta más que a nadie a Ana: 120 veces. Quien más etiqueta a Tomi es Bruno: 1 vez.",
    );
    expect(p.mentionsLede("Tomi", { name: "Ana", n: 2 }, null)).toBe("Tomi etiqueta más que a nadie a Ana: 2 veces.");
    expect(p.mentionsLede("Tomi", null, { name: "Bruno", n: 4 })).toBe("Quien más etiqueta a Tomi es Bruno: 4 veces.");
    expect(p.mentionsLede("Tomi", null, null)).toBe("Tomi no etiqueta a nadie con perfil, ni nadie a Tomi.");
    expect(p.finalistIn("El búho")).toBe("finalista en El búho");
  });
});

describe("copy (en)", () => {
  const copy = copyFor("en");

  it("race and departures ledes read in English", () => {
    expect(copy.race.lede("Bruno", "2024-03", 6)).toBe(
      "Messages added up. Hit play and watch Bruno take the lead in March 2024, 6 months in.",
    );
    expect(copy.race.lede("", null, null)).toBe("Messages added up. Hit play and watch who takes the lead.");
    expect(copy.departures.lede("Bruno", 1)).toBe("Bruno left and came back 1 time.");
  });

  it("formats numbers, shares and months the English way", () => {
    expect(copy.hero.lede(5127, 1157)).toBe("5,127 messages over 1,157 days.");
    expect(copy.census.hourLede("Ana", 0.032, "Lucas", 0.071)).toBe(
      "Ana is the earliest bird, with 3.2% of their messages; Lucas is the biggest night owl, with 7.1%.",
    );
    expect(copy.language.since("2023-10")).toBe("since October 2023");
    expect(copy.rhythm.fastest.gap(1.8)).toBe("1.8 s");
  });

  it("pluralizes at one", () => {
    expect(copy.census.duration(1.9, 164160)).toEqual({ n: 1, unit: "day" });
    expect(copy.census.namesLede({ days: 371.5, seconds: 32097600 }, { days: 0, seconds: 51 }, true)).toBe(
      "The longest-running name has lasted 371 days; the shortest, 51 seconds.",
    );
    expect(copy.language.laughsLabel(1, 1)).toBe("1 laugh from 1 person");
    expect(copy.language.repeatedMeta(11, 3)).toBe("× 11 · 3 people");
    expect(copy.polls.pollWhen("04/21/2024", 1)).toBe(", 04/21/2024 · 1 vote");
    expect(copy.profile.repeatedLede("Tomi", 1, 3)).toBe("Others repeated a line of Tomi's word for word; the top one, 3 times.");
    expect(copy.profile.repeatedLede("Tomi", 8, 12)).toBe(
      "Others repeated 8 of Tomi's lines word for word; the top one, 12 times.",
    );
    expect(copy.profile.awardsLede("Tomi", 1, 0)).toBe("Tomi won 1 award.");
    expect(copy.profile.awardsLede("Tomi", 0, 0)).toBe("Tomi didn't win any awards or make the runners-up.");
    expect(copy.emojis.leadersLede([{ year: "2023", e: "😭" }, { year: "2024", e: "❤️" }])).toBe(
      "Number one each year: 😭 in 2023 and ❤️ in 2024.",
    );
  });

  it("quotes user text with curly quotes", () => {
    expect(copy.quote("Shall we?")).toBe("“Shall we?”");
  });

  it("units and counts agree at one", () => {
    expect(copy.polls.topRecord.unit(1)).toBe("vote");
    expect(copy.polls.topRecord.unit(34)).toBe("votes");
    expect(copy.rhythm.streakRecord.unit(1)).toBe("day in a row");
    expect(copy.language.topMuletilla.unit(1)).toBe("time");
    expect(copy.records.person.silence.unit(1)).toBe("day without writing");
    expect(copy.media.records.audio!.unit(1)).toBe("voice note");
    expect(copy.hero.lede(1, 1)).toBe("1 message over 1 day.");
    expect(copy.rhythm.streaksLede("Ana", 1, "Lucas", 1)).toBe(
      "The longest streak is Ana's: 1 day in a row writing; the longest silence, Lucas's: 1 day without writing.",
    );
    expect(copy.mentions.recordsLede("Bruno", 1, "Bruno", 1)).toBe(
      "Bruno got 1 mention and made 1: nobody tags or gets tagged more.",
    );
    expect(copy.media.audiosLede("Ana", 1, 21)).toContain("Ana sent 1 voice note,");
    expect(copy.polls.byPersonLede(1, "Bruno", 1)).toBe("The group made 1 poll; Bruno, 1: more than anyone.");
  });

  it("reads as US English", () => {
    expect(copy.media.favoriteLabel).toBe("Everyone's favorite domain");
    expect(copy.media.favoriteCaption("instagram.com", 1219)).toBe("their favorite: instagram.com (1,219)");
    expect(copy.records.length.caption).toBe("Types itself out, absurdly fast:");
    expect(copy.census.timelineLede(27, 19)).toBe("The group changed its name 27 times and its photo 19 times.");
    expect(copy.media.kindsLede("photos", 1587)).toBe("After text, the group sends photos the most: 1,587.");
    expect(copy.profile.kindsLede("Tomi", "stickers", 1340)).toBe("After text, Tomi sends stickers the most: 1,340.");
  });

  it("heatmap peak takes the plural day as given", () => {
    expect(copy.heatmap.peak("Saturdays", 22)).toBe("The peak: Saturdays at 22:00.");
  });

  it("swear words, not the Spanish list's name", () => {
    expect(copy.language.badwordsCriterion).toContain("swear words");
    expect(copy.chapters.find((c) => c.id === "lenguaje")!.blocks.find((b) => b.id === "badwords")!.title).toBe("Swear words");
  });
});
