# Writing the events and the conclusion

You write two things: `content/events.json` and `content/conclusion.md`. Both are published. Write them in the
chat's language (`lang` in `report.config.json`) and in the group's voice: read `sample` in
`data/analysis/summary.json` first and borrow its register (formal or not, its slang, its laughs), never its
contact names. Every fact you state must be in the data; when in doubt, leave it out.

People are always named by their short name (`content/people.json` values) or their nickname
(`content/nicknames.json`). Samples in `data/analysis/` can contain raw contact names, often inside `@` mentions,
with surnames: never copy those.

## Events, from the peak days

Source: `data/analysis/peak_days.json`, written by the first full run. Thirty entries, most unusual day first:

```json
{"date": "2025-12-13", "msgs": 69, "ratio": 8.6, "peak_hour": 17,
 "top_senders": {"Tomi": 15, "Bruno": 9, "Juli": 8},
 "keywords": ["cumple", "torta", "regalo", "feliz", "caro"],
 "sample": ["17:30 Tomi: hoy festejamos el cumple, no falten", "18:03 Ana: Hay torta para todo el barrio."]}
```

`ratio` is that day's messages over the usual for those weeks. `keywords` are the day's distinctive words, most
distinctive first. `sample` is up to eight messages from around `peak_hour`, in chat order: when that hour has them, up to five
carry one of the day's first keywords and the rest is random chatter of that hour; a day's sample may carry none. For the ten most unusual days, `peak_days[].top_terms` in
`summary.json` lists the day's most repeated words too. If `keywords` is empty, use `top_terms` and the words that
repeat in `sample`.

Steps:

1. Go down the list and keep the days where the first `keywords` point to one thing that happened (a birthday,
   a trip, a match, a party, a piece of news). Skip days that are just busy with unrelated chatter. Merge peak days
   a few days apart that are the same thing. Aim for three to eight events; fewer good ones beat many vague ones.
2. **Title**: what the group would call it, short and recognisable ("El cumple de Caro", "The final"), not a
   description of the data ("Peak of December 13"). It comes from the day's `keywords` (and `top_terms` when
   present), in their order: the first ones name the thing. The sample lines illustrate, they do not decide: if the
   first keywords and the sample disagree, the keywords win.
3. **Note**: one sentence that says what happened, with only what the keywords and samples show.
4. **Terms**: a regex built from the day's keywords and the words in its sample that name the thing, alternatives
   joined with `|` (`"cumple|torta|regalo"`). Use `\\b` around short words that occur inside other words. Avoid
   words everyone says every day (`hoy`, `today`, a person's name alone): the site counts how often the group came
   back to the event later by these terms, so a generic word inflates it.
5. **Window**: `from` = the peak day minus 2 days, `to` = the peak day plus 2 days.
6. **id**: a lowercase slug of the title (`cumple-caro`), unique.

After the next full run, check `data/analysis/events.json`: an entry with an `"error"` key matched nothing in its
window (fix its terms or dates); for the others, `later_days` and `later_mentions` say whether the group kept
talking about it. An event nobody came back to can stay, but do not claim in its note that it was remembered.

If there is no clear event at all, write `[]` and tell the developer the events chapter will be thin.

## The conclusion

`content/conclusion.md`: three short paragraphs, then a blank line and `— <me>` (the developer's short name; they
sign it). Shape in `content.md`.

- Paragraph 1: the report's title, the span of `period` in `web/data/global.json` and the events by their titles.
  Do not describe who the group is or how it started: no data file says so.
- Paragraph 2: two or three findings with their numbers, from `web/data/facts.json`, `web/data/records.json`,
  `web/data/awards.json` or `web/data/global.json` (`totals`, `people`): who writes most, when the group is busiest,
  a record. Quote numbers as they are in the data, rounded only if you say "almost" or "more than". `peakDow` and
  `peakHour` in `facts.json` are one moment, the brightest cell of the heatmap ("on Mondays at 22 h"), not the busiest
  day and the busiest hour; the busiest weekday on its own is the largest of `rings.dow` in `web/data/rhythm.json`
  (Monday first).
- Paragraph 3: a short, warm close in the group's voice, addressed to the group.

Rules:

- Only facts present in `web/data/*.json` (or the event titles you wrote). No invented scenes, quotes or feelings
  attributed to anyone.
- No surnames, no phone numbers, no access word.
- Never write the words BORRADOR or DRAFT (the build would warn that it is a draft).
- Do not show the text or ask about it before the build: build first. The hand-over (step 7 of `SKILL.md`) tells
  the developer, briefly, that it is signed with their name and lives in `content/conclusion.md`, and you change it
  when they ask.
