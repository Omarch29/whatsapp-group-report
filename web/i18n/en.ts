import { formatsFor, type LocaleFormat } from "./formats";
import type { Copy } from "./index";

/** Numbers and dates in English (United States). */
const format: LocaleFormat = {
  locale: "en-US",
  dateOrder: "mdy",
  months: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  monthYear: (name, year) => `${name} ${year}`,
  percent: (n) => `${n}%`,
};
// Pure: a bundle built in the other language drops this file entirely (content/copy.ts).
const { fmt, fmtMonth, fmtSeconds, fmtShare } = /* @__PURE__ */ formatsFor(format);

/** "1 message", "12 messages". */
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;

type Span = { days: number; seconds: number };

/** A span in its natural unit: whole days from one day up, else hours, minutes or seconds. */
function duration(days: number, seconds: number): { n: number; unit: string } {
  const pick = (n: number, one: string, many: string) => ({ n, unit: n === 1 ? one : many });
  if (days >= 1) return pick(Math.floor(days), "day", "days");
  if (seconds >= 3600) return pick(Math.floor(seconds / 3600), "hour", "hours");
  if (seconds >= 60) return pick(Math.floor(seconds / 60), "minute", "minutes");
  return pick(seconds, "second", "seconds");
}

/** "1 time", "412 times". */
const times = (n: number) => `${fmt(n)} ${n === 1 ? "time" : "times"}`;

/** "1 day", "12 days". */
const days = (n: number) => `${fmt(n)} ${n === 1 ? "day" : "days"}`;

/** "1 person", "3 people". */
const people = (n: number) => `${fmt(n)} ${n === 1 ? "person" : "people"}`;

/** "11 laughs from 3 people". */
const copyLaughs = (laughs: number, n: number) => `${fmt(laughs)} ${laughs === 1 ? "laugh" : "laughs"} from ${people(n)}`;

/** "1 vote", "34 votes". */
const votes = (n: number) => `${fmt(n)} ${n === 1 ? "vote" : "votes"}`;

// The English copy: the same keys and function arities as es.ts (i18n/copy.test.ts).
export const en = {
  verifiedOn: "2026-11-09",
  /** Someone's own words, quoted: “like this”. */
  quote: (s: string) => `“${s}”`,
  locale: format.locale,
  /** `<html lang>`. */
  htmlLang: "en",
  dateOrder: format.dateOrder,
  months: [...format.months],
  monthYear: format.monthYear,
  percent: format.percent,
  monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  /** Weekday names, 0 = Monday (the data's `rings.dow` order). */
  dow: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  dowShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  /** "on Fridays". */
  dowPlural: ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"],
  chapters: [
    { id: "censo", slug: "census", title: "Census", blocks: [
      { id: "timeline", title: "Timeline" },
      { id: "tenure", title: "Tenure" },
      { id: "by-year", title: "By year" },
      { id: "hour-of-each", title: "Everyone's hour" },
    ] },
    { id: "carrera", slug: "race", title: "The race", blocks: [{ id: "race", title: "The race" }] },
    { id: "horas", slug: "hours", title: "Hours", blocks: [{ id: "heatmap", title: "Heatmap" }] },
    { id: "parejas", slug: "pairs", title: "Pairs", blocks: [{ id: "graph", title: "Pair graph" }] },
    { id: "lenguaje", slug: "language", title: "Language", blocks: [
      { id: "muletillas", title: "Catchphrases" },
      { id: "repeated", title: "Lines others repeated" },
      { id: "laughed", title: "The ones that got laughs" },
      { id: "badwords", title: "Swear words" },
      { id: "style", title: "How everyone writes" },
      { id: "laughs", title: "Everyone's laugh" },
    ] },
    { id: "multimedia", slug: "media", title: "Media", blocks: [
      { id: "kinds", title: "Message types" },
      { id: "media-records", title: "Media records" },
      { id: "audios", title: "Voice notes" },
      { id: "links", title: "Links" },
      { id: "deleted-edited", title: "Deleted and edited" },
    ] },
    { id: "emojis", slug: "emojis", title: "Emojis", blocks: [
      { id: "top", title: "The most used" },
      { id: "signature", title: "Everyone's emoji" },
      { id: "by-year", title: "By year" },
    ] },
    { id: "encuestas", slug: "polls", title: "Polls", blocks: [
      { id: "by-person", title: "Who makes them" },
      { id: "top", title: "The most voted" },
    ] },
    { id: "ritmo", slug: "rhythm", title: "Rhythm", blocks: [
      { id: "starters-killers", title: "Who starts the chat and who kills it" },
      { id: "latency", title: "How fast they reply" },
      { id: "streaks", title: "Streaks" },
      { id: "rings", title: "Rings" },
    ] },
    { id: "menciones", slug: "mentions", title: "Mentions", blocks: [
      { id: "matrix", title: "Mention matrix" },
      { id: "records", title: "Records" },
      { id: "per-mil", title: "Per thousand messages" },
    ] },
    { id: "salidas", slug: "departures", title: "The departures", blocks: [{ id: "door", title: "The door" }, { id: "quotes", title: "Quotes" }] },
    { id: "eventos", slug: "events", title: "Events", blocks: [{ id: "rail", title: "Event timeline" }] },
    { id: "records", slug: "records", title: "Records", blocks: [
      { id: "length", title: "Longest message" },
      { id: "per-day", title: "Busiest day" },
      { id: "poll", title: "Record poll" },
      { id: "night", title: "Small hours" },
      { id: "quotes", title: "Quotes" },
    ] },
    { id: "diccionario", slug: "dictionary", title: "Dictionary", blocks: [{ id: "cloud", title: "Word cloud" }] },
    { id: "premios", slug: "awards", title: "Awards", blocks: [{ id: "awards", title: "Awards" }] },
    { id: "personas", slug: "people", title: "People", blocks: [{ id: "index", title: "Everyone, one by one" }] },
    { id: "conclusion", slug: "conclusion", title: "Conclusion", blocks: [{ id: "text", title: "Conclusion" }] },
  ],
  /** Any block (or person) with nothing to draw. */
  empty: "Nothing to show yet.",
  gate: {
    placeholder: "The group's word",
    submit: "Come in",
    error: "Nope, not that one.",
    unverifiable: "Couldn't check it.",
  },
  nav: {
    chapters: "Chapters",
    open: "Open chapters",
    close: "Close",
    counter: (n: number, total: number) => `Chapter ${fmt(n)} of ${fmt(total)}`,
    prev: "Previous",
    next: "Next",
    back: "Back to the start",
    pager: "Other chapters",
    /** Placeholder title without a report provider (ReportContext's default, unit tests). */
    report: "Report",
    profile: "This profile",
  },
  /** The single-page mode's floating index; its items are the chapters' block titles. */
  single: {
    index: "Contents",
    open: "Open contents",
    close: "Close",
  },
  block: {
    copy: "Copy link",
    copied: "Link copied",
    failed: "Couldn't copy it",
  },
  hero: {
    bubbles: ["They talked.", "We counted.", "All of it."],
    lede: (totalMsgs: number, daysActive: number) => `${plural(totalMsgs, "message", "messages")} over ${days(daysActive)}.`,
  },
  intro: {
    /** The introduction's chapter title (slug "", href "/") and its one block. */
    title: "Introduction",
    start: "Let's go",
  },
  census: {
    timelineLede: (nameChanges: number, photos: number) =>
      `The group changed its name ${times(nameChanges)} and its photo ${times(photos)}.`,
    /**
     * Both spans as `{ days, seconds }`; under a day the unit drops to hours, minutes or seconds.
     * `current`: the longest name is still the group's name at the end of the export ("has lasted").
     */
    namesLede: (longest: Span, shortest: Span, current = false) => {
      const a = duration(longest.days, longest.seconds);
      const s = duration(shortest.days, shortest.seconds);
      return `The longest-running name ${current ? "has lasted" : "lasted"} ${fmt(a.n)} ${a.unit}; the shortest, ${fmt(s.n)} ${s.unit}.`;
    },
    duration: (days: number, seconds: number) => duration(days, seconds),
    timelineCriterion:
      "Name and photo changes, people joining and leaving, the busiest days and the events, by date. Someone who keeps leaving and coming back gets a single milestone.",
    timelineLabel: "The group's timeline",
    timelineList: "The group's milestones",
    timelineHint: "Swipe to scroll through it.",
    overviewLabel: "Timeline overview",
    yearsLabel: "Jump to a year",
    timelineBack: "Earlier",
    timelineForward: "Later",
    kinds: {
      name: "New name",
      photo: "Photo",
      join: "Joins",
      leave: "Leaves",
      peak: "Record day",
      event: "Event",
      departures: "The departures",
    },
    longestName: "The longest-running name",
    shortestName: "The shortest",
    /** "from 8/7/2025 to 11/9/2026"; dates already formatted. */
    nameSpan: (from: string, to: string) => `from ${from} to ${to}`,
    tenureLede: (absenceName: string, n: number) =>
      `${absenceName} went ${days(n)} without writing: the longest absence in the group.`,
    tenureLedeEmpty: "From everyone's first message to their last.",
    tenureCriterion: (minGapDays: number) =>
      `One bar per person, from their first message to their last. The striped parts are more than ${fmt(minGapDays)} days in a row without writing.`,
    tenureLabel: "Who's been here since when",
    /** Bar tooltip: "Tomi: 9/1/2023 → 11/9/2026"; dates already formatted. */
    tenureSpan: (name: string, from: string, to: string) => `${name}: ${from} → ${to}`,
    tenureGap: (from: string, to: string, n: number) => `Silent: ${from} → ${to} (${days(n)})`,
    /** Read by screen readers after the bar's span: "silent from 1/15/2026 to 2/20/2026, 36 days". */
    tenureGapSpoken: (from: string, to: string, n: number) => `silent from ${from} to ${to}, ${days(n)}`,
    absence: { label: "The longest absence", unit: (n: number): string => (n === 1 ? "day" : "days"), caption: (to: string) => `until ${to}` },
    byYearLede: (topYear: string, msgs: number) => `${topYear} was the year with the most messages: ${fmt(msgs)}.`,
    byYearCriterion: (lastYear: string, to: string) =>
      `Messages per year from each person with a profile; ${lastYear} runs until ${to}. Per thousand: how much of each person's messages fell in that year.`,
    byYearLabel: "Messages per year",
    legendLabel: "Who's who",
    topPersonYear: { label: "One person's year", unit: (n: number): string => (n === 1 ? "message" : "messages"), when: (year: string) => `in ${year}` },
    total: "Total",
    perMil: "Per thousand",
    modeLabel: "Measure",
    /** Segment tooltip: "Bruno · 2023: 500". */
    yearSeg: (name: string, year: string, value: string) => `${name} · ${year}: ${value}`,
    hourLede: (earlyName: string, earlyShare: number, owlName: string, owlShare: number) =>
      `${earlyName} is the earliest bird, with ${fmtShare(earlyShare)} of their messages; ${owlName} is the biggest night owl, with ${fmtShare(owlShare)}.`,
    hourLedeEmpty: "The time of day each person writes the most.",
    hourCriterion: (earlyFrom: number, earlyTo: number, owlFrom: number, owlTo: number) =>
      `Each person's busiest hour on a 24-hour clock; the ring is the share of their messages in that hour. Early bird: ${earlyFrom}:00 to ${earlyTo}:00; night owl: ${owlFrom}:00 to ${owlTo}:00.`,
    hourLabel: "Everyone's hour",
    /** "Tomi · 23:00". */
    clock: (name: string, hour: number) => `${name} · ${hour}:00`,
    earlyBird: { label: "The earliest bird", caption: "of their messages, early in the morning" },
    owl: { label: "The biggest night owl", caption: "of their messages, in the small hours" },
  },
  language: {
    chips: "Pick someone",
    // Catchphrases
    /** `ratio` is own per mil / rest per mil (floored), rounded: a safe lower bound. */
    muletillasLede: (name: string, phrase: string, own: number, ratio: number) =>
      `${name} said “${phrase}” ${times(own)}: ${times(Math.round(ratio))} more often than the rest of the group.`,
    muletillasLedeEmpty: (name: string) => `None of ${name}'s phrases make the catchphrase cut.`,
    muletillasCriterion:
      "Phrases of 2 to 5 words that someone says at least 4 times more often, per thousand messages, than everyone else.",
    threadLabel: (name: string) => `${name}'s catchphrases`,
    typing: "typing…",
    muletillaMeta: (own: number, others: number) => `${times(own)} · everyone else ${fmt(others)}`,
    since: (month: string) => `since ${fmtMonth(month)}`,
    exampleHint: "Tap a phrase to see a real message.",
    all: "Everyone",
    allLabel: "Everyone's number one catchphrase",
    times: (n: number) => times(n),
    topMuletilla: { label: "The group's most personal catchphrase", unit: (n: number): string => (n === 1 ? "time" : "times") },
    // Repeated
    repeatedLede: (name: string, text: string, n: number, by: number) =>
      `“${text}”, by ${name}, got repeated by ${people(by)}, ${times(n)}.`,
    repeatedLedeEmpty: "Lines someone wrote that others repeated later, word for word.",
    repeatedCriterion: (minTimes: number) =>
      `Lines of 5 words or more that other people wrote later, word for word, at least ${times(minTimes)}.`,
    repeatedLabel: (name: string) => `${name}'s lines that others repeated`,
    repeatedBy: "Repeated by",
    repeatedMeta: (n: number, by: number) => `× ${fmt(n)} · ${people(by)}`,
    topRepeated: { label: "The group's most repeated line", unit: (n: number): string => (n === 1 ? "time" : "times") },
    // Laughed
    laughedLede: (name: string, laughs: number, by: number) =>
      `${name}'s funniest message got ${copyLaughs(laughs, by)}.`,
    laughedLedeEmpty: "Each person's message that got the most laughs.",
    laughedCriterion: (minLaughs: number) =>
      `The message followed by the most laughs from others within 3 minutes; it counts from ${fmt(minLaughs)} ${minLaughs === 1 ? "laugh" : "laughs"}.`,
    laughsLabel: (laughs: number, by: number) => copyLaughs(laughs, by),
    topLaughed: { label: "The one that got the most laughs", unit: (n: number): string => (n === 1 ? "laugh" : "laughs") },
    // Swear words
    badwordsLede: (name: string, total: number, perMil: number) =>
      `The group wrote ${plural(total, "swear word", "swear words")}; ${name} leads with ${fmt(perMil)} per thousand messages.`,
    badwordsLedeEmpty: "Swear words per person, in total and per thousand messages.",
    badwordsCriterion: "The group's list of swear words; per thousand = per thousand of that person's messages.",
    badwordsLabel: "Swear words per person",
    badwordsRecord: { label: "The sweariest message", unit: (n: number): string => (n === 1 ? "different one in one message" : "different ones in one message") },
    // Style
    styleLede: (name: string, avgChars: number) =>
      `${name} writes the longest messages: ${fmt(avgChars)} characters on average.`,
    styleCriterion: "Averages over text messages; edited and deleted per thousand messages.",
    styleLabel: "Character cards",
    styleMetrics: {
      avgChars: "Characters per message",
      upperShare: "In caps",
      exclPerMil: "Exclamations",
      questPerMil: "Questions",
      editedPerMil: "Edited",
      deletedPerMil: "Deleted",
    },
    styleTop: "the group's highest",
    /** The card's trait: the first metric where the person tops the group. */
    styleTraits: {
      avgChars: "Writes longer than anyone",
      upperShare: "Shouts more than anyone",
      exclPerMil: "Exclaims more than anyone",
      questPerMil: "Asks more than anyone",
      editedPerMil: "Edits more than anyone",
      deletedPerMil: "Deletes more than anyone",
    },
    styleRecord: { label: "The longest message", unit: (n: number): string => (n === 1 ? "character" : "characters") },
    // Laughs
    laughsLede: (name: string, avgJa: number) =>
      `${name} stretches the laugh the most: ${fmt(avgJa)} “ha” per haha, on average.`,
    laughsLedeEmpty: "How everyone writes their laugh.",
    laughsCriterion: "How everyone writes their laugh; haha ×n is the average length.",
    laughsRowsLabel: "Everyone's laugh",
    laughsLegend: "Kinds of laugh",
    avgJa: (n: number) => `haha ×${fmt(n)}`,
    /** Segment tooltip: "lol: 5 (6.3%)"; the share is already formatted. */
    laughSeg: (label: string, n: number, share: string) => `${label}: ${fmt(n)} (${share})`,
    // Same word at one and many; the parameter keeps es.ts's arity (i18n/copy.test.ts compares shapes).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    laughsRecord: { label: "The longest haha", unit: (_n: number): string => "ha in a row" },
  },
  media: {
    /** English names of the parquet kinds, plural (the chart's legend and the ledes). */
    kindLabels: {
      text: "text",
      image: "photos",
      sticker: "stickers",
      audio: "voice notes",
      poll: "polls",
      video: "videos",
      deleted: "deleted",
      media: "media",
      gif: "GIFs",
      location: "locations",
      call: "calls",
      document: "documents",
      contact: "contacts",
      video_note: "video notes",
      other: "other",
    } as Record<string, string>,
    // Kinds
    kindsLede: (kind: string, n: number) => `After text, the group sends ${kind} the most: ${fmt(n)}.`,
    /** `others` lists the folded kinds, already joined. */
    kindsCriterion: (others: string) =>
      `Messages from each person with a profile by type, not counting text; per thousand = per thousand of that person's messages.${others ? ` Other: ${others}.` : ""}`,
    kindsLabel: "What everyone sends",
    kindsLegend: "Message types",
    /** Segment tooltip and legend count: "photos: 2,061"; the value is already formatted. */
    kindSeg: (label: string, value: string) => `${label}: ${value}`,
    stickerDay: { label: "The stickeriest day", unit: (n: number): string => (n === 1 ? "sticker" : "stickers"), caption: "in a single day" },
    // Records
    recordsLede: (parts: readonly { name: string; n: number; unit: string }[]) =>
      `${parts.map((p, i) => (i === 0 ? `${p.name} sent ${fmt(p.n)} ${p.unit}` : `${p.name}, ${fmt(p.n)} ${p.unit}`)).join("; ")}.`,
    recordsCriterion:
      "Each type's total per person with a profile; the one-day record is the day with the most of that type across the whole group.",
    records: {
      sticker: { label: "The sticker champ", unit: (n: number): string => (n === 1 ? "sticker" : "stickers") },
      audio: { label: "The voice note champ", unit: (n: number): string => (n === 1 ? "voice note" : "voice notes") },
      image: { label: "The photographer", unit: (n: number): string => (n === 1 ? "photo" : "photos") },
    } as Record<string, { label: string; unit: (n: number) => string }>,
    inTotal: "in total",
    /** "one-day record: 39, Tomi on 04/09/2026"; the date is already formatted. */
    peakDay: (name: string, n: number, date: string) => `one-day record: ${fmt(n)}, ${name} on ${date}`,
    // Voice notes
    audiosLede: (name: string, n: number, hour: number) =>
      `${name} sent ${plural(n, "voice note", "voice notes")}, more than anyone; the group sends the most voice notes at ${hour}:00.`,
    audiosCriterion: "Voice notes per person with a profile; by hour of the day and by year, for the whole group.",
    audiosByPerson: "Voice notes per person",
    audiosByHour: "Voice notes by hour of the day",
    audiosByYear: "Voice notes per year",
    /** "21:00: 760". */
    hourBar: (hour: number, n: number) => `${hour}:00: ${fmt(n)}`,
    /** Bar tooltip: "Ana: 47.2 per thousand messages". */
    perMilTitle: (name: string, perMil: number) => `${name}: ${fmt(perMil)} per thousand messages`,
    audioDay: { label: "The day with the most voice notes", unit: (n: number): string => (n === 1 ? "voice note" : "voice notes"), caption: "in a single day" },
    // Links
    linksLede: (name: string, n: number, domain: string, domainN: number) =>
      `${name} shared ${plural(n, "link", "links")}, more than anyone; the most shared site is ${domain}, with ${fmt(domainN)}.`,
    linksCriterion:
      "Links in messages, one per URL, by domain without “www.” (x.com counts as twitter.com). Everyone's favorite is the domain they shared the most.",
    domainsLabel: "Most shared domains",
    linksByPerson: "Links per person",
    favoriteLabel: "Everyone's favorite domain",
    topSharer: { label: "The one who sends the most links", unit: (n: number): string => (n === 1 ? "link" : "links") },
    /** "their favorite: instagram.com (1,264)". */
    favoriteCaption: (domain: string, n: number) => `their favorite: ${domain} (${fmt(n)})`,
    // Deleted and edited
    deletedLede: (delName: string, delPerMil: number, editName: string, editPerMil: number) =>
      `${delName} deletes the most: ${fmt(delPerMil)} per thousand messages; ${editName} edits the most: ${fmt(editPerMil)} per thousand.`,
    deletedCriterion:
      "Deleted (“This message was deleted”) and edited messages from each person with a profile; per thousand = per thousand of that person's messages.",
    deletedLabel: "Deleted and edited per person",
    deletedLegend: "Deleted and edited",
    deleted: "deleted",
    edited: "edited",
    deletedBubble: "This message was deleted",
    /** Bar tooltip: "Bruno · deleted: 445"; the value is already formatted. */
    seriesTitle: (name: string, series: string, value: string) => `${name} · ${series}: ${value}`,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    deletedDay: { label: "The day with the most deletions", unit: (_n: number): string => "deleted", caption: "across the whole group" },
  },
  emojis: {
    // Top
    topLede: (e: string, n: number) => `${e} is the group's emoji: ${times(n)}.`,
    topCriterion: "The top 30 emojis, every appearance counts. Tap one to see who uses it the most.",
    cloudLabel: "The group's emojis",
    /** "537 times · used most by: Bruno". */
    detail: (n: number, name: string | null) => (name ? `${times(n)} · used most by: ${name}` : times(n)),
    /** `who` follows the top user's name; `everyone` stands alone when nobody with a profile tops it. */
    topRecord: { label: "The most used emoji", unit: (n: number): string => (n === 1 ? "time" : "times"), who: "uses it the most", everyone: "across everyone" },
    // Signature
    signatureLede: (name: string, e: string, ratio: number) =>
      `The strongest signature is ${e}, ${name}'s: they use it ${times(Math.round(ratio))} more often than everyone else.`,
    signatureCriterion: (minOwn: number) =>
      `The emoji each person uses more often than everyone else, per thousand messages, among the ones they used in at least ${fmt(minOwn)} ${minOwn === 1 ? "message" : "messages"}.`,
    signatureLabel: "Everyone's emoji",
    /** "×90": messages with the emoji. */
    signatureOwn: (own: number) => `×${fmt(own)}`,
    signatureRatio: (ratio: number) => `${fmt(ratio)} times more than everyone else`,
    /** Read by screen readers: "Tomi 😂 ×90, 3.2 times more than everyone else". */
    signatureSpoken: (name: string, e: string, own: number, ratio: number) =>
      `${name} ${e} ×${fmt(own)}, ${fmt(ratio)} times more than everyone else`,
    signatureRecord: {
      label: "The strongest signature",
      unit: (n: number): string => (n === 1 ? "message" : "messages"),
      when: (ratio: number) => `${fmt(ratio)} times more often than everyone else`,
    },
    // By year
    /** "Number one each year: 😭 in 2023, ❤️ in 2024 and 👀 in 2025." */
    leadersLede: (leaders: readonly { year: string; e: string }[]) => {
      const parts = leaders.map((l) => `${l.e} in ${l.year}`);
      const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "");
      return `Number one each year: ${list}.`;
    },
    ledYearsLede: (e: string, years: number, of: number) =>
      of === 1 ? `${e} was number one in the only year.` : `${e} was number one in ${fmt(years)} of the ${fmt(of)} years.`,
    constantLede: (e: string, years: number, of: number) =>
      of === 1 ? `${e} made the top 5 in the only year.` : `${e} made the top 5 in ${fmt(years)} of the ${fmt(of)} years.`,
    byYearCriterion: "The 5 most used emojis of each year, every appearance counts.",
    byYearLabel: "Top 5 per year",
    yearLabel: (year: string) => `Top 5 of ${year}`,
    yearRecord: { label: "One year's emoji", unit: (n: number): string => (n === 1 ? "time" : "times"), when: (year: string) => `in ${year}` },
  },
  polls: {
    byPersonLede: (total: number, name: string, n: number) =>
      `The group made ${plural(total, "poll", "polls")}; ${name}, ${fmt(n)}: more than anyone.`,
    byPersonCriterion: "Polls created by each person with a profile; the total also counts everyone else's.",
    byPersonLabel: "Polls per person",
    creator: {
      label: "The one who made the most polls",
      unit: (n: number): string => (n === 1 ? "poll" : "polls"),
      share: (share: string) => `${share} of the total`,
    },
    tabsLabel: "Sort polls",
    tabs: { mostVoted: "Most voted", unanimous: "Most unanimous", divided: "Most divided" },
    topLede: (question: string, n: number) => `The most voted poll got ${votes(n)}: “${question}”.`,
    topCriterion: (minVotes: number) =>
      `The 10 with the most votes. Unanimous and divided, among those with at least ${votes(minVotes)}: the one that gave the most votes to one option and the one with the smallest gap between first and second.`,
    /** Author of a poll by someone without a profile. */
    someoneElse: "someone else",
    /** Follows the author's name: ", 04/21/2024 · 34 votes"; the date is already formatted. */
    pollWhen: (date: string, n: number) => `, ${date} · ${votes(n)}`,
    topRecord: { label: "The most voted", unit: (n: number): string => (n === 1 ? "vote" : "votes") },
  },
  rhythm: {
    // Starters and killers
    startersLede: (starter: string, n: number, killer: string, m: number) =>
      `${starter} got the chat going ${times(n)}, more than anyone; ${killer} killed it ${times(m)}.`,
    startersCriterion: "Starts: the first message after 3 hours of silence. Kills: the last one before that.",
    startersLabel: "Starts and kills per person",
    starts: "starts",
    kills: "kills",
    startersLegend: "Starts and kills",
    /** Bar tooltip: "Ana · starts: 299". */
    barTitle: (name: string, series: string, n: number) => `${name} · ${series}: ${fmt(n)}`,
    startersRecord: { label: "The one who starts it the most", unit: (n: number): string => (n === 1 ? "start" : "starts"), when: "in total" },
    // Latency
    latencyLede: (name: string, medianFromSec: number) =>
      `${name} replies the fastest: half of their replies go out in ${fmtSeconds(medianFromSec)} or less.`,
    latencyCriterion: (minReplies: number) =>
      `Median seconds to reply, among replies within 10 minutes; it takes at least ${fmt(minReplies)} ${minReplies === 1 ? "reply" : "replies"} to count.`,
    latencyLabel: "Median reply time per person",
    latencyLegend: "Reply speed",
    latencyFrom: "how long they take to reply",
    latencyTo: "how long others take to reply to them",
    latencyAxis: "Seconds, on a log scale",
    /** Under the latency chart when the export's timestamps have no seconds (`global.timeResolution === "minute"`). */
    minuteNote: "This export has no seconds: times are to the minute.",
    /** Row tooltip and spoken row: "Lucas: replies in 10 s; gets replies in 12 s". */
    latencyRow: (name: string, from: number, to: number) =>
      `${name}: replies in ${fmtSeconds(from)}; gets replies in ${fmtSeconds(to)}`,
    tick: (sec: number) => fmtSeconds(sec),
    fastest: {
      label: "The fastest reply",
      unit: "s",
      caption: (name: string) => `replying to ${name}`,
      /** The tag between the two bubbles: "1.8 s". */
      gap: (seconds: number) => fmtSeconds(seconds),
      pair: "The two messages",
    },
    // Streaks
    streaksLede: (streakName: string, streakDays: number, silenceName: string, silenceDays: number) =>
      `The longest streak is ${streakName}'s: ${plural(streakDays, "day", "days")} in a row writing; the longest silence, ${silenceName}'s: ${plural(silenceDays, "day", "days")} without writing.`,
    streaksCriterion:
      "Streak: days in a row with at least one message from the person. Silence: the longest stretch they went without writing.",
    streaksLabel: "Streaks and silences per person",
    streaksLegend: "Streak and silence",
    streak: "streak",
    silence: "silence",
    /** "322 days". */
    days: (n: number) => days(n),
    /** Bar tooltip: "Ana · streak: 322 days, from 12/22/2025 to 11/08/2026"; the dates are already formatted. */
    spanTitle: (name: string, series: string, n: number, from: string, to: string) =>
      `${name} · ${series}: ${days(n)}, from ${from} to ${to}`,
    streakRecord: { label: "The longest streak", unit: (n: number): string => (n === 1 ? "day in a row" : "days in a row"), caption: (to: string) => `until ${to}` },
    // Rings
    ringsLede: (dow: string, dowMsgs: number, month: string, monthMsgs: number) =>
      `${dow} is the busiest day of the week, with ${plural(dowMsgs, "message", "messages")}; ${month}, the busiest month of the year, with ${fmt(monthMsgs)}.`,
    ringsCriterion: "Messages from the whole group by day of the week and by month of the year, adding up every year of the chat.",
    dowLabel: "By day of the week",
    monthLabel: "By month of the year",
    /** Segment tooltip: "Friday: 1,476". */
    segment: (label: string, n: number) => `${label}: ${fmt(n)}`,
    ringsRecord: {
      label: "The busiest day of the week",
      unit: (n: number): string => (n === 1 ? "message" : "messages"),
      /** Takes the plural weekday: "on Fridays". */
      when: (dows: string) => `on ${dows}`,
      caption: "adding up every year",
    },
  },
  mentions: {
    // Matrix
    /** The biggest cell: who tags whom the most. */
    matrixLede: (from: string, to: string, n: number) => `${from} tags ${to} the most: ${times(n)}, the record pair.`,
    pairRecord: { label: "The pair with the most tags", unit: (n: number): string => (n === 1 ? "mention" : "mentions"), when: (to: string) => `tagging ${to}` },
    matrixCriterion: "@ mentions between people with a profile; one per message and person.",
    matrixLabel: "Who mentions whom",
    /** Corner of the grid: rows mention columns (shown with arrows, read as `cornerSpoken`). */
    corner: "from ↓ to →",
    cornerSpoken: "from / to",
    /** Cell label: "Tomi mentions Ana: 120". */
    cell: (from: string, to: string, n: number) => `${from} mentions ${to}: ${fmt(n)}`,
    hint: "Tap a cell to see the messages.",
    /** Panel title: "Tomi mentioned Ana 120 times". */
    samplesTitle: (from: string, to: string, n: number) => `${from} mentioned ${to} ${times(n)}`,
    noSamples: "No messages to show.",
    close: "Close",
    // Profile mode
    mentionsTo: (name: string) => `Who ${name} mentions`,
    mentionedBy: (name: string) => `Who mentions ${name}`,
    // Records
    recordsLede: (mentioned: string, n: number, tagger: string, m: number) =>
      mentioned === tagger
        ? `${mentioned} got ${plural(n, "mention", "mentions")} and made ${fmt(m)}: nobody tags or gets tagged more.`
        : `${mentioned} got ${plural(n, "mention", "mentions")}, more than anyone; ${tagger} made ${fmt(m)}, more than anyone.`,
    recordsCriterion: "@ mentions each person with a profile got (from others with a profile) and made.",
    mostMentioned: { label: "The most mentioned", unit: (n: number): string => (n === 1 ? "mention" : "mentions"), when: "in total" },
    topTagger: { label: "The one who tags the most", unit: (n: number): string => (n === 1 ? "mention" : "mentions"), when: "in total" },
    // Per thousand
    perMilLede: (name: string, perMil: number) =>
      `${name} tags the most per message: ${fmt(perMil)} mentions per thousand messages.`,
    perMilCriterion: "@ mentions each person with a profile made, per thousand of their messages.",
    perMilLabel: "Mentions per thousand messages",
    /** Bar tooltip: "Tomi: 64.5 per thousand (2,318 mentions)". */
    perMilTitle: (name: string, perMil: number, n: number) => `${name}: ${fmt(perMil)} per thousand (${plural(n, "mention", "mentions")})`,
    perMilRecord: {
      label: "The one who tags the most per message",
      unit: "per thousand",
      when: (n: number) => `${plural(n, "mention", "mentions")} in total`,
    },
  },
  awards: {
    lede: (count: number) => `${plural(count, "award", "awards")}, each with a winner and two runners-up. Open the envelopes.`,
    criterion: "Every award comes out of the earlier chapters; two runners-up per award.",
    nobody: "No winner",
    gridLabel: "Awards",
    runnersUp: "Runners-up",
    /** Shown on a closed envelope. */
    closed: "?",
    /** Units whose data label reads badly on its own. */
    units: { x: "times more than everyone else" } as Record<string, string>,
    nickname: (nick: string) => `“${nick}”`,
  },
  conclusion: {
    numbersLabel: "The group in three numbers",
    msgs: "messages",
    days: "days with messages",
    awards: "awards",
  },
  race: {
    title: "The race",
    monthLabel: "Month",
    play: "Play",
    pause: "Pause",
    reset: "Back to the start",
    criterion: "Messages added up month by month.",
    /** `name` is who takes the lead (the departer); only used when the data says someone does. */
    lede: (name: string, overtakeMonth: string | null, monthsToTop: number | null) => {
      const base = "Messages added up. Hit play and watch";
      if (monthsToTop === 0) return `${base} ${name} take the lead from the very first month.`;
      if (monthsToTop === null || overtakeMonth === null) return `${base} who takes the lead.`;
      const months = monthsToTop === 1 ? "one month" : `${fmt(monthsToTop)} months`;
      return `${base} ${name} take the lead in ${fmtMonth(overtakeMonth)}, ${months} in.`;
    },
  },
  heatmap: {
    title: "When",
    gridLabel: "Messages by hour and day",
    /** The chip that shows the whole group. */
    group: "Group",
    /** Cell tooltip: "Mon 21:00 · 1,234 msgs"; `hour` is already zero-padded. */
    cell: (day: string, hour: string, n: number) => `${day} ${hour}:00 · ${plural(n, "msg", "msgs")}`,
    criterion: "Messages by hour and day of the week.",
    lede: "Each cell is an hour of the week. The brighter, the more messages.",
    /** `peakDows` is the plural day ("Saturdays", from `dowPlural`). */
    peak: (peakDows: string, peakHour: number) => `The peak: ${peakDows} at ${peakHour}:00.`,
  },
  pairs: {
    title: "Who talks to whom",
    criterion: "Replies within 10 minutes between two people.",
    lede: "Replies between two people. The thicker the line, the more they talk.",
  },
  departures: {
    title: "The departures",
    criterion: "Re-joins spotted in the system messages.",
    /** `name` is the person who leaves and comes back. */
    lede: (name: string, reentries: number) => `${name} left and came back ${times(reentries)}.`,
    chips: {
      under10Min: "comebacks within 10 minutes",
      medianOut: "median time away",
      polls: "polls created",
    },
    barsLabel: "Re-joins per month",
    /** "The pink peaks: May 2024 and November 2025, 20 each." */
    peaks: (peaks: ReadonlyArray<{ month: string; n: number }>) => {
      const [first, ...rest] = peaks;
      if (!first) return "";
      if (rest.length === 0) return `The pink peak: ${fmtMonth(first.month)}, ${fmt(first.n)}.`;
      const names = peaks.map((p) => fmtMonth(p.month));
      const last = names.pop();
      const list = `${names.join(", ")} and ${last}`;
      if (peaks.every((p) => p.n === first.n)) return `The pink peaks: ${list}, ${fmt(first.n)} each.`;
      return `The pink peaks: ${list}.`;
    },
    quotesTitle: "What the group keeps repeating",
    attributedTitle: (name: string) => `What they pin on ${name}`,
    quoteMeta: (n: number, by: number) => `${times(n)} · ${people(by)}`,
    attributedMeta: (name: string) => `— ${name}`,
  },
  events: {
    title: "Events and sagas",
    criterion: "Days when the group brought the event up again.",
    lede: "What happened once and keeps coming up.",
    empty: "Nothing to tell yet.",
    more: (n: number) => `See the other ${fmt(n)}`,
    /** Follows a bold count: "158 days it came up again". */
    laterDays: (n: number) => (n === 1 ? "day it came up again" : "days it came up again"),
    originMsgs: (n: number) => (n === 1 ? "message that day" : "messages that day"),
    kind: { evento: "event", saga: "saga" },
    origin: "origin",
    listDays: (n: number) => days(n),
    railLabel: "Events and sagas",
  },
  records: {
    title: "Records",
    /** One line per block of the chapter (group view). */
    criterion: {
      length: "Characters per text message.",
      perDay: "Messages from the whole group on a single day.",
      poll: "Votes added up across all options.",
      night: "The latest text message written between 3 and 6 in the morning.",
      quotes:
        "Laughs from others in the next 3 minutes; replies from others within 5 minutes, before the author writes again.",
    },
    lede: "The longest, the latest, the most celebrated.",
    length: {
      label: "Message length",
      averageUnit: "characters on average",
      unit: (n: number): string => (n === 1 ? "character" : "characters"),
      caption: "Types itself out, absurdly fast:",
    },
    perDay: {
      label: "Messages per day",
      averageUnit: "per day",
      unit: (n: number): string => (n === 1 ? "message" : "messages"),
      caption: "the group's loudest day.",
    },
    pollTitle: (name: string, n: number) => `The most voted poll ever (${name}, ${votes(n)})`,
    latestNightTitle: "The latest message ever",
    /** "Ana, 07/14/2024 at 05:59" (no time when `when` has none). */
    latestNightMeta: (name: string, date: string, time: string | null) =>
      time ? `${name}, ${date} at ${time}` : `${name}, ${date}`,
    funniestTitle: "What got the most laughs",
    mostRepliedTitle: "What got the most replies",
    laughsMeta: (laughs: number, by: number) => `${fmt(laughs)} ${laughs === 1 ? "laugh" : "laughs"} · ${people(by)}`,
    repliesMeta: (replies: number, by: number) =>
      `${fmt(replies)} ${replies === 1 ? "reply" : "replies"} · ${people(by)}`,
    person: {
      busiest: { label: "Busiest day", unit: (n: number): string => (n === 1 ? "message" : "messages"), caption: "in a single day." },
      streak: { label: "Streak", unit: (n: number): string => (n === 1 ? "day in a row" : "days in a row"), caption: (to: string) => `until ${to}` },
      silence: { label: "Silence", unit: (n: number): string => (n === 1 ? "day without writing" : "days without writing"), caption: (to: string) => `until ${to}` },
    },
  },
  dictionary: {
    title: "Dictionary",
    criterion: "Words born in the group, by number of uses.",
    lede: "Words only the group gets.",
    /** "Bruno · 824 uses · since 07/22/2024". `since` is already a formatted date. */
    detail: (name: string, n: number, since: string) => `${name} · ${fmt(n)} ${n === 1 ? "use" : "uses"} · since ${since}`,
    coined: (name: string, n: number) => `${name} coined ${fmt(n)}`,
    legendLabel: "Who coined each word",
    cloudLabel: "The group's words",
  },
  profile: {
    /**
     * Every anchored block of a profile (/p/[slug]/), in page order: the sidebar's “This profile” anchors.
     * Each title is the block's heading on the page (the v1 sections keep their copy.*.title).
     */
    blocks: [
      { id: "race", title: "The race" },
      { id: "heatmap", title: "When" },
      { id: "graph", title: "Who talks to whom" },
      { id: "cloud", title: "Dictionary" },
      { id: "rail", title: "Events and sagas" },
      { id: "muletillas", title: "Catchphrases" },
      { id: "repeated", title: "Lines others repeated" },
      { id: "laughed", title: "The one that got the most laughs" },
      { id: "laughs", title: "How they laugh" },
      { id: "signature", title: "Their emoji" },
      { id: "kinds", title: "What they send" },
      { id: "mentions", title: "Mentions" },
      { id: "latency", title: "How fast they reply" },
      { id: "premios", title: "Awards" },
    ],
    back: "Back to the group",
    indexTitle: "One by one",
    indexLede: "Tap someone to see their own story.",
    raceLede: (name: string) => `${name}'s position against the group, month by month.`,
    heatmapLede: (name: string) => `When ${name} writes.`,
    pairsLede: (name: string) => `Who ${name} talks to.`,
    eventsLede: (name: string) => `The events ${name} starred in.`,
    dictionaryLede: (name: string) => `The words ${name} coined.`,
    // New blocks (the chapter components with the person fixed)
    repeatedLede: (name: string, phrases: number, most: number) =>
      `Others repeated ${phrases === 1 ? `a line of ${name}'s` : `${fmt(phrases)} of ${name}'s lines`} word for word; the top one, ${times(most)}.`,
    repeatedEmpty: (name: string) => `Nobody repeated a line of ${name}'s word for word.`,
    laughedLede: (name: string, laughs: number, by: number) =>
      `${name}'s funniest message got ${copyLaughs(laughs, by)}.`,
    laughedEmpty: (name: string) => `None of ${name}'s messages got enough laughs.`,
    /** `label` is the laugh class as written ("haha", "😂 🤣"); `share` of all their laughs, 0–1. */
    laughsLede: (name: string, label: string, share: number, avgJa: number) =>
      `${name} laughs mostly with “${label}”: ${fmtShare(share)} of their laughs, and stretches the haha to ${fmt(avgJa)} “ha” on average.`,
    laughsEmpty: (name: string) => `${name} didn't write any laughs.`,
    signatureLede: (name: string, e: string, ratio: number) =>
      `${name}'s signature is ${e}: they use it ${fmt(ratio)} times more often than everyone else.`,
    signatureEmpty: (name: string) => `None of ${name}'s emojis make the signature cut.`,
    kindsLede: (name: string, kind: string, n: number) => `After text, ${name} sends ${kind} the most: ${fmt(n)}.`,
    kindsEmpty: (name: string) => `${name} only sends text.`,
    /** Top of each list (whom they tag, who tags them), or null when that list is empty. */
    mentionsLede: (
      name: string,
      to: { name: string; n: number } | null,
      by: { name: string; n: number } | null,
    ) => {
      const a = to && `${name} tags ${to.name} more than anyone: ${times(to.n)}.`;
      const c = by && `The one who tags ${name} the most is ${by.name}: ${times(by.n)}.`;
      return [a, c].filter(Boolean).join(" ") || `${name} doesn't tag anyone with a profile, and nobody tags ${name}.`;
    },
    latencyLede: (name: string, fromSec: number, toSec: number) =>
      `Half of ${name}'s replies go out in ${fmtSeconds(fromSec)} or less; others reply to ${name} in ${fmtSeconds(toSec)}.`,
    /** Shown instead of the chart when the person is out of the latency ranking. */
    latencyEmpty: "No replies to measure.",
    awardsLede: (name: string, won: number, finalist: number) => {
      const prizes = `${fmt(won)} ${won === 1 ? "award" : "awards"}`;
      if (won > 0) return finalist > 0 ? `${name} won ${prizes} and was a runner-up in ${fmt(finalist)}.` : `${name} won ${prizes}.`;
      return finalist > 0
        ? `${name} didn't win any awards, but was a runner-up in ${fmt(finalist)}.`
        : `${name} didn't win any awards or make the runners-up.`;
    },
    awardsCriterion: "The ones from the Awards chapter: the ones they won and the ones where they made the two runners-up.",
    awardsWon: "Awards won",
    awardsFinalist: "Runner-up",
    finalistIn: (title: string) => `runner-up in ${title}`,
  },
} satisfies Copy;
