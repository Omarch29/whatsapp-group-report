# Changing a report

The developer asks in their own words ("cambiá el título del evento del asado", "call Tomi Tomate", "pasalo a
inglés"). Find the row, edit only the file it names (the request is the permission for that file; anything else,
ask), then rerun what the row says. The rules of `SKILL.md` still hold: no raw export, no surnames, no access word.

Reruns:

- **A**: `uv run python -I scripts/build_pipeline.py`, then `uv run python -I scripts/check_report.py` (explain any
  new `off` or `thin` line), then `cd web && pnpm build`.
- **B**: `cd web && pnpm build` only (the file is read by the site, not by the pipeline).

After either, tell the developer to stop `pnpm dev` and start it again (it reads language and mode once, at start).

| Request | File and what to change | Rerun |
|---|---|---|
| Title of the report | `report.config.json`: `title` | A |
| Title or note of an event | `content/events.json`: that entry's `title` or `note` | A |
| Add or remove an event | `content/events.json` (how: `writing.md`); add from `data/analysis/peak_days.json` | A |
| An event counts the wrong messages | `content/events.json`: its `terms` or `from`/`to` | A |
| A nickname | `content/nicknames.json`: the value for that short name (remove the entry for none) | A |
| A short name | `content/people.json`: every value with the old name; then the same name as a key in `content/nicknames.json`, `me`/`departer` in `report.config.json` and any mention in `content/events.json` notes and `content/conclusion.md` | A |
| Two contacts are one person | `content/people.json`: give both keys the same short name | A |
| One page or full version | `report.config.json`: `mode` (`single` or `full`) | A |
| Language of the site | `report.config.json`: `lang`; rewrite titles, notes and conclusion in that language (ask before replacing them); the word analysis follows `lang` too, so say the Language chapter is best in the chat's own language | A |
| Departures chapter on or off | `report.config.json`: `departer` (a short name, or `null`); optional `departerAliases` (list of the ways the chat calls them) | A |
| Swear words | `content/badwords.txt`: one per line, lowercase, no accents | A |
| The conclusion | `content/conclusion.md` (rules: `writing.md`) | B |
| A fixed phrase of the site (a label, a chapter title) | `web/i18n/<lang>.ts` (`es.ts` or `en.ts`), a tracked file of the repo: edit it in the developer's clone and do not commit it to a public fork; change only the string; entries that show a number are functions, keep their arguments. If `cd web && pnpm test` then fails on a pinned string, that test is the repo's own and can be ignored for a personal report | B |
| Access word on or off | `report.config.json`: `gate`; with `true` the developer creates or edits `web/.env.local` themselves, and before the build you run the check of `SKILL.md` step 6.5 (`grep -c '^NEXT_PUBLIC_GATE_WORD=.' web/.env.local` prints `1`) | A |
| Change the access word | the developer edits `web/.env.local` themselves, then the check of `SKILL.md` step 6.5 (and, if deployed, see `deploy.md`) | B |
| A newer export of the chat | the developer replaces the `.txt` in `chats/`; update `chat` in `report.config.json` if the name changed; new contacts need a short name (run the discovery of `SKILL.md` step 3 and add only the missing keys to `content/people.json`) | A |

After a newer export the full run may print "Copy review: ... Re-read the qualitative phrases ... and bump
verifiedOn": read the listed phrases in `web/i18n/<lang>.ts`, say whether any no longer fits, then set `verifiedOn`
in `report.config.json` to today.

Not supported, say so instead of improvising: leaving a person out of the report, hiding a single chapter that has
data, adding a new chapter or chart.
