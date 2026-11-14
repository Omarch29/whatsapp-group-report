import { formatsFor, type LocaleFormat } from "./formats";

/** Numbers and dates in Spanish (Argentina). */
const format: LocaleFormat = {
  locale: "es-AR",
  dateOrder: "dmy",
  months: [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ],
  monthYear: (name, year) => `${name} de ${year}`,
  percent: (n) => `${n} %`,
};
// Pure: a bundle built in the other language drops this file entirely (content/copy.ts).
const { fmt, fmtMonth, fmtSeconds, fmtShare } = /* @__PURE__ */ formatsFor(format);

/** "1 mensaje", "12 mensajes". */
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;

type Span = { days: number; seconds: number };

/** A span in its natural unit: whole days from one day up, else hours, minutes or seconds. */
function duration(days: number, seconds: number): { n: number; unit: string } {
  const pick = (n: number, one: string, many: string) => ({ n, unit: n === 1 ? one : many });
  if (days >= 1) return pick(Math.floor(days), "día", "días");
  if (seconds >= 3600) return pick(Math.floor(seconds / 3600), "hora", "horas");
  if (seconds >= 60) return pick(Math.floor(seconds / 60), "minuto", "minutos");
  return pick(seconds, "segundo", "segundos");
}

/** "1 vez", "412 veces". */
const times = (n: number) => `${fmt(n)} ${n === 1 ? "vez" : "veces"}`;

/** "11 risas de 3 personas". */
const copyLaughs = (laughs: number, people: number) =>
  `${fmt(laughs)} ${laughs === 1 ? "risa" : "risas"} de ${fmt(people)} ${people === 1 ? "persona" : "personas"}`;

// Qualitative phrases only. Numbers always come from facts.json / the data files:
// any entry that embeds a number is a function that receives it (thresholds from facts.thresholds).
// The reference copy: en.ts must have exactly this shape (i18n/copy.test.ts).
export const es = {
  verifiedOn: "2026-11-09",
  /** Someone's own words, quoted: «así». */
  quote: (s: string) => `«${s}»`,
  locale: format.locale,
  /** `<html lang>`. */
  htmlLang: "es-AR",
  dateOrder: format.dateOrder,
  months: [...format.months],
  monthYear: format.monthYear,
  percent: format.percent,
  monthsShort: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  /** Weekday names, 0 = lunes (the data's `rings.dow` order). */
  dow: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
  dowShort: ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"],
  /** "todos los viernes", "todos los sábados". */
  dowPlural: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"],
  /**
   * The chapters after the introduction, in reading order. `id` never changes (the data and the code use it);
   * `slug` is the public URL segment in this language.
   */
  chapters: [
    { id: "censo", slug: "censo", title: "Censo", blocks: [
      { id: "timeline", title: "Línea de tiempo" },
      { id: "tenure", title: "Antigüedad" },
      { id: "by-year", title: "Por año" },
      { id: "hour-of-each", title: "La hora de cada uno" },
    ] },
    { id: "carrera", slug: "carrera", title: "La carrera", blocks: [{ id: "race", title: "La carrera" }] },
    { id: "horas", slug: "horas", title: "Horas", blocks: [{ id: "heatmap", title: "Mapa de calor" }] },
    { id: "parejas", slug: "parejas", title: "Parejas", blocks: [{ id: "graph", title: "Grafo de parejas" }] },
    { id: "lenguaje", slug: "lenguaje", title: "Lenguaje", blocks: [
      { id: "muletillas", title: "Muletillas" },
      { id: "repeated", title: "Frases que otros le repitieron" },
      { id: "laughed", title: "Las que hicieron reír" },
      { id: "badwords", title: "Puteadas" },
      { id: "style", title: "Cómo escribe cada uno" },
      { id: "laughs", title: "La risa de cada uno" },
    ] },
    { id: "multimedia", slug: "multimedia", title: "Multimedia", blocks: [
      { id: "kinds", title: "Tipos de mensaje" },
      { id: "media-records", title: "Récords de multimedia" },
      { id: "audios", title: "Audios" },
      { id: "links", title: "Links" },
      { id: "deleted-edited", title: "Borrados y editados" },
    ] },
    { id: "emojis", slug: "emojis", title: "Emojis", blocks: [
      { id: "top", title: "Los más usados" },
      { id: "signature", title: "El emoji de cada uno" },
      { id: "by-year", title: "Por año" },
    ] },
    { id: "encuestas", slug: "encuestas", title: "Encuestas", blocks: [
      { id: "by-person", title: "Quién las arma" },
      { id: "top", title: "Las más votadas" },
    ] },
    { id: "ritmo", slug: "ritmo", title: "Ritmo", blocks: [
      { id: "starters-killers", title: "Quién arranca y quién mata la charla" },
      { id: "latency", title: "Cuánto tardan en contestar" },
      { id: "streaks", title: "Rachas" },
      { id: "rings", title: "Anillos" },
    ] },
    { id: "menciones", slug: "menciones", title: "Menciones", blocks: [
      { id: "matrix", title: "Matriz de menciones" },
      { id: "records", title: "Récords" },
      { id: "per-mil", title: "Por mil mensajes" },
    ] },
    { id: "salidas", slug: "salidas", title: "Las salidas", blocks: [{ id: "door", title: "La puerta" }, { id: "quotes", title: "Frases" }] },
    { id: "eventos", slug: "eventos", title: "Eventos", blocks: [{ id: "rail", title: "Línea de eventos" }] },
    { id: "records", slug: "records", title: "Récords", blocks: [
      { id: "length", title: "Mensaje más largo" },
      { id: "per-day", title: "Día más movido" },
      { id: "poll", title: "Encuesta récord" },
      { id: "night", title: "Madrugada" },
      { id: "quotes", title: "Frases" },
    ] },
    { id: "diccionario", slug: "diccionario", title: "Diccionario", blocks: [{ id: "cloud", title: "Nube de palabras" }] },
    { id: "premios", slug: "premios", title: "Premios", blocks: [{ id: "awards", title: "Premios" }] },
    { id: "personas", slug: "personas", title: "Personas", blocks: [{ id: "index", title: "Índice de personas" }] },
    { id: "conclusion", slug: "conclusion", title: "Conclusión", blocks: [{ id: "text", title: "Conclusión" }] },
  ],
  /** Any block (or person) with nothing to draw. */
  empty: "Nada que mostrar todavía.",
  gate: {
    placeholder: "La palabra del grupo",
    submit: "Entrar",
    error: "Esa no es.",
    unverifiable: "No se pudo verificar.",
  },
  nav: {
    chapters: "Capítulos",
    open: "Abrir capítulos",
    close: "Cerrar",
    counter: (n: number, total: number) => `Capítulo ${fmt(n)} de ${fmt(total)}`,
    prev: "Anterior",
    next: "Siguiente",
    back: "Volver al principio",
    pager: "Otros capítulos",
    /** Placeholder title without a report provider (ReportContext's default, unit tests). */
    report: "Informe",
    profile: "Este perfil",
  },
  /** The single-page mode's floating index; its items are the chapters' block titles. */
  single: {
    index: "Índice",
    open: "Abrir índice",
    close: "Cerrar",
  },
  block: {
    copy: "Copiar link",
    copied: "Link copiado",
    failed: "No se pudo copiar",
  },
  hero: {
    bubbles: ["Hablaron.", "Contamos.", "Todo."],
    lede: (totalMsgs: number, daysActive: number) =>
      `${plural(totalMsgs, "mensaje", "mensajes")} en ${plural(daysActive, "día", "días")}.`,
  },
  intro: {
    /** The introduction's chapter title (slug "", href "/") and its one block. */
    title: "Introducción",
    start: "Empezar",
  },
  census: {
    timelineLede: (nameChanges: number, photos: number) =>
      `El grupo cambió de nombre ${fmt(nameChanges)} ${nameChanges === 1 ? "vez" : "veces"} y de foto ${fmt(photos)}.`,
    /**
     * Both spans as `{ days, seconds }`; under a day the unit drops to hours, minutes or seconds.
     * `current`: the longest name is still the group's name at the end of the export ("lleva").
     */
    namesLede: (longest: Span, shortest: Span, current = false) => {
      const a = duration(longest.days, longest.seconds);
      const b = duration(shortest.days, shortest.seconds);
      return `El nombre que más duró ${current ? "lleva" : "aguantó"} ${fmt(a.n)} ${a.unit}; el que menos, ${fmt(b.n)} ${b.unit}.`;
    },
    duration: (days: number, seconds: number) => duration(days, seconds),
    timelineCriterion:
      "Cambios de nombre y de foto, entradas y salidas, los días con más mensajes y los eventos, por fecha. Las idas y vueltas de quien se va y vuelve van en un solo hito.",
    timelineLabel: "Línea de tiempo del grupo",
    timelineList: "Hitos del grupo",
    timelineHint: "Deslizá para recorrerla.",
    overviewLabel: "Resumen de la línea de tiempo",
    yearsLabel: "Ir a un año",
    timelineBack: "Más atrás",
    timelineForward: "Más adelante",
    kinds: {
      name: "Nombre nuevo",
      photo: "Foto",
      join: "Entra",
      leave: "Sale",
      peak: "Día récord",
      event: "Evento",
      departures: "Las salidas",
    },
    longestName: "El nombre que más duró",
    shortestName: "El que menos",
    /** "del 7/8/2025 al 9/11/2026"; dates already formatted. */
    nameSpan: (from: string, to: string) => `del ${from} al ${to}`,
    tenureLede: (absenceName: string, days: number) =>
      `${absenceName} estuvo ${fmt(days)} ${days === 1 ? "día" : "días"} sin escribir: la ausencia más larga del grupo.`,
    tenureLedeEmpty: "Del primer mensaje de cada uno al último.",
    tenureCriterion: (minGapDays: number) =>
      `Una barra por persona, de su primer mensaje al último. Lo rayado son más de ${fmt(minGapDays)} días seguidos sin escribir.`,
    tenureLabel: "Quién está desde cuándo",
    /** Bar tooltip: "Tomi: 1/9/2023 → 9/11/2026"; dates already formatted. */
    tenureSpan: (name: string, from: string, to: string) => `${name}: ${from} → ${to}`,
    tenureGap: (from: string, to: string, days: number) =>
      `Sin escribir: ${from} → ${to} (${fmt(days)} ${days === 1 ? "día" : "días"})`,
    /** Read by screen readers after the bar's span: "sin escribir del 15/1/2026 al 20/2/2026, 36 días". */
    tenureGapSpoken: (from: string, to: string, days: number) =>
      `sin escribir del ${from} al ${to}, ${fmt(days)} ${days === 1 ? "día" : "días"}`,
    absence: { label: "La ausencia más larga", unit: (n: number): string => (n === 1 ? "día" : "días"), caption: (to: string) => `hasta el ${to}` },
    byYearLede: (topYear: string, msgs: number) => `${topYear} fue el año con más mensajes: ${fmt(msgs)}.`,
    byYearCriterion: (lastYear: string, to: string) =>
      `Mensajes de cada persona con perfil por año; ${lastYear} llega hasta el ${to}. Por mil: qué parte de todos los mensajes de cada uno cayó en ese año.`,
    byYearLabel: "Mensajes por año",
    legendLabel: "Quién es quién",
    topPersonYear: { label: "El año de una sola persona", unit: (n: number): string => (n === 1 ? "mensaje" : "mensajes"), when: (year: string) => `en ${year}` },
    total: "Total",
    perMil: "Por mil",
    modeLabel: "Medida",
    /** Segment tooltip: "Bruno · 2023: 500". */
    yearSeg: (name: string, year: string, value: string) => `${name} · ${year}: ${value}`,
    hourLede: (earlyName: string, earlyShare: number, owlName: string, owlShare: number) =>
      `${earlyName} es el más madrugador, con el ${fmtShare(earlyShare)} de sus mensajes; ${owlName}, el más búho, con el ${fmtShare(owlShare)}.`,
    hourLedeEmpty: "La hora del día en que más escribe cada uno.",
    hourCriterion: (earlyFrom: number, earlyTo: number, owlFrom: number, owlTo: number) =>
      `La hora con más mensajes de cada persona en un reloj de 24 horas; el anillo es la parte de sus mensajes en esa hora. Madrugador: de ${earlyFrom} a ${earlyTo} h; búho: de ${owlFrom} a ${owlTo} h.`,
    hourLabel: "La hora de cada uno",
    /** "Tomi · 23 h". */
    clock: (name: string, hour: number) => `${name} · ${hour} h`,
    earlyBird: { label: "El más madrugador", caption: "de sus mensajes, de mañana temprano" },
    owl: { label: "El más búho", caption: "de sus mensajes, de madrugada" },
  },
  language: {
    chips: "Elegí a alguien",
    // Muletillas
    /** `ratio` is own per mil / rest per mil (floored), rounded: a safe lower bound. */
    muletillasLede: (name: string, phrase: string, own: number, ratio: number) =>
      `${name} dijo «${phrase}» ${times(own)}: ${times(Math.round(ratio))} más seguido que el resto del grupo.`,
    muletillasLedeEmpty: (name: string) => `Ninguna frase de ${name} pasa el filtro de muletilla.`,
    muletillasCriterion: "Frases de 2 a 5 palabras que una persona repite al menos 4 veces más por mil que el resto.",
    threadLabel: (name: string) => `Muletillas de ${name}`,
    typing: "escribiendo…",
    muletillaMeta: (own: number, others: number) => `${times(own)} · el resto ${fmt(others)}`,
    since: (month: string) => `desde ${fmtMonth(month)}`,
    exampleHint: "Tocá una frase para ver un mensaje real.",
    all: "Todas",
    allLabel: "La muletilla número uno de cada uno",
    times: (n: number) => times(n),
    topMuletilla: { label: "La muletilla más propia del grupo", unit: (n: number): string => (n === 1 ? "vez" : "veces") },
    // Repeated
    repeatedLede: (name: string, text: string, n: number, people: number) =>
      `«${text}», de ${name}, la repitieron ${fmt(people)} ${people === 1 ? "persona" : "personas"} ${times(n)}.`,
    repeatedLedeEmpty: "Frases que alguien escribió y otros repitieron después, textual.",
    repeatedCriterion: (minTimes: number) =>
      `Frases de 5 palabras o más que otras personas escribieron después, textual, al menos ${times(minTimes)}.`,
    repeatedLabel: (name: string) => `Frases de ${name} que otros repitieron`,
    repeatedBy: "La repitieron",
    repeatedMeta: (n: number, people: number) =>
      `× ${fmt(n)} · ${fmt(people)} ${people === 1 ? "persona" : "personas"}`,
    topRepeated: { label: "La frase más repetida del grupo", unit: (n: number): string => (n === 1 ? "vez" : "veces") },
    // Laughed
    laughedLede: (name: string, laughs: number, people: number) =>
      `El mensaje de ${name} que más hizo reír juntó ${copyLaughs(laughs, people)}.`,
    laughedLedeEmpty: "El mensaje de cada uno que más risas juntó.",
    laughedCriterion: (minLaughs: number) =>
      `Mensaje seguido de más risas de otros en 3 minutos; cuenta desde ${fmt(minLaughs)} ${minLaughs === 1 ? "risa" : "risas"}.`,
    laughsLabel: (laughs: number, people: number) => copyLaughs(laughs, people),
    topLaughed: { label: "La que más hizo reír", unit: (n: number): string => (n === 1 ? "risa" : "risas") },
    // Badwords
    badwordsLede: (name: string, total: number, perMil: number) =>
      `El grupo escribió ${plural(total, "puteada", "puteadas")}; ${name} encabeza con ${fmt(perMil)} por mil mensajes.`,
    badwordsLedeEmpty: "Puteadas por persona, en total y por cada mil mensajes.",
    badwordsCriterion: "La lista de puteadas del grupo; por mil = cada mil mensajes de la persona.",
    badwordsLabel: "Puteadas por persona",
    badwordsRecord: { label: "El mensaje más puteador", unit: (n: number): string => (n === 1 ? "distinta en un mensaje" : "distintas en un mensaje") },
    // Style
    styleLede: (name: string, avgChars: number) =>
      `${name} escribe los mensajes más largos: ${fmt(avgChars)} caracteres de promedio.`,
    styleCriterion: "Promedios sobre mensajes de texto; editados y borrados por mil mensajes.",
    styleLabel: "Cartas de personaje",
    styleMetrics: {
      avgChars: "Caracteres por mensaje",
      upperShare: "En mayúsculas",
      exclPerMil: "Exclamaciones",
      questPerMil: "Preguntas",
      editedPerMil: "Editados",
      deletedPerMil: "Borrados",
    },
    styleTop: "lo más alto del grupo",
    /** The card's trait: the first metric where the person tops the group. */
    styleTraits: {
      avgChars: "Escribe más largo que nadie",
      upperShare: "Grita más que nadie",
      exclPerMil: "Se exclama más que nadie",
      questPerMil: "Pregunta más que nadie",
      editedPerMil: "Edita más que nadie",
      deletedPerMil: "Borra más que nadie",
    },
    styleRecord: { label: "El mensaje más largo", unit: (n: number): string => (n === 1 ? "carácter" : "caracteres") },
    // Laughs
    laughsLede: (name: string, avgJa: number) =>
      `${name} es quien más estira la risa: ${fmt(avgJa)} «ja» por jaja, de promedio.`,
    laughsLedeEmpty: "Cómo escribe la risa cada uno.",
    laughsCriterion: "Cómo escribe la risa cada uno; jaja ×n es el largo promedio.",
    laughsRowsLabel: "La risa de cada uno",
    laughsLegend: "Tipos de risa",
    avgJa: (n: number) => `jaja ×${fmt(n)}`,
    /** Segment tooltip: "jsjs: 5 (6,3 %)"; the share is already formatted. */
    laughSeg: (label: string, n: number, share: string) => `${label}: ${fmt(n)} (${share})`,
    laughsRecord: { label: "El jaja más largo", unit: (n: number): string => (n === 1 ? "ja seguido" : "ja seguidos") },
  },
  media: {
    /** Spanish names of the parquet kinds, plural (the chart's legend and the ledes). */
    kindLabels: {
      text: "texto",
      image: "fotos",
      sticker: "stickers",
      audio: "audios",
      poll: "encuestas",
      video: "videos",
      deleted: "borrados",
      media: "multimedia",
      gif: "GIFs",
      location: "ubicaciones",
      call: "llamadas",
      document: "documentos",
      contact: "contactos",
      video_note: "notas de video",
      other: "otros",
    } as Record<string, string>,
    // Kinds
    kindsLede: (kind: string, n: number) => `Después del texto, lo que más se manda son ${kind}: ${fmt(n)}.`,
    /** `others` lists the folded kinds, already joined. */
    kindsCriterion: (others: string) =>
      `Mensajes de cada persona con perfil por tipo, sin contar el texto; por mil = cada mil mensajes de la persona.${others ? ` Otros: ${others}.` : ""}`,
    kindsLabel: "Qué manda cada uno",
    kindsLegend: "Tipos de mensaje",
    /** Segment tooltip and legend count: "fotos: 2.061"; the value is already formatted. */
    kindSeg: (label: string, value: string) => `${label}: ${value}`,
    stickerDay: { label: "El día más stickero", unit: (n: number): string => (n === 1 ? "sticker" : "stickers"), caption: "en un solo día" },
    // Records
    recordsLede: (parts: readonly { name: string; n: number; unit: string }[]) =>
      `${parts.map((p, i) => (i === 0 ? `${p.name} mandó ${fmt(p.n)} ${p.unit}` : `${p.name}, ${fmt(p.n)} ${p.unit}`)).join("; ")}.`,
    recordsCriterion:
      "El total de cada tipo por persona con perfil; el récord de un día es el día con más de ese tipo en todo el grupo.",
    records: {
      sticker: { label: "El más stickero", unit: (n: number): string => (n === 1 ? "sticker" : "stickers") },
      audio: { label: "El más audiero", unit: (n: number): string => (n === 1 ? "audio" : "audios") },
      image: { label: "El más fotógrafo", unit: (n: number): string => (n === 1 ? "foto" : "fotos") },
    } as Record<string, { label: string; unit: (n: number) => string }>,
    inTotal: "en total",
    /** "récord de un día: 39, Tomi el 09/04/2026"; the date is already formatted. */
    peakDay: (name: string, n: number, date: string) => `récord de un día: ${fmt(n)}, ${name} el ${date}`,
    // Audios
    audiosLede: (name: string, n: number, hour: number) =>
      `${name} mandó ${plural(n, "audio", "audios")}, más que nadie; el grupo manda más audios ${hour === 1 ? "a la 1" : `a las ${hour}`} h.`,
    audiosCriterion: "Audios por persona con perfil; por hora del día y por año, de todo el grupo.",
    audiosByPerson: "Audios por persona",
    audiosByHour: "Audios por hora del día",
    audiosByYear: "Audios por año",
    /** "21 h: 760". */
    hourBar: (hour: number, n: number) => `${hour} h: ${fmt(n)}`,
    /** Bar tooltip: "Ana: 47,2 por mil mensajes". */
    perMilTitle: (name: string, perMil: number) => `${name}: ${fmt(perMil)} por mil mensajes`,
    audioDay: { label: "El día de más audios", unit: (n: number): string => (n === 1 ? "audio" : "audios"), caption: "en un solo día" },
    // Links
    linksLede: (name: string, n: number, domain: string, domainN: number) =>
      `${name} compartió ${plural(n, "link", "links")}, más que nadie; el sitio más compartido es ${domain}, con ${fmt(domainN)}.`,
    linksCriterion:
      "Links en los mensajes, uno por URL, por dominio sin «www.» (x.com cuenta como twitter.com). El favorito de cada uno es el dominio que más compartió.",
    domainsLabel: "Dominios más compartidos",
    linksByPerson: "Links por persona",
    favoriteLabel: "El dominio favorito de cada uno",
    topSharer: { label: "El que más links manda", unit: (n: number): string => (n === 1 ? "link" : "links") },
    /** "su favorito: instagram.com (1.264)". */
    favoriteCaption: (domain: string, n: number) => `su favorito: ${domain} (${fmt(n)})`,
    // Deleted and edited
    deletedLede: (delName: string, delPerMil: number, editName: string, editPerMil: number) =>
      `${delName} es quien más borra: ${fmt(delPerMil)} por mil mensajes; ${editName}, quien más edita: ${fmt(editPerMil)} por mil.`,
    deletedCriterion:
      "Mensajes borrados («Se eliminó este mensaje») y editados de cada persona con perfil; por mil = cada mil mensajes de la persona.",
    deletedLabel: "Borrados y editados por persona",
    deletedLegend: "Borrados y editados",
    deleted: "borrados",
    edited: "editados",
    deletedBubble: "Se eliminó este mensaje",
    /** Bar tooltip: "Bruno · borrados: 445"; the value is already formatted. */
    seriesTitle: (name: string, series: string, value: string) => `${name} · ${series}: ${value}`,
    deletedDay: { label: "El día con más borrados", unit: (n: number): string => (n === 1 ? "borrado" : "borrados"), caption: "entre todo el grupo" },
  },
  emojis: {
    // Top
    topLede: (e: string, n: number) => `${e} es el emoji del grupo: ${times(n)}.`,
    topCriterion: "Los 30 emojis más usados, cada aparición cuenta. Tocá uno para ver quién lo usa más.",
    cloudLabel: "Emojis del grupo",
    /** "537 veces · lo usa más: Bruno". */
    detail: (n: number, name: string | null) => (name ? `${times(n)} · lo usa más: ${name}` : times(n)),
    /** `who` follows the top user's name; `everyone` stands alone when nobody with a profile tops it. */
    topRecord: { label: "El emoji más usado", unit: (n: number): string => (n === 1 ? "vez" : "veces"), who: "quien más lo usa", everyone: "entre todos" },
    // Signature
    signatureLede: (name: string, e: string, ratio: number) =>
      `La firma más fuerte es ${e}, de ${name}: lo usa ${times(Math.round(ratio))} más seguido que el resto.`,
    signatureCriterion: (minOwn: number) =>
      `El emoji que cada uno usa más seguido que el resto, por mil mensajes, entre los que puso en al menos ${fmt(minOwn)} ${minOwn === 1 ? "mensaje" : "mensajes"}.`,
    signatureLabel: "El emoji de cada uno",
    /** "×90": messages with the emoji. */
    signatureOwn: (own: number) => `×${fmt(own)}`,
    signatureRatio: (ratio: number) => `${fmt(ratio)} veces más que el resto`,
    /** Read by screen readers: "Tomi 😂 ×90, 3,2 veces más que el resto". */
    signatureSpoken: (name: string, e: string, own: number, ratio: number) =>
      `${name} ${e} ×${fmt(own)}, ${fmt(ratio)} veces más que el resto`,
    signatureRecord: {
      label: "La firma más fuerte",
      unit: (n: number): string => (n === 1 ? "mensaje" : "mensajes"),
      when: (ratio: number) => `${fmt(ratio)} veces más seguido que el resto`,
    },
    // By year
    /** "El número uno de cada año: 😭 en 2023, ❤️ en 2024 y 👀 en 2025." */
    leadersLede: (leaders: readonly { year: string; e: string }[]) => {
      const parts = leaders.map((l) => `${l.e} en ${l.year}`);
      const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}` : (parts[0] ?? "");
      return `El número uno de cada año: ${list}.`;
    },
    ledYearsLede: (e: string, years: number, of: number) =>
      of === 1
        ? `${e} fue el número uno del único año.`
        : `${e} fue el número uno en ${fmt(years)} de los ${fmt(of)} años.`,
    constantLede: (e: string, years: number, of: number) =>
      of === 1
        ? `${e} estuvo en el top 5 del único año.`
        : `${e} estuvo en el top 5 en ${fmt(years)} de los ${fmt(of)} años.`,
    byYearCriterion: "Los 5 emojis más usados de cada año, cada aparición cuenta.",
    byYearLabel: "Top 5 por año",
    yearLabel: (year: string) => `Top 5 de ${year}`,
    yearRecord: { label: "El emoji de un año", unit: (n: number): string => (n === 1 ? "vez" : "veces"), when: (year: string) => `en ${year}` },
  },
  polls: {
    byPersonLede: (total: number, name: string, n: number) =>
      `El grupo armó ${plural(total, "encuesta", "encuestas")}; ${name}, ${fmt(n)}: más que nadie.`,
    byPersonCriterion: "Encuestas creadas por cada persona con perfil; el total suma también las del resto.",
    byPersonLabel: "Encuestas por persona",
    creator: {
      label: "El que más encuestas armó",
      unit: (n: number): string => (n === 1 ? "encuesta" : "encuestas"),
      share: (share: string) => `el ${share} del total`,
    },
    tabsLabel: "Ordenar encuestas",
    tabs: { mostVoted: "Más votadas", unanimous: "Más unánimes", divided: "Más divididas" },
    topLede: (question: string, votes: number) =>
      `La encuesta más votada juntó ${fmt(votes)} ${votes === 1 ? "voto" : "votos"}: «${question}».`,
    topCriterion: (minVotes: number) =>
      `Las 10 con más votos. Unánimes y divididas, entre las de al menos ${fmt(minVotes)} votos: la que más votos le dio a una opción y la de menor diferencia entre la primera y la segunda.`,
    /** Author of a poll by someone without a profile. */
    someoneElse: "alguien más",
    /** Follows the author's name: ", 21/04/2024 · 34 votos"; the date is already formatted. */
    pollWhen: (date: string, votes: number) => `, ${date} · ${fmt(votes)} ${votes === 1 ? "voto" : "votos"}`,
    topRecord: { label: "La más votada", unit: (n: number): string => (n === 1 ? "voto" : "votos") },
  },
  rhythm: {
    // Starters and killers
    startersLede: (starter: string, n: number, killer: string, m: number) =>
      `${starter} arrancó la charla ${times(n)}, más que nadie; ${killer} la mató ${times(m)}.`,
    startersCriterion: "Arranca: primer mensaje después de 3 horas de silencio. Mata: último antes de uno.",
    startersLabel: "Arranques y cierres por persona",
    starts: "arranca",
    kills: "mata",
    startersLegend: "Arranca y mata",
    /** Bar tooltip: "Ana · arranca: 299". */
    barTitle: (name: string, series: string, n: number) => `${name} · ${series}: ${fmt(n)}`,
    startersRecord: { label: "El que más arranca", unit: (n: number): string => (n === 1 ? "arranque" : "arranques"), when: "en total" },
    // Latency
    latencyLede: (name: string, medianFromSec: number) =>
      `${name} es quien contesta más rápido: la mitad de sus respuestas salen en ${fmtSeconds(medianFromSec)} o menos.`,
    latencyCriterion: (minReplies: number) =>
      `Mediana de segundos hasta responder, entre respuestas en menos de 10 minutos; se piden al menos ${fmt(minReplies)} ${minReplies === 1 ? "respuesta" : "respuestas"}.`,
    latencyLabel: "Mediana de respuesta por persona",
    latencyLegend: "Velocidad de respuesta",
    latencyFrom: "cuánto tarda en responder",
    latencyTo: "cuánto tardan en responderle",
    latencyAxis: "Segundos, en escala logarítmica",
    /** Under the latency chart when the export's timestamps have no seconds (`global.timeResolution === "minute"`). */
    minuteNote: "Este export no trae segundos: los tiempos están al minuto.",
    /** Row tooltip and spoken row: "Lucas: responde en 10 s; le responden en 12 s". */
    latencyRow: (name: string, from: number, to: number) =>
      `${name}: responde en ${fmtSeconds(from)}; le responden en ${fmtSeconds(to)}`,
    tick: (sec: number) => fmtSeconds(sec),
    fastest: {
      label: "La respuesta más rápida",
      unit: "s",
      caption: (name: string) => `contestándole a ${name}`,
      /** The tag between the two bubbles: "1,8 s". */
      gap: (seconds: number) => fmtSeconds(seconds),
      pair: "Los dos mensajes",
    },
    // Streaks
    streaksLede: (streakName: string, days: number, silenceName: string, silenceDays: number) =>
      `La racha más larga es de ${streakName}: ${plural(days, "día seguido", "días seguidos")} escribiendo; el silencio más largo, de ${silenceName}: ${plural(silenceDays, "día", "días")} sin escribir.`,
    streaksCriterion:
      "Racha: días seguidos con al menos un mensaje de la persona. Silencio: el tramo más largo que pasó sin escribir.",
    streaksLabel: "Rachas y silencios por persona",
    streaksLegend: "Racha y silencio",
    streak: "racha",
    silence: "silencio",
    /** "322 días". */
    days: (n: number) => `${fmt(n)} ${n === 1 ? "día" : "días"}`,
    /** Bar tooltip: "Ana · racha: 322 días, del 22/12/2025 al 08/11/2026"; the dates are already formatted. */
    spanTitle: (name: string, series: string, days: number, from: string, to: string) =>
      `${name} · ${series}: ${fmt(days)} ${days === 1 ? "día" : "días"}, del ${from} al ${to}`,
    streakRecord: { label: "La racha más larga", unit: (n: number): string => (n === 1 ? "día seguido" : "días seguidos"), caption: (to: string) => `hasta el ${to}` },
    // Rings
    ringsLede: (dow: string, dowMsgs: number, month: string, monthMsgs: number) =>
      `El ${dow} es el día más movido de la semana, con ${plural(dowMsgs, "mensaje", "mensajes")}; ${month}, el mes más movido del año, con ${fmt(monthMsgs)}.`,
    ringsCriterion: "Mensajes de todo el grupo por día de la semana y por mes del año, sumando todos los años del chat.",
    dowLabel: "Por día de la semana",
    monthLabel: "Por mes del año",
    /** Segment tooltip: "viernes: 1.476". */
    segment: (label: string, n: number) => `${label}: ${fmt(n)}`,
    ringsRecord: {
      label: "El día más movido de la semana",
      unit: (n: number): string => (n === 1 ? "mensaje" : "mensajes"),
      /** Takes the plural weekday: "todos los viernes". */
      when: (dows: string) => `todos los ${dows}`,
      caption: "sumando todos los años",
    },
  },
  mentions: {
    // Matrix
    /** The biggest cell: who tags whom the most. */
    matrixLede: (from: string, to: string, n: number) => `${from} es quien más etiqueta a ${to}: ${times(n)}, la pareja récord.`,
    pairRecord: { label: "La pareja que más se etiqueta", unit: (n: number): string => (n === 1 ? "mención" : "menciones"), when: (to: string) => `a ${to}` },
    matrixCriterion: "Menciones con @ entre personas con perfil; una por mensaje y persona.",
    matrixLabel: "Quién menciona a quién",
    /** Corner of the grid: rows mention columns (shown with arrows, read as `cornerSpoken`). */
    corner: "de ↓ a →",
    cornerSpoken: "de / a",
    /** Cell label: "Tomi menciona a Ana: 120". */
    cell: (from: string, to: string, n: number) => `${from} menciona a ${to}: ${fmt(n)}`,
    hint: "Tocá una celda para ver los mensajes.",
    /** Panel title: "Tomi mencionó a Ana 120 veces". */
    samplesTitle: (from: string, to: string, n: number) => `${from} mencionó a ${to} ${times(n)}`,
    noSamples: "No hay mensajes para mostrar.",
    close: "Cerrar",
    // Profile mode
    mentionsTo: (name: string) => `A quién menciona ${name}`,
    mentionedBy: (name: string) => `Quién menciona a ${name}`,
    // Records
    recordsLede: (mentioned: string, n: number, tagger: string, m: number) =>
      mentioned === tagger
        ? `${mentioned} recibió ${plural(n, "mención", "menciones")} e hizo ${fmt(m)}: nadie etiqueta ni es etiquetado más.`
        : `${mentioned} recibió ${plural(n, "mención", "menciones")}, más que nadie; ${tagger} hizo ${fmt(m)}, más que nadie.`,
    recordsCriterion: "Menciones con @ que cada persona con perfil recibió (de otras con perfil) y que hizo.",
    mostMentioned: { label: "El más mencionado", unit: (n: number): string => (n === 1 ? "mención" : "menciones"), when: "en total" },
    topTagger: { label: "El que más etiqueta", unit: (n: number): string => (n === 1 ? "mención" : "menciones"), when: "en total" },
    // Per mil
    perMilLede: (name: string, perMil: number) =>
      `${name} es quien más etiqueta por mensaje: ${fmt(perMil)} menciones cada mil mensajes.`,
    perMilCriterion: "Menciones con @ que hizo cada persona con perfil, cada mil mensajes suyos.",
    perMilLabel: "Menciones cada mil mensajes",
    /** Bar tooltip: "Tomi: 64,5 por mil (2.318 menciones)". */
    perMilTitle: (name: string, perMil: number, n: number) => `${name}: ${fmt(perMil)} por mil (${plural(n, "mención", "menciones")})`,
    perMilRecord: {
      label: "El que más etiqueta por mensaje",
      unit: "por mil",
      when: (n: number) => `${plural(n, "mención", "menciones")} en total`,
    },
  },
  awards: {
    lede: (count: number) => `${plural(count, "premio", "premios")}, cada uno con su ganador y dos finalistas. Abrí los sobres.`,
    criterion: "Cada premio sale de los capítulos anteriores; dos finalistas por premio.",
    nobody: "Desierto",
    gridLabel: "Premios",
    runnersUp: "Finalistas",
    /** Shown on a closed envelope. */
    closed: "?",
    /** Units whose data label reads badly on its own. */
    units: { x: "veces más que el resto" } as Record<string, string>,
    nickname: (nick: string) => `«${nick}»`,
  },
  conclusion: {
    numbersLabel: "El grupo en tres números",
    msgs: "mensajes",
    days: "días con mensajes",
    awards: "premios",
  },
  race: {
    title: "La carrera",
    monthLabel: "Mes",
    play: "Play",
    pause: "Pausa",
    reset: "Volver al inicio",
    criterion: "Mensajes acumulados por mes.",
    /** `name` is who takes the lead (the departer); only used when the data says someone does. */
    lede: (name: string, overtakeMonth: string | null, monthsToTop: number | null) => {
      const base = "Mensajes acumulados. Dale play y mirá";
      if (monthsToTop === 0) return `${base} cómo ${name} se pone adelante desde el primer mes.`;
      if (monthsToTop === null || overtakeMonth === null) return `${base} quién se pone adelante.`;
      const months = monthsToTop === 1 ? "un mes" : `${fmt(monthsToTop)} meses`;
      return `${base} cómo ${name} se pone adelante en ${fmtMonth(overtakeMonth)}, a los ${months}.`;
    },
  },
  heatmap: {
    title: "Cuándo",
    gridLabel: "Mensajes por hora y día",
    /** The chip that shows the whole group. */
    group: "Grupo",
    /** Cell tooltip: "Lun 21:00 · 1.234 msgs"; `hour` is already zero-padded. */
    cell: (day: string, hour: string, n: number) => `${day} ${hour}:00 · ${plural(n, "msg", "msgs")}`,
    criterion: "Mensajes por hora y día de la semana.",
    lede: "Cada celda es una hora de la semana. Más brillo, más mensajes.",
    /** `peakDows` is the plural day ("sábados", from `dowPlural`). */
    peak: (peakDows: string, peakHour: number) => `El pico: los ${peakDows} a las ${peakHour} h.`,
  },
  pairs: {
    title: "Quién le habla a quién",
    criterion: "Respuestas en menos de 10 minutos entre dos personas.",
    lede: "Respuestas entre dos. Más gruesa la línea, más charla.",
  },
  departures: {
    title: "Las salidas",
    criterion: "Reingresos detectados en los mensajes de sistema.",
    /** `name` is the person who leaves and comes back. */
    lede: (name: string, reentries: number) => `${name} se fue y volvió ${times(reentries)}.`,
    chips: {
      under10Min: "vueltas en menos de 10 minutos",
      medianOut: "mediana afuera",
      polls: "encuestas creadas",
    },
    barsLabel: "Reingresos por mes",
    /** "Los picos rosas: mayo de 2024 y noviembre de 2025, 20 cada uno." */
    peaks: (peaks: ReadonlyArray<{ month: string; n: number }>) => {
      const [first, ...rest] = peaks;
      if (!first) return "";
      if (rest.length === 0) return `El pico rosa: ${fmtMonth(first.month)}, ${fmt(first.n)}.`;
      const names = peaks.map((p) => fmtMonth(p.month));
      const last = names.pop();
      const list = `${names.join(", ")} y ${last}`;
      if (peaks.every((p) => p.n === first.n)) return `Los picos rosas: ${list}, ${fmt(first.n)} cada uno.`;
      return `Los picos rosas: ${list}.`;
    },
    quotesTitle: "Lo que el grupo repite",
    attributedTitle: (name: string) => `Lo que le atribuyen a ${name}`,
    quoteMeta: (times: number, people: number) =>
      `${fmt(times)} ${times === 1 ? "vez" : "veces"} · ${fmt(people)} ${people === 1 ? "persona" : "personas"}`,
    attributedMeta: (name: string) => `— ${name}`,
  },
  events: {
    title: "Eventos y sagas",
    criterion: "Días en que el grupo volvió a nombrar el evento.",
    lede: "Lo que pasó una vez y se sigue nombrando.",
    empty: "Nada que contar todavía.",
    more: (n: number) => `Ver los otros ${fmt(n)}`,
    /** Follows a bold count: "158 días lo volvieron a nombrar". */
    laterDays: (n: number): string => (n === 1 ? "día lo volvió a nombrar" : "días lo volvieron a nombrar"),
    originMsgs: (n: number): string => (n === 1 ? "mensaje ese día" : "mensajes ese día"),
    kind: { evento: "evento", saga: "saga" },
    origin: "origen",
    listDays: (n: number) => `${fmt(n)} ${n === 1 ? "día" : "días"}`,
    railLabel: "Eventos y sagas",
  },
  records: {
    title: "Récords",
    /** One line per block of the chapter (group view). */
    criterion: {
      length: "Caracteres por mensaje de texto.",
      perDay: "Mensajes de todo el grupo en un mismo día.",
      poll: "Votos sumados de todas las opciones.",
      night: "El mensaje de texto escrito más tarde entre las 3 y las 6 de la mañana.",
      quotes:
        "Risas de otros en los 3 minutos siguientes; respuestas de otros en 5 minutos, antes de que el autor vuelva a escribir.",
    },
    lede: "Lo más largo, lo más tarde, lo más festejado.",
    length: {
      label: "Largo de mensaje",
      averageUnit: "caracteres de promedio",
      unit: (n: number): string => (n === 1 ? "carácter" : "caracteres"),
      caption: "Se escribe solo, a velocidad absurda:",
    },
    perDay: {
      label: "Mensajes por día",
      averageUnit: "por día",
      unit: (n: number): string => (n === 1 ? "mensaje" : "mensajes"),
      caption: "el día más ruidoso del grupo.",
    },
    pollTitle: (name: string, votes: number) =>
      `La encuesta más votada de la historia (${name}, ${fmt(votes)} ${votes === 1 ? "voto" : "votos"})`,
    latestNightTitle: "El mensaje más tarde de la historia",
    /** "Ana, 14/07/2024 a las 05:59" (no time when `when` has none). */
    latestNightMeta: (name: string, date: string, time: string | null) =>
      time ? `${name}, ${date} a las ${time}` : `${name}, ${date}`,
    funniestTitle: "Lo que más hizo reír",
    mostRepliedTitle: "Lo que más respuestas tuvo",
    laughsMeta: (laughs: number, people: number) =>
      `${fmt(laughs)} ${laughs === 1 ? "risa" : "risas"} · ${fmt(people)} ${people === 1 ? "persona" : "personas"}`,
    repliesMeta: (replies: number, people: number) =>
      `${fmt(replies)} ${replies === 1 ? "respuesta" : "respuestas"} · ${fmt(people)} ${people === 1 ? "persona" : "personas"}`,
    person: {
      busiest: { label: "Día más intenso", unit: (n: number): string => (n === 1 ? "mensaje" : "mensajes"), caption: "en un solo día." },
      streak: { label: "Racha", unit: (n: number): string => (n === 1 ? "día seguido" : "días seguidos"), caption: (to: string) => `hasta el ${to}` },
      silence: { label: "Silencio", unit: (n: number): string => (n === 1 ? "día sin escribir" : "días sin escribir"), caption: (to: string) => `hasta el ${to}` },
    },
  },
  dictionary: {
    title: "Diccionario",
    criterion: "Palabras nacidas en el grupo, por cantidad de usos.",
    lede: "Palabras que solo entiende el grupo.",
    /** "Bruno · 824 usos · desde 22/07/2024". `since` is already a formatted date. */
    detail: (name: string, n: number, since: string) =>
      `${name} · ${fmt(n)} ${n === 1 ? "uso" : "usos"} · desde ${since}`,
    coined: (name: string, n: number) => `${name} acuñó ${fmt(n)}`,
    legendLabel: "Quién acuñó cada palabra",
    cloudLabel: "Palabras del grupo",
  },
  profile: {
    /**
     * Every anchored block of a profile (/p/[slug]/), in page order: the sidebar's «Este perfil» anchors.
     * Each title is the block's heading on the page (the v1 sections keep their copy.*.title).
     */
    blocks: [
      { id: "race", title: "La carrera" },
      { id: "heatmap", title: "Cuándo" },
      { id: "graph", title: "Quién le habla a quién" },
      { id: "cloud", title: "Diccionario" },
      { id: "rail", title: "Eventos y sagas" },
      { id: "muletillas", title: "Muletillas" },
      { id: "repeated", title: "Frases que otros le repitieron" },
      { id: "laughed", title: "La que más hizo reír" },
      { id: "laughs", title: "Cómo se ríe" },
      { id: "signature", title: "Su emoji" },
      { id: "kinds", title: "Qué manda" },
      { id: "mentions", title: "Menciones" },
      { id: "latency", title: "Cuánto tarda en contestar" },
      { id: "premios", title: "Premios" },
    ],
    back: "Volver al grupo",
    indexTitle: "Uno por uno",
    indexLede: "Tocá a alguien para ver su propio recorrido.",
    raceLede: (name: string) => `La posición de ${name} contra el grupo, mes a mes.`,
    heatmapLede: (name: string) => `Cuándo escribe ${name}.`,
    pairsLede: (name: string) => `Con quién habla ${name}.`,
    eventsLede: (name: string) => `Los eventos donde ${name} fue protagonista.`,
    dictionaryLede: (name: string) => `Las palabras que acuñó ${name}.`,
    // New blocks (the chapter components with the person fixed)
    repeatedLede: (name: string, phrases: number, most: number) =>
      `Otros repitieron textual ${fmt(phrases)} ${phrases === 1 ? "frase" : "frases"} de ${name}; la que más, ${times(most)}.`,
    repeatedEmpty: (name: string) => `Nadie repitió textual una frase de ${name}.`,
    laughedLede: (name: string, laughs: number, people: number) =>
      `El mensaje de ${name} que más hizo reír juntó ${copyLaughs(laughs, people)}.`,
    laughedEmpty: (name: string) => `Ningún mensaje de ${name} juntó risas suficientes.`,
    /** `label` is the laugh class as written ("jaja", "😂 🤣"); `share` of all their laughs, 0–1. */
    laughsLede: (name: string, label: string, share: number, avgJa: number) =>
      `${name} se ríe sobre todo con «${label}»: el ${fmtShare(share)} de sus risas, y estira el jaja a ${fmt(avgJa)} «ja» de promedio.`,
    laughsEmpty: (name: string) => `${name} no escribió risas.`,
    signatureLede: (name: string, e: string, ratio: number) =>
      `La firma de ${name} es ${e}: lo usa ${fmt(ratio)} veces más seguido que el resto.`,
    signatureEmpty: (name: string) => `Ningún emoji de ${name} pasa el filtro de firma.`,
    kindsLede: (name: string, kind: string, n: number) => `Después del texto, lo que más manda ${name} son ${kind}: ${fmt(n)}.`,
    kindsEmpty: (name: string) => `${name} solo manda texto.`,
    /** Top of each list (whom they tag, who tags them), or null when that list is empty. */
    mentionsLede: (
      name: string,
      to: { name: string; n: number } | null,
      by: { name: string; n: number } | null,
    ) => {
      const a = to && `${name} etiqueta más que a nadie a ${to.name}: ${times(to.n)}.`;
      const b = by && `Quien más etiqueta a ${name} es ${by.name}: ${times(by.n)}.`;
      return [a, b].filter(Boolean).join(" ") || `${name} no etiqueta a nadie con perfil, ni nadie a ${name}.`;
    },
    latencyLede: (name: string, fromSec: number, toSec: number) =>
      `La mitad de las respuestas de ${name} salen en ${fmtSeconds(fromSec)} o menos; a ${name} le contestan en ${fmtSeconds(toSec)}.`,
    /** Shown instead of the chart when the person is out of the latency ranking. */
    latencyEmpty: "Sin respuestas para medir.",
    awardsLede: (name: string, won: number, finalist: number) => {
      const prizes = `${fmt(won)} ${won === 1 ? "premio" : "premios"}`;
      if (won > 0) return finalist > 0 ? `${name} ganó ${prizes} y fue finalista en ${fmt(finalist)}.` : `${name} ganó ${prizes}.`;
      return finalist > 0
        ? `${name} no ganó ningún premio, pero fue finalista en ${fmt(finalist)}.`
        : `${name} no ganó premios ni fue finalista.`;
    },
    awardsCriterion: "Los del capítulo Premios: los que ganó y en los que quedó entre los dos finalistas.",
    awardsWon: "Premios que ganó",
    awardsFinalist: "Finalista",
    finalistIn: (title: string) => `finalista en ${title}`,
  },
};
