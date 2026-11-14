import { z } from "zod";

// Zod mirrors of the JSON written by scripts/build_web_data.py (web/data/*.json).
// Objects are strict: a field added or renamed upstream fails the build instead of
// silently reaching the UI.

const count = z.number().int().nonnegative();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/);
const yearMonth = z.string().regex(/^\d{4}-\d{2}$/);
const slug = z.string().min(1);

/** 7 rows (0 = Monday) by 24 hours. */
const heatmap = z.array(z.array(count).length(24)).length(7);
const slugCount = z.strictObject({ slug, n: count });

/** Every record metric: `{ value, record: { who, when, text } }`. */
export const recordSchema = z.strictObject({
  value: z.number(),
  record: z.strictObject({ who: slug, when: z.string(), text: z.string() }),
});

/** The busiest day: `text` is "1597 mensajes", `msgs` the same count as a number. */
export const dayRecordSchema = z.strictObject({
  value: z.number(),
  record: z.strictObject({ who: slug, when: z.string(), text: z.string(), msgs: count }),
});

export const personSchema = z.strictObject({
  slug,
  name: z.string().min(1),
  /** 0..11 into PALETTE; -1 means no own color (13th+ person and `resto`). */
  colorIndex: z.number().int().min(-1).max(11),
  msgs: count,
  text: count,
  audios: count,
  images: count,
  stickers: count,
  videos: count,
  polls: count,
  deleted: count,
  /** Android attachments the export does not tell apart by type (0 on iOS). */
  media: count,
  firstMessage: z.strictObject({ when: isoDateTime, text: z.string() }),
});

export const edgeSchema = z.strictObject({ a: slug, b: slug, w: z.number() });

export const globalSchema = z
  .strictObject({
    /** Report title (report.config.json); also the gate heading, the logo and every page title. */
    title: z.string().min(1),
    lang: z.enum(["es", "en"]),
    /** Which app wrote the export. */
    platform: z.enum(["ios", "android"]),
    /** "minute" when the export's timestamps carry no seconds (latencies are then per minute). */
    timeResolution: z.enum(["second", "minute"]),
    /** "single": one scrolling page; "full": one page per chapter (report.config.json). */
    mode: z.enum(["single", "full"]),
    /** Whether the site asks for the group's word before showing anything (report.config.json). */
    gate: z.boolean(),
    generatedAt: z.string(),
    period: z.strictObject({ from: isoDate, to: isoDate }),
    totals: z.strictObject({ msgs: count, daysActive: count, people: count }),
    /** Not strictly sorted: the aggregated `resto` entry is appended last. */
    people: z.array(personSchema).min(1),
    monthly: z.strictObject({
      months: z.array(yearMonth),
      series: z.record(slug, z.array(count)),
    }),
    heatmap,
    edges: z.array(edgeSchema),
    starters: z.record(slug, count),
    killers: z.record(slug, count),
  })
  .superRefine((g, ctx) => {
    for (const [s, values] of Object.entries(g.monthly.series)) {
      if (values.length !== g.monthly.months.length) {
        ctx.addIssue({
          code: "custom",
          path: ["monthly", "series", s],
          message: `expected ${g.monthly.months.length} months, got ${values.length}`,
        });
      }
    }
  });

const span = z.strictObject({ days: z.number(), from: isoDate, to: isoDate });

export const personDataSchema = z.strictObject({
  slug,
  name: z.string().min(1),
  msgs: count,
  /** Distinct days with at least one message from this person. */
  activeDays: count,
  rankByMonth: z.array(count),
  monthly: z.array(count),
  heatmap,
  repliesTo: z.array(slugCount),
  repliedBy: z.array(slugCount),
  signatureWords: z.array(z.strictObject({ w: z.string(), n: count, ratio: z.number() })),
  emojis: z.array(z.strictObject({ e: z.string(), n: count })),
  kinds: z.record(z.string(), count),
  records: z.strictObject({
    longest: recordSchema,
    busiestDay: z.strictObject({ date: isoDate, msgs: count }),
    streak: span,
    silence: span,
    lateNightShare: z.number().min(0).max(1),
  }),
});

export const eventSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(["evento", "saga"]),
  originDate: isoDate,
  originMsgs: count,
  laterDays: count,
  laterMentions: count,
  note: z.string(),
  sampleOrigin: z.array(z.string()),
  sampleLater: z.array(z.string()),
  topReferencers: z.array(slug),
  protagonists: z.array(slug),
});
export const eventsSchema = z.array(eventSchema);

export const quoteSchema = z.strictObject({
  who: slug,
  when: isoDateTime,
  text: z.string(),
  laughs: count.optional(),
  replies: count.optional(),
  people: count,
});

export const mediaStatSchema = z.strictObject({
  total: count,
  byPerson: z.array(slugCount),
  recordDay: z.strictObject({ who: slug, date: isoDate, n: count }),
});

export const pollSchema = z.strictObject({
  question: z.string(),
  options: z.array(z.strictObject({ label: z.string(), votes: count })),
  who: slug,
  when: isoDateTime,
  totalVotes: count,
});

export const recordsSchema = z.strictObject({
  messageLength: recordSchema,
  messagesPerDay: dayRecordSchema,
  funniest: z.array(quoteSchema),
  mostReplied: z.array(quoteSchema),
  media: z.record(z.string(), mediaStatSchema),
  /** null when the export has no polls. */
  poll: pollSchema.nullable(),
  /** null when nobody wrote late at night. */
  latestNight: recordSchema.nullable(),
});

export const loreTermSchema = z.strictObject({
  w: z.string().min(1),
  n: count,
  people: count,
  days: count,
  firstUse: isoDate,
  /** May be a slug without a profile (e.g. `pipo`): use colorForSlug, never assume a link. */
  coinedBy: slug,
  refersTo: slug.nullable(),
});
export const loreSchema = z.array(loreTermSchema);

/** Who left and came back (report.config.json `departer`); every other key is empty when there is none. */
export const departuresSchema = z.strictObject({
  person: z.strictObject({ slug, name: z.string().min(1) }).nullable(),
  reentries: count,
  byMonth: z.array(z.strictObject({ month: yearMonth, n: count })),
  medianOutHours: z.number().nonnegative(),
  under10Min: count,
  over1Day: count,
  maxDays: z.number().nonnegative(),
  addedBy: z.array(slugCount),
  scenes: z.strictObject({
    days: count,
    withExit: count,
    byYear: z.record(z.string().regex(/^\d{4}$/), count),
  }),
  complaints: z.array(z.strictObject({ text: z.string(), n: count })),
  /** The language's chip caption ("veces escribió "No me invitó"") and how many complaints match it. */
  complaintLabel: z.string(),
  complaintCount: count,
  quotesRepeated: z.array(
    z.strictObject({ text: z.string(), when: isoDateTime, times: count, people: count }),
  ),
  quotesAttributed: z.array(z.strictObject({ text: z.string(), by: slug, when: isoDateTime })),
});

// --- Chapter files: census, language, media, emojis, polls, rhythm, mentions, awards ---

const num = z.number();
const whoWhenText = z.strictObject({ who: slug, when: isoDateTime, text: z.string() });
const whenText = z.strictObject({ when: isoDateTime, text: z.string() });
const dateSpan = z.strictObject({ days: count, from: isoDate, to: isoDate });
const shareOf = z.number().min(0).max(1);

const nameSpan = z.strictObject({
  label: z.string(),
  /** Fractional days; 0 for a name that lasted under a day. */
  days: z.number().nonnegative(),
  seconds: count,
  from: isoDateTime,
  to: isoDateTime,
});

export const censusSchema = z
  .strictObject({
    timeline: z.array(
      z.strictObject({
        when: isoDateTime,
        kind: z.enum(["name", "photo", "join", "leave", "peak", "event", "departures"]),
        label: z.string(),
        slug: slug.nullable(),
        href: z.string().nullable(),
      }),
    ),
    /** Both null when the export has no group-name changes. */
    names: z.strictObject({ longest: nameSpan.nullable(), shortest: nameSpan.nullable() }),
    tenure: z.array(
      z.strictObject({
        slug,
        from: isoDate,
        to: isoDate,
        gaps: z.array(dateSpan),
      }),
    ),
    absence: z.strictObject({ slug, from: isoDate, to: isoDate, days: count }).nullable(),
    byYear: z.strictObject({
      years: z.array(z.string().regex(/^\d{4}$/)),
      series: z.record(slug, z.array(count)),
    }),
    hourOfEach: z.array(z.strictObject({ slug, hour: z.number().int().min(0).max(23), share: shareOf })),
    earlyBird: z.strictObject({ slug, share: shareOf }).nullable(),
    owl: z.strictObject({ slug, share: shareOf }).nullable(),
  })
  .superRefine((c, ctx) => {
    for (const [s, values] of Object.entries(c.byYear.series)) {
      if (values.length !== c.byYear.years.length) {
        ctx.addIssue({
          code: "custom",
          path: ["byYear", "series", s],
          message: `expected ${c.byYear.years.length} years, got ${values.length}`,
        });
      }
    }
  });

const muletillaFields = {
  /** Normalized key (lowercase, no accents): what is counted and matched. */
  phrase: z.string().min(1),
  /** How the person writes it most often: lowercase, with accents ("qué ilusión"). Shown in the UI. */
  display: z.string().min(1),
  own: count,
  others: count,
  perMilOwn: z.number().nonnegative(),
  perMilOthers: z.number().nonnegative(),
  ratio: z.number().nonnegative(),
  firstMonth: yearMonth,
  example: whenText,
};
const muletillaSchema = z.strictObject(muletillaFields);
const repeatedFields = {
  text: z.string(),
  when: isoDateTime,
  times: count,
  people: count,
  by: z.array(slug),
};
const repeatedSchema = z.strictObject(repeatedFields);

export const languageSchema = z.strictObject({
  /** Per person (profiled slugs only); a list may be empty. */
  muletillas: z.record(slug, z.array(muletillaSchema)),
  repeated: z.record(slug, z.array(repeatedSchema)),
  laughed: z.record(
    slug,
    z.strictObject({ when: isoDateTime, text: z.string(), laughs: count, people: count }).nullable(),
  ),
  badwords: z.strictObject({
    byPerson: z.array(z.strictObject({ slug, n: count, perMil: z.number().nonnegative() })),
    total: count,
    record: z
      .strictObject({ who: slug, when: isoDateTime, text: z.string(), distinct: count })
      .nullable(),
  }),
  style: z.array(
    z.strictObject({
      slug,
      avgChars: z.number().nonnegative(),
      upperShare: z.number().nonnegative(),
      exclPerMil: z.number().nonnegative(),
      questPerMil: z.number().nonnegative(),
      editedPerMil: z.number().nonnegative(),
      deletedPerMil: z.number().nonnegative(),
    }),
  ),
  laughs: z.strictObject({
    byPerson: z.array(
      z.strictObject({
        slug,
        /** The language's laugh classes in its own order (es: jaja, jsjs, jeje, jiji, xd, emoji); `label` is what is drawn. */
        mix: z.array(z.strictObject({ key: z.string().min(1), label: z.string().min(1), n: count })).min(1),
        avgJa: z.number().nonnegative(),
      }),
    ),
    record: z.strictObject({ who: slug, when: isoDateTime, text: z.string(), length: count }).nullable(),
  }),
  top: z.strictObject({
    muletilla: z.strictObject({ ...muletillaFields, slug }).nullable(),
    repeated: z.strictObject({ ...repeatedFields, slug }).nullable(),
  }),
});

const perPersonN = z.strictObject({ slug, n: count, perMil: z.number().nonnegative() });

export const mediaSchema = z.strictObject({
  kinds: z.strictObject({
    kinds: z.array(z.string().min(1)),
    byPerson: z.array(
      z.strictObject({
        slug,
        counts: z.record(z.string(), count),
        perMil: z.record(z.string(), z.number().nonnegative()),
      }),
    ),
  }),
  audios: z.strictObject({
    byPerson: z.array(perPersonN),
    byHour: z.array(count).length(24),
    byYear: z.strictObject({ years: z.array(z.string().regex(/^\d{4}$/)), n: z.array(count) }),
  }),
  links: z.strictObject({
    byPerson: z.array(slugCount),
    domains: z.array(z.strictObject({ domain: z.string().min(1), n: count })),
    favorite: z.array(z.strictObject({ slug, domain: z.string().min(1), n: count })),
  }),
  deletedEdited: z.strictObject({
    byPerson: z.array(
      z.strictObject({
        slug,
        deleted: count,
        edited: count,
        deletedPerMil: z.number().nonnegative(),
        editedPerMil: z.number().nonnegative(),
      }),
    ),
    recordDay: z.strictObject({ date: isoDate, n: count }).nullable(),
  }),
});

export const emojisSchema = z.strictObject({
  top: z.array(z.strictObject({ e: z.string().min(1), n: count, topUser: slug.nullable() })),
  signature: z.array(
    z.strictObject({ slug, e: z.string().min(1), own: count, ratio: z.number().nonnegative() }),
  ),
  byYear: z.array(
    z.strictObject({
      year: z.string().regex(/^\d{4}$/),
      top: z.array(z.strictObject({ e: z.string().min(1), n: count })),
    }),
  ),
});

export const pollsSchema = z.strictObject({
  byPerson: z.array(slugCount),
  total: count,
  mostVoted: z.array(pollSchema),
  unanimous: z.array(pollSchema),
  divided: z.array(pollSchema),
});

export const rhythmSchema = z.strictObject({
  starters: z.array(slugCount),
  killers: z.array(slugCount),
  latency: z.array(z.strictObject({ slug, medianToSec: num.nonnegative(), medianFromSec: num.nonnegative(), n: count })),
  /** The closest reply pair; null when there is none. */
  fastest: z.strictObject({ a: whoWhenText, b: whoWhenText, seconds: num.nonnegative() }).nullable(),
  streaks: z.array(z.strictObject({ slug, streak: dateSpan, silence: dateSpan })),
  rings: z.strictObject({
    dow: z.array(count).length(7),
    month: z.array(count).length(12),
  }),
});

export const mentionsSchema = z
  .strictObject({
    slugs: z.array(slug),
    /** matrix[i][j] = mentions from slugs[i] to slugs[j]. */
    matrix: z.array(z.array(count)),
    mostMentioned: slugCount.nullable(),
    topTagger: slugCount.nullable(),
    perMil: z.array(perPersonN),
    /** Keyed "from>to". */
    samples: z.record(z.string().regex(/^[^>]+>[^>]+$/), z.array(whenText)),
  })
  .superRefine((m, ctx) => {
    const size = m.slugs.length;
    if (m.matrix.length !== size) {
      ctx.addIssue({ code: "custom", path: ["matrix"], message: `expected ${size} rows, got ${m.matrix.length}` });
    }
    m.matrix.forEach((row, i) => {
      if (row.length !== size) {
        ctx.addIssue({ code: "custom", path: ["matrix", i], message: `expected ${size} columns, got ${row.length}` });
      }
    });
  });

export const AWARD_IDS = [
  "msgs",
  "stickers",
  "audios",
  "badwords",
  "early",
  "owl",
  "mentioned",
  "fastest",
  "edited",
  "deleted",
  "muletilla",
  "starters",
] as const;

export const awardSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  criterion: z.string().min(1),
  /** null when nobody qualifies. `text` carries the phrase for the muletilla award. */
  winner: z
    .strictObject({ slug, value: num, unit: z.string(), text: z.string().optional() })
    .nullable(),
  runnersUp: z.array(z.strictObject({ slug, value: num, text: z.string().optional() })),
});

/** Awards a chat may leave out: "fastest" is not given at minute resolution (Android exports carry no seconds). */
export const OPTIONAL_AWARD_IDS: readonly (typeof AWARD_IDS)[number][] = ["fastest"];

export const awardsSchema = z.array(awardSchema).superRefine((awards, ctx) => {
  const ids = awards.map((a) => a.id);
  const expected = AWARD_IDS.filter((id) => ids.includes(id) || !OPTIONAL_AWARD_IDS.includes(id));
  if (ids.length !== expected.length || expected.some((id, i) => ids[i] !== id)) {
    ctx.addIssue({
      code: "custom",
      message: `expected award ids ${expected.join(", ")} in order, got ${ids.join(", ")}`,
    });
  }
});

export const factsSchema = z.strictObject({
  /** All three null/empty when the report has no departer. */
  departerOvertakeMonth: yearMonth.nullable(),
  /** 0 = the departer led from the first month; null = never took the lead. */
  departerMonthsToTop: count.nullable(),
  peakDow: z.string(),
  peakHour: z.number().int().min(0).max(23),
  departerPeakMonths: z.array(z.strictObject({ month: yearMonth, n: count })),
  totalMsgs: count,
  daysActive: count,
  awardsCount: count,
  /** Language top muletilla (language.json top.muletilla); null without muletillas. */
  topMuletilla: z.strictObject({ slug, phrase: z.string().min(1), own: count, others: count }).nullable(),
  mostMentioned: slugCount.nullable(),
  /** Lowest median reply time among people with >= th.fastest_min_replies replies (facts.thresholds.fastestMinReplies; the "fastest" award rule). */
  fastest: z.strictObject({ slug, medianFromSec: z.number().positive() }).nullable(),
  startersTop: slugCount.nullable(),
  killersTop: slugCount.nullable(),
  /**
   * The minimums the pipeline actually applied (scripts/web/thresholds.py), so the copy cites the real numbers;
   * profileMsgs is what a person needed for a profile: max(message floor, active share of the chat).
   */
  thresholds: z.strictObject({
    profileMsgs: count,
    fastestMinReplies: count,
    pollMinVotes: count,
    signatureMinOwn: count,
    quoteMinTimes: count,
    funnyMinLaughs: count,
    recordMinGroup: count,
    properMinN: count,
  }),
});

export type Record = z.infer<typeof recordSchema>;
export type DayRecord = z.infer<typeof dayRecordSchema>;
export type Person = z.infer<typeof personSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type GlobalData = z.infer<typeof globalSchema>;
export type PersonData = z.infer<typeof personDataSchema>;
export type EventData = z.infer<typeof eventSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type MediaStat = z.infer<typeof mediaStatSchema>;
export type Poll = z.infer<typeof pollSchema>;
export type RecordsData = z.infer<typeof recordsSchema>;
export type LoreTerm = z.infer<typeof loreTermSchema>;
export type DeparturesData = z.infer<typeof departuresSchema>;
export type Facts = z.infer<typeof factsSchema>;
export type CensusData = z.infer<typeof censusSchema>;
export type LanguageData = z.infer<typeof languageSchema>;
export type MediaData = z.infer<typeof mediaSchema>;
export type EmojisData = z.infer<typeof emojisSchema>;
export type PollsData = z.infer<typeof pollsSchema>;
export type RhythmData = z.infer<typeof rhythmSchema>;
export type MentionsData = z.infer<typeof mentionsSchema>;
export type Award = z.infer<typeof awardSchema>;
export type AwardsData = z.infer<typeof awardsSchema>;
