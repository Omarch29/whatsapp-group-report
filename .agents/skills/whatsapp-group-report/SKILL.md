---
name: whatsapp-group-report
description: Builds a static web report (chapters, charts, records, profiles, the group's own words) from a WhatsApp group chat export in chats/, asking the developer a few questions and writing the texts in the group's tone; also changes or deploys a report already built. Use when the developer says "build the report of my WhatsApp group", "make the report", "armame el informe de mi grupo", "haceme el informe del grupo", or asks to change, rebuild, translate or deploy that report.
---

# WhatsApp group report

You turn the developer's WhatsApp group export into a static website. Scripts do every count and check; you
orchestrate them, ask the developer what cannot be deduced, and write a few short texts. The developer knows nothing
about this repo and should never have to read code. Work from the repo root.

**Language.** These instructions are in English. Everything you say to the developer is in the language they write
to you in. Everything you write into `content/` (event titles and notes, the conclusion) is in the chat's language
(`lang`, see step 4).

## 1. Rules (they override everything below)

1. **Never read the raw export.** Do not open, `cat`, `grep`, `head` or quote any file in `chats/`. You read only
   what the scripts expose: `data/analysis/*.json` and, after a full run, `web/data/*.json`.
2. **No contact surnames and no phone numbers** in anything you write (`content/`, `report.config.json`, messages to
   the developer about published text). Contact names in `data/analysis/` (and in `@` mentions inside samples) can
   carry surnames: refer to people only by the short names of `content/people.json`.
3. **The access word belongs to the developer.** Never ask for it, never repeat it, never write it into any file,
   never print `web/.env.local`. The developer types it into `web/.env.local` as `NEXT_PUBLIC_GATE_WORD=...`. If they
   paste it into the chat anyway, do not repeat it, do not use it, and suggest they pick another one.
4. **Never overwrite an existing file** in `content/` or `report.config.json` without asking first. Check that a file
   is missing before you create it. A change request from the developer counts as permission for the files that
   request names (see `references/changes.md`), nothing more.
5. **Every claim in a text must be in the data** (`web/data/*.json`, `data/analysis/*.json`). No invented anecdotes,
   numbers, dates or quotes. If a fact is not there, leave it out.
6. **Never commit or push** anything from `chats/`, `content/`, `data/`, `web/data/`, `report.config.json` or
   `web/.env.local` (they are gitignored on purpose; never `git add -f`).
7. Stop and ask when this playbook says so. Do not improvise a feature the scripts do not have.

A report was built before only if one of these exists: `report.config.json`, `content/people.json`,
`content/nicknames.json`, `content/events.json`, `content/badwords.txt`, `content/conclusion.md`. (`content/.gitkeep`
and `content/example/` ship with every clone: they do not count.) Then ask whether the developer wants to change it
(go to `references/changes.md`) or start over. Starting over needs their explicit yes; then move only those files
into `content/old-<YYYY-MM-DD-HHMM>/` (date and time, so a second start-over the same day keeps the first; git-ignored
like all of `content/`), never `content/example/` or `content/.gitkeep`.

## 2. Check the environment

Run `uv --version` and `pnpm --version`.

- `uv` missing: point to https://docs.astral.sh/uv/getting-started/installation/ and wait.
- `pnpm` missing: `npm install -g pnpm@9.15.0` (or `corepack enable`), then wait.
- Python packages: run `uv sync`. Web packages: if `web/node_modules` does not exist, run `cd web && pnpm install`.
- List the folder with `ls chats/` (names only). There must be exactly one `.txt` besides `.gitkeep`.
  - None: list the repo root too (`ls`, names only). An export dropped there is named `_chat*.txt`, `WhatsApp Chat*`
    or `Chat de WhatsApp*`, or is a `.zip`: move it into `chats/` (`mv "<name>" chats/`) before going on, and unzip a
    `.zip` there (`unzip -o chats/<file>.zip -d chats/`), keeping only the `.txt`. If there is none, ask the developer
    to export the chat from WhatsApp (group > Export chat > **Without media**) and copy the `.txt` into `chats/`.
  - Several: ask which one is the group's.

## 3. Discover

```bash
uv run python -I scripts/build_pipeline.py --until analyze --chat chats/<file>.txt
```

Then read `data/analysis/summary.json`. What it holds: `locale` (`platform`, `lang`, `date_order`, `verified`),
`size` (`msgs`, `days`, `from`, `to`), `group_names`, `me_candidates`, `people[]` (`raw`, `short`, `msgs`, `first`,
`last`, `quoted_nickname`), `departure_candidates[]` (`short`, `reentries`), `has_polls`, `peak_days`, `sample` (300
messages across the years: read them to learn the group's tone and language), `active_people`, `profiled_people`,
`recommended_mode`. At this point `short` is still the raw contact name.

- `profiled_people` is `0`: nobody has enough messages for a profile. Before the questions, tell the developer the
  report will have no profiles and few awards, and propose `single` (question 5).

- `locale.lang` is the phone's language (the export's markers), not necessarily the group's. If most `sample`
  messages are in the other language, rerun the same command with `--lang en` or `--lang es` (the group's language).
- `locale.date_order`: only `"ambiguous"` needs a remark: tell the developer dates are read as day/month, without
  asking. For `"dmy"` and `"mdy"` say nothing.
- `locale.verified` is `false`: tell the developer their export format was built from documentation, not a real
  export, and ask them to say if a number looks wrong.
- The command fails saying the format is unknown: say so, ask the developer to check it was exported from WhatsApp
  without media, and stop.

## 4. Ask

One question per message, each with your proposal, so the developer can answer "yes". Never ask what the data
already answers. If the developer prefers, ask everything in one message. These seven are the only questions of a
first run: the swear words and the closing text are not questions, they go into the hand-over (step 7) and you never
wait on them. Order:

1. **Title.** `group_names` lists every name the group had, alphabetically (not by date): show them all and propose
   the one that looks current, without trailing emoji. If the list is empty (Android exports carry no group name),
   propose the export's file name without the `WhatsApp Chat with` / `Chat de WhatsApp con` prefix and without the
   extension; if nothing usable is left, ask for a title without a proposal.
2. **Who they are.** Show the `people` list (contact names, message counts) and ask which one is them; if
   `me_candidates` holds `Tú`/`You`, add that the export calls them that in its own notices. The answer is a person
   of the list: that person's `raw` value in `summary.json` is what question 3 passes to `--me-raw`, copied from the
   file, never retyped.
3. **Short names and nicknames.** Run, with the group's language from step 3 (`es` or `en`):
   `uv run python -I scripts/draft_content.py --lang <es|en> --me-raw '<raw value from question 2>'`
   (all on one line; the value goes in single quotes, or, if it contains a single quote itself, in double quotes with
   every inner `"` written `\"`).
   If that `raw` is `Tú`/`You` (the export has no contact name for them), leave `--me-raw` out and then set `"me"`
   and the value of the `Tú`/`You` key in `content/people.json` to the short name they give you.
   It writes only missing files (`content/people.json`, `content/nicknames.json`, `content/badwords.txt`) and prints
   `wrote <path>` or `kept <path> (already exists)`. Show one table: contact name, short name, nickname. Apply the
   corrections in one go; a renamed short name is also renamed as a key in `content/nicknames.json`, and a changed
   nickname is updated in `aliases` of `content/people.json` (lowercase). A `Persona N` / `Person N` row is a
   contact with no usable first name: usually a number not saved in the developer's contacts, sometimes a first name
   that is also someone else's surname. The developer names them; one they cannot name may stay as it is. Two contacts that are the same person get the same short name. Short
   names are first names or nicknames, never surnames (an initial like `Nico S.` is fine). Shapes:
   `references/content.md`.
4. **Language.** Propose the language most `sample` messages are written in; it is both the site's language and the
   one your texts use. If the developer wants the other one, warn that the word analysis (laughs, stopwords, the
   dictionary) follows `lang` too, then rerun step 3 with `--lang`. Keep `content/badwords.txt` in the language the
   chat is written in: a list in the other language would count no swear words at all.
5. **Mode.** Propose `recommended_mode` and say why: `single` (one long page) when the chat has fewer than 20,000
   messages or fewer than 5 active people (`size.msgs`, `active_people`); `full` (chapters, menu, one profile per
   person) otherwise. It is a proposal: if the developer picks the other mode, use theirs without arguing.
6. **Departures chapter** ("the one who leaves and comes back"). Only if the first `departure_candidates` entry has
   `reentries >= 2`: propose that person (map the raw name to their short name through `content/people.json`) and
   say how many times they came back. Otherwise do not mention it and use `"departer": null`.
7. **Access word.** Yes or no; recommend yes for a real chat (anyone with the link could read it). If yes, tell them
   to create `web/.env.local` themselves with the single line `NEXT_PUBLIC_GATE_WORD=<their word>`, not to tell you
   the word, and to say when it is done.

## 5. Write

`report.config.json` (only if it does not exist; otherwise ask), with every key, `verifiedOn` = today:

```json
{
  "title": "Los del Parque",
  "lang": "es",
  "mode": "single",
  "chat": "chats/<file>.txt",
  "background": [],
  "me": "Ana",
  "departer": "Bruno",
  "gate": true,
  "verifiedOn": "2026-11-14"
}
```

`gate` is `false` when the developer declined the access word (question 7). `me` and `departer` must be short
names from `content/people.json`. Then finish `content/` as in
`references/content.md`: the corrected `people.json` and `nicknames.json`, and `badwords.txt` (the base list of the
language; add swear words you saw in the `sample` that are missing).

## 6. Build

1. Full run (reads `report.config.json` and `content/`; needs `content/people.json` and `content/badwords.txt`):
   `uv run python -I scripts/build_pipeline.py`
   It prints a "Badwords review": the list's words by number of messages. Note the three or four most counted for
   the hand-over (step 7); do not ask about them now, keep building.
2. Write `content/events.json` from `data/analysis/peak_days.json`, and `content/conclusion.md` from `web/data/*.json`
   and the `sample` tone, following `references/writing.md`.
3. Run `uv run python -I scripts/build_pipeline.py` again. In `data/analysis/events.json`, an entry with an `"error"`
   key matched nothing in its window and is left out of the site: fix its `terms` or dates and rerun.
4. Run `uv run python -I scripts/check_report.py` and explain to the developer, in plain words, every `off` line
   (a chapter that will not appear, and why) and every `thin` line (a weak spot). Fix what you can (events, swear
   words); for `0 profiles` in `full` mode propose `single`. Ask before turning on a chapter the data does not support.
5. With `"gate": true`, check that the developer created the file, without printing it:
   `grep -c '^NEXT_PUBLIC_GATE_WORD=.' web/.env.local` must print `1`. If not, ask them to create it and wait.
6. `cd web && pnpm build`. It must end without errors (a warning that `conclusion.md` is still a draft means you
   wrote BORRADOR or DRAFT: rewrite it).

## 7. Hand over

Tell the developer to run `cd web && pnpm dev` and open http://localhost:3000. Say what they will see: the word
screen if the gate is on (they type their word), then the cover with the title and either one long page with a
floating index (`single`) or an introduction with the chapter menu and a profile per person (`full`). Mention the
chapters that are off and why, in one line. Add, briefly: the three or four most counted swear words with "tell me
if one of these is not a swear word in your group", and that the closing text is signed with their name and changes
on request (it is `content/conclusion.md`); do not paste it. Then give three example requests in their language,
chosen from `references/changes.md` and using their real names and events, for example: "change the title of the event
<title>", "call Tomi Tomate", "switch it to the full version". Remind them `pnpm dev` reads language and mode
once: after a change, stop and start it again.

## 8. Deploy

Only when the developer asks to publish it: follow `references/deploy.md`.
