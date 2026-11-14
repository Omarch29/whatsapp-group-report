import type { Nicknames } from "@/lib/nicknames";
import type {
  Award,
  CensusData,
  EmojisData,
  EventData,
  Facts,
  GlobalData,
  LanguageData,
  LoreTerm,
  DeparturesData,
  MediaData,
  MentionsData,
  PersonData,
  PollsData,
  RecordsData,
  RhythmData,
} from "@/lib/schema";

// Tiny, schema-valid stand-ins for web/data/*.json (validated in lib/data.test.ts).

const zeros24 = (): number[] => Array.from({ length: 24 }, () => 0);
const heatmap = (peakDow: number, peakHour: number, n: number): number[][] =>
  Array.from({ length: 7 }, (_, d) => zeros24().map((_, h) => (d === peakDow && h === peakHour ? n : 1)));

/** A Spanish laugh mix as the pipeline writes it: a list in language order (jaja, jsjs, jeje, jiji, xd, emoji). */
const laughMix = (jaja: number, jsjs: number, jeje: number, jiji: number, xd: number, emoji: number) => [
  { key: "jaja", label: "jaja", n: jaja },
  { key: "jsjs", label: "jsjs", n: jsjs },
  { key: "jeje", label: "jeje", n: jeje },
  { key: "jiji", label: "jiji", n: jiji },
  { key: "xd", label: "xd", n: xd },
  { key: "emoji", label: "😂", n: emoji },
];

const global: GlobalData = {
  title: "Los del Parque",
  lang: "es",
  platform: "ios",
  timeResolution: "second",
  mode: "full",
  gate: true,
  generatedAt: "2026-11-09T19:49:16+00:00",
  period: { from: "2023-09-01", to: "2023-11-30" },
  totals: { msgs: 1000, daysActive: 80, people: 5 },
  people: [
    {
      slug: "bruno", name: "Bruno", colorIndex: 0, msgs: 500, text: 450, audios: 10, images: 20,
      stickers: 5, videos: 3, polls: 7, deleted: 5,
      media: 0,
      firstMessage: { when: "2023-09-01T14:37:52", text: "Llegué, ¿quién más está?" },
    },
    {
      slug: "tomi", name: "Tomi", colorIndex: 1, msgs: 300, text: 270, audios: 2, images: 15,
      stickers: 8, videos: 1, polls: 2, deleted: 2,
      media: 0,
      firstMessage: { when: "2023-09-01T15:00:00", text: "Buenas" },
    },
    {
      slug: "ana", name: "Ana", colorIndex: 2, msgs: 150, text: 120, audios: 20, images: 6,
      stickers: 1, videos: 2, polls: 0, deleted: 1,
      media: 0,
      firstMessage: { when: "2023-09-02T09:10:00", text: "Qué onda" },
    },
    {
      slug: "resto", name: "Resto", colorIndex: -1, msgs: 50, text: 45, audios: 1, images: 2,
      stickers: 1, videos: 0, polls: 0, deleted: 1,
      media: 0,
      firstMessage: { when: "2023-09-03T10:00:00", text: "Hola" },
    },
  ],
  monthly: {
    months: ["2023-09", "2023-10", "2023-11"],
    series: { bruno: [200, 150, 150], tomi: [80, 120, 100], ana: [0, 70, 80] },
  },
  heatmap: heatmap(4, 11, 40),
  edges: [
    { a: "tomi", b: "bruno", w: 120 },
    { a: "bruno", b: "ana", w: 60 },
    { a: "tomi", b: "ana", w: 20 },
  ],
  starters: { bruno: 12, tomi: 5, ana: 7 },
  killers: { bruno: 3, tomi: 9, ana: 6 },
};

const person: PersonData = {
  slug: "tomi",
  name: "Tomi",
  msgs: 300,
  activeDays: 64,
  rankByMonth: [2, 2, 2],
  monthly: [80, 120, 100],
  heatmap: heatmap(2, 22, 15),
  repliesTo: [{ slug: "bruno", n: 90 }, { slug: "ana", n: 20 }],
  repliedBy: [{ slug: "bruno", n: 85 }, { slug: "ana", n: 25 }],
  signatureWords: [
    { w: "plancha", n: 14, ratio: 64.8 },
    { w: "tortuga", n: 9, ratio: 40.2 },
  ],
  emojis: [{ e: "❌", n: 30 }, { e: "😂", n: 25 }],
  kinds: { text: 270, image: 15, sticker: 8, audio: 2, poll: 2, video: 1, deleted: 2 },
  records: {
    longest: { value: 640, record: { who: "tomi", when: "2025-06-14T18:22:05", text: "¿Vieron la luna hoy?" } },
    busiestDay: { date: "2023-10-09", msgs: 42 },
    streak: { days: 21, from: "2023-10-01", to: "2023-10-21" },
    silence: { days: 6, from: "2023-11-02", to: "2023-11-08" },
    lateNightShare: 0.034,
  },
};

const events: EventData[] = [
  {
    id: "la-final", title: "La final del Mundial", kind: "saga",
    originDate: "2023-10-11", originMsgs: 120, laterDays: 20, laterMentions: 35,
    note: "Cábalas, penales y nadie se movió de su lugar.",
    sampleOrigin: ["12:09 Bruno: Nadie se mueve hasta los penales", "12:10 Tomi: <no> puedo mirar"],
    sampleLater: ["2023-11-12 Ana: Como en la final"],
    topReferencers: ["ana", "tomi"], protagonists: ["bruno"],
  },
  {
    id: "asado-lluvia", title: "El asado bajo la lluvia", kind: "evento",
    originDate: "2023-09-23", originMsgs: 80, laterDays: 4, laterMentions: 6,
    note: "Llovió y se hizo igual.",
    sampleOrigin: ["20:01 Ana: Se larga"], sampleLater: [],
    topReferencers: ["tomi"], protagonists: ["ana", "tomi"],
  },
  {
    id: "viaje-costa", title: "El viaje a la costa", kind: "evento",
    originDate: "2023-11-04", originMsgs: 60, laterDays: 2, laterMentions: 3,
    note: "Tres días, un auto.",
    sampleOrigin: ["09:30 Tomi: Salimos a las 10"], sampleLater: ["2023-11-20 Bruno: Como en la costa"],
    topReferencers: ["bruno"], protagonists: ["tomi", "bruno", "ana"],
  },
];

const records: RecordsData = {
  messageLength: { value: 27.6, record: { who: "tomi", when: "2025-06-14T18:22:05", text: "¿Vieron la luna hoy?" } },
  messagesPerDay: { value: 54.2, record: { who: "bruno", when: "2023-10-08", text: "120 mensajes", msgs: 120 } },
  funniest: [
    { who: "ana", when: "2023-10-08T00:33:38", text: "Gol en contra", laughs: 11, people: 3 },
    { who: "tomi", when: "2023-11-01T12:00:00", text: "Qué <b>decís</b>", laughs: 7, people: 2 },
  ],
  mostReplied: [
    { who: "bruno", when: "2023-10-08T00:34:27", text: "Cambio de planes, gente", replies: 81, people: 3 },
  ],
  media: {
    audio: { total: 33, byPerson: [{ slug: "ana", n: 20 }, { slug: "bruno", n: 10 }], recordDay: { who: "ana", date: "2023-10-11", n: 6 } },
    image: { total: 43, byPerson: [{ slug: "bruno", n: 20 }, { slug: "tomi", n: 15 }], recordDay: { who: "tomi", date: "2023-10-06", n: 5 } },
  },
  poll: {
    question: "¿Quién llega tarde?",
    options: [
      { label: "Tomi", votes: 2 },
      { label: "Ana", votes: 4 },
      { label: "Bruno", votes: 1 },
      { label: "Nadie", votes: 0 },
    ],
    who: "bruno",
    when: "2023-10-21T21:14:48",
    totalVotes: 7,
  },
  latestNight: { value: 0.013, record: { who: "ana", when: "2023-10-14T05:59:05", text: "Sigo despierto" } },
};

const loreWords = ["fluncho", "tirulo", "garbanzete", "brumpi", "zapallete", "trompiza", "melonga", "piñuflo", "bartolete", "cascarrín"];
const lore: LoreTerm[] = loreWords.map((w, i) => ({
  w,
  n: 100 - i * 7,
  people: 3,
  days: 20 - i,
  firstUse: `2023-${String(9 + (i % 3)).padStart(2, "0")}-${String(1 + i).padStart(2, "0")}`,
  coinedBy: i === 9 ? "pepe" : ["bruno", "tomi", "ana"][i % 3],
  refersTo: i % 2 === 0 ? ["tomi", "ana", "bruno"][i % 3] : null,
}));

const departures: DeparturesData = {
  person: { slug: "bruno", name: "Bruno" },
  reentries: 12,
  byMonth: [{ month: "2023-09", n: 2 }, { month: "2023-10", n: 7 }, { month: "2023-11", n: 3 }],
  medianOutHours: 3.2,
  under10Min: 4,
  over1Day: 1,
  maxDays: 4.1,
  addedBy: [{ slug: "tomi", n: 7 }, { slug: "ana", n: 5 }],
  scenes: { days: 6, withExit: 3, byYear: { "2023": 6 } },
  complaints: [{ text: "nadie me avisa", n: 5 }, { text: "me sacaron", n: 2 }],
  complaintLabel: 'veces escribió "No me invitó"',
  complaintCount: 11,
  quotesRepeated: [{ text: "Los domingos no se negocian", when: "2023-10-03T21:50:26", times: 8, people: 3 }],
  quotesAttributed: [{ text: "es capaz", by: "ana", when: "2023-10-02T12:28:38" }],
};

const facts: Facts = {
  departerOvertakeMonth: "2023-09",
  departerMonthsToTop: 0,
  peakDow: "viernes",
  peakHour: 11,
  departerPeakMonths: [{ month: "2023-10", n: 7 }],
  totalMsgs: 1000,
  daysActive: 80,
  awardsCount: 12,
  topMuletilla: { slug: "tomi", phrase: "mirá vos", own: 40, others: 2 },
  mostMentioned: { slug: "bruno", n: 70 },
  fastest: { slug: "tomi", medianFromSec: 13 },
  startersTop: { slug: "tomi", n: 30 },
  killersTop: { slug: "ana", n: 25 },
  thresholds: {
    profileMsgs: 5000,
    fastestMinReplies: 500,
    pollMinVotes: 5,
    signatureMinOwn: 20,
    quoteMinTimes: 3,
    funnyMinLaughs: 4,
    recordMinGroup: 500,
    properMinN: 30,
  },
};

const census: CensusData = {
  timeline: [
    { when: "2023-09-01T00:00:00", kind: "event", label: "Día uno", slug: null, href: "/eventos/#rail" },
    { when: "2023-09-01T12:31:09", kind: "join", label: "Tomi", slug: "tomi", href: "/p/tomi/" },
    { when: "2023-09-14T10:00:00", kind: "name", label: "El club", slug: null, href: null },
    { when: "2023-10-09T21:00:00", kind: "departures", label: "12 vueltas", slug: "bruno", href: "/salidas/" },
  ],
  names: {
    longest: { label: "El club", days: 61.5, seconds: 5313600, from: "2023-09-14T10:00:00", to: "2023-11-14T10:00:00" },
    shortest: { label: "Club de prueba", days: 0, seconds: 51, from: "2023-10-01T21:26:14", to: "2023-10-01T21:27:05" },
  },
  tenure: [
    { slug: "bruno", from: "2023-09-01", to: "2023-11-30", gaps: [{ from: "2023-09-06", to: "2023-10-09", days: 33 }] },
    { slug: "tomi", from: "2023-09-01", to: "2023-11-30", gaps: [] },
    { slug: "ana", from: "2023-09-02", to: "2023-11-30", gaps: [] },
  ],
  absence: { slug: "ana", from: "2023-09-10", to: "2023-09-30", days: 20 },
  byYear: {
    years: ["2023", "2024"],
    series: { bruno: [500, 0], tomi: [300, 10], ana: [150, 5] },
  },
  hourOfEach: [
    { slug: "bruno", hour: 16, share: 0.089 },
    { slug: "tomi", hour: 22, share: 0.1 },
    { slug: "ana", hour: 9, share: 0.07 },
  ],
  earlyBird: { slug: "ana", share: 0.032 },
  owl: { slug: "tomi", share: 0.071 },
};

/** `display` as written (with accents); `phrase` its normalized key, as the pipeline publishes it. */
const muletilla = (display: string, i: number): LanguageData["muletillas"][string][number] => ({
  phrase: display.normalize("NFD").replace(/\p{M}/gu, ""),
  display,
  own: 40 - i,
  others: 2 + i,
  perMilOwn: 1.3,
  perMilOthers: 0.1,
  ratio: 20 - i,
  firstMonth: "2023-10",
  example: { when: "2023-10-06T22:23:25", text: `Qué ${display}` },
});
const muletillaPhrases = ["mirá vos", "sin vueltas", "que lujo", "flor de lío", "mi dios", "ni ahí", "dale che", "posta", "re loco", "ya fue"];

const language: LanguageData = {
  muletillas: {
    bruno: muletillaPhrases.slice(0, 4).map(muletilla),
    tomi: muletillaPhrases.map(muletilla),
    ana: muletillaPhrases.slice(0, 3).map(muletilla),
    nico: [],
  },
  repeated: {
    bruno: [{ text: "Q lindo el quincho de Rulo", when: "2023-10-13T11:12:06", times: 11, people: 3, by: ["tomi", "bruno", "ana"] }],
    tomi: [],
    ana: [],
    nico: [],
  },
  laughed: {
    bruno: { when: "2023-10-08T00:33:38", text: "Gol en contra", laughs: 11, people: 3 },
    tomi: null,
    ana: { when: "2023-11-01T12:00:00", text: "Qué decís", laughs: 7, people: 2 },
    nico: null,
  },
  badwords: {
    byPerson: [{ slug: "bruno", n: 120, perMil: 24 }, { slug: "tomi", n: 30, perMil: 10 }],
    total: 150,
    record: { who: "bruno", when: "2023-10-20T14:15:24", text: "Mierda, perdí el bondi", distinct: 3 },
  },
  style: [
    { slug: "bruno", avgChars: 27.6, upperShare: 0.03, exclPerMil: 16, questPerMil: 7.2, editedPerMil: 5, deletedPerMil: 1.2 },
    { slug: "tomi", avgChars: 18.7, upperShare: 0.05, exclPerMil: 9.1, questPerMil: 9.4, editedPerMil: 2, deletedPerMil: 0.6 },
  ],
  laughs: {
    byPerson: [
      { slug: "bruno", mix: laughMix(50, 5, 3, 1, 0, 20), avgJa: 2.4 },
      { slug: "tomi", mix: laughMix(30, 0, 8, 0, 2, 10), avgJa: 1.9 },
    ],
    record: { who: "ana", when: "2023-11-02T22:10:37", text: "JAJAJAJAJAJAJAJAJAJAJA", length: 22 },
  },
  top: {
    muletilla: { ...muletilla("mirá vos", 0), slug: "tomi" },
    repeated: { text: "Q lindo el quincho de Rulo", when: "2023-10-13T11:12:06", times: 11, people: 3, by: ["tomi", "bruno", "ana"], slug: "bruno" },
  },
};

const media: MediaData = {
  kinds: {
    kinds: ["image", "sticker", "audio"],
    byPerson: [
      { slug: "bruno", counts: { text: 450, image: 20, sticker: 5, audio: 10 }, perMil: { text: 900, image: 40, sticker: 10, audio: 20 } },
      { slug: "tomi", counts: { text: 270, image: 15, sticker: 8, audio: 2 }, perMil: { text: 900, image: 50, sticker: 26.7, audio: 6.7 } },
    ],
  },
  audios: {
    byPerson: [{ slug: "ana", n: 20, perMil: 133.3 }, { slug: "bruno", n: 10, perMil: 20 }],
    byHour: Array.from({ length: 24 }, (_, h) => (h === 21 ? 12 : 1)),
    byYear: { years: ["2023", "2024"], n: [30, 3] },
  },
  links: {
    byPerson: [{ slug: "tomi", n: 9 }, { slug: "bruno", n: 4 }],
    domains: [{ domain: "youtube.com", n: 8 }, { domain: "instagram.com", n: 5 }],
    favorite: [{ slug: "tomi", domain: "youtube.com", n: 6 }, { slug: "bruno", domain: "instagram.com", n: 3 }],
  },
  deletedEdited: {
    byPerson: [
      { slug: "bruno", deleted: 5, edited: 12, deletedPerMil: 10, editedPerMil: 24 },
      { slug: "tomi", deleted: 2, edited: 4, deletedPerMil: 6.7, editedPerMil: 13 },
    ],
    recordDay: { date: "2023-10-15", n: 4 },
  },
};

const emojis: EmojisData = {
  top: [
    { e: "😂", n: 120, topUser: "tomi" },
    { e: "❌", n: 80, topUser: "bruno" },
    { e: "🤝", n: 3, topUser: null },
  ],
  signature: [{ slug: "bruno", e: "❌", own: 60, ratio: 17.3 }, { slug: "tomi", e: "😂", own: 90, ratio: 3.2 }],
  byYear: [{ year: "2023", top: [{ e: "😂", n: 120 }, { e: "❌", n: 80 }] }],
};

const pollSample = (question: string, who: string, votes: number[]): PollsData["mostVoted"][number] => ({
  question,
  options: votes.map((v, i) => ({ label: `Opción ${i + 1}`, votes: v })),
  who,
  when: "2023-10-21T21:14:48",
  totalVotes: votes.reduce((a, b) => a + b, 0),
});
const polls: PollsData = {
  byPerson: [{ slug: "bruno", n: 7 }, { slug: "tomi", n: 2 }],
  total: 9,
  mostVoted: [pollSample("¿Quién llega tarde?", "bruno", [4, 3, 1])],
  unanimous: [pollSample("¿Vamos?", "tomi", [6, 0])],
  divided: [pollSample("¿Dónde cenamos?", "resto", [3, 3, 2])],
};

const rhythm: RhythmData = {
  starters: [{ slug: "tomi", n: 30 }, { slug: "bruno", n: 12 }],
  killers: [{ slug: "ana", n: 25 }, { slug: "tomi", n: 9 }],
  latency: [
    { slug: "tomi", medianToSec: 40, medianFromSec: 13, n: 600 },
    { slug: "bruno", medianToSec: 55, medianFromSec: 30, n: 900 },
  ],
  fastest: {
    a: { who: "bruno", when: "2023-10-31T23:10:50", text: "Ya saliste para el bar?" },
    b: { who: "tomi", when: "2023-10-31T23:10:51", text: "Llego en cinco" },
    seconds: 1,
  },
  streaks: [
    {
      slug: "bruno",
      streak: { days: 21, from: "2023-10-01", to: "2023-10-21" },
      silence: { days: 6, from: "2023-11-02", to: "2023-11-08" },
    },
  ],
  rings: { dow: [10, 20, 30, 40, 50, 60, 70], month: Array.from({ length: 12 }, (_, i) => i * 10) },
};

const mentions: MentionsData = {
  slugs: ["bruno", "tomi", "ana"],
  matrix: [
    [0, 5, 3],
    [20, 0, 4],
    [8, 2, 0],
  ],
  mostMentioned: { slug: "bruno", n: 28 },
  topTagger: { slug: "tomi", n: 24 },
  perMil: [{ slug: "bruno", n: 28, perMil: 56 }, { slug: "tomi", n: 7, perMil: 26.9 }],
  samples: { "tomi>bruno": [{ when: "2023-10-13T10:58:43", text: "Che @Bruno, contestá" }] },
};

const award = (
  id: string,
  title: string,
  winner: Award["winner"],
): Award => ({
  id,
  title,
  criterion: `Criterio de ${title.toLowerCase()}.`,
  winner,
  runnersUp: winner ? [{ slug: "tomi", value: winner.value - 1 }, { slug: "ana", value: winner.value - 2 }] : [],
});
const awards: Award[] = [
  award("msgs", "Más mensajes", { slug: "bruno", value: 500, unit: "mensajes" }),
  award("stickers", "Más stickers", { slug: "tomi", value: 8, unit: "stickers" }),
  award("audios", "Más audios", { slug: "ana", value: 20, unit: "audios" }),
  award("badwords", "El más puteador", { slug: "bruno", value: 24, unit: "por mil" }),
  award("early", "El madrugador", { slug: "ana", value: 3.2, unit: "%" }),
  award("owl", "El búho", { slug: "tomi", value: 7.1, unit: "%" }),
  award("mentioned", "El más mencionado", { slug: "bruno", value: 28, unit: "menciones" }),
  award("fastest", "El más rápido", { slug: "tomi", value: 13, unit: "s" }),
  award("edited", "El más editado", { slug: "bruno", value: 24, unit: "por mil" }),
  award("deleted", "El que más borra", { slug: "bruno", value: 10, unit: "por mil" }),
  {
    ...award("muletilla", "La muletilla del año", { slug: "tomi", value: 20, unit: "x", text: "mirá vos" }),
    runnersUp: [{ slug: "ana", value: 19, text: "sin vueltas" }],
  },
  award("starters", "El que más arranca", null),
];

/** 22 distinct events (the 3 above plus 19 clones), for rail-limit tests. */
const events22: EventData[] = Array.from({ length: 22 }, (_, i) => {
  const base = events[i % events.length]!;
  return i < events.length ? base : { ...base, id: `${base.id}-${i}`, title: `${base.title} ${i}` };
});

/** What tests/fixtures/content/nicknames.json holds. */
const nicknames: Nicknames = { Ana: "La Capitana", Tomi: "Tomate", Lucas: "Rulo", Bruno: "El Brujo", Caro: "Carola" };

export const fx = {
  global, person, events, events22, records, lore, departures, facts,
  census, language, media, emojis, polls, rhythm, mentions, awards, nicknames,
};
