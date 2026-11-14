# Development

Notes for people who work on this repo: the export formats, the synthetic chat, the test suites, the public demos,
the access gate, CI and the screenshots. To build a report of your own group, follow the [README](../README.md);
the design (in Spanish) is in [design.md](design.md).

A Python pipeline (`scripts/`) reads the `_chat.txt` export plus a few curated content files (`content/`: people,
nicknames, events) and writes JSON into `web/data/`; a Next.js site (`web/`) renders that JSON as a static export.
The repo ships a fictional group ("Los del Parque") so everything runs out of the box.

Run the pipeline on the example chat (a synthetic one, generated on the spot; see "Synthetic chat" below):

```bash
uv sync
uv run python -I scripts/synth_chat.py --lang es --platform ios --seed 7 --lines 8000 --out chats/synth-es-ios.txt
cp report.config.example.json report.config.json   # chat = chats/synth-es-ios.txt
uv run python -I scripts/build_pipeline.py --config report.config.json --content content/example --thresholds derived
uv run pytest -q   # optional: the test suite
```

Build the site (it reads `web/data/`; on a fresh clone it falls back to the committed `web/data/example/`):

```bash
cd web && pnpm install && NEXT_PUBLIC_GATE_WORD=demo pnpm build   # static site in web/out/
```

## Formats

WhatsApp writes a different `_chat.txt` per platform and per phone language. The parser detects the format from the
first lines (`scripts/wa/parser.py`, `detect_format`); the locale tables live in `scripts/wa/locales.py`.

| Platform | Language | Status |
| --- | --- | --- |
| iOS | Spanish | Verified with real exports |
| iOS | English | Built from documentation, unverified |
| Android | Spanish | Built from documentation, unverified |
| Android | English | Built from documentation, unverified |

Android exports have minute-resolution timestamps and replace every attachment with `<Media omitted>`
(`<Multimedia omitido>` in Spanish), so an Android report has no audio block and its reply times are per minute.
If you have an export in one of the unverified formats, open an issue with 20 anonymised lines (names and phone
numbers replaced, the rest exactly as exported).

## Synthetic chat

`scripts/synth_chat.py` writes a fictional group ("Los del Parque 🌳", nine people) in any of the four formats, plus
the matching `content/` files. The same seed gives the same story in both languages; only the words change. The
published example (`content/example/` and `web/data/example/`) is the Spanish iOS chat with seed 7 and 8,000 lines.
Exports never get committed (`chats/` is gitignored), only what the pipeline makes of them.

Generate the example chat and its content:

```bash
uv run python -I scripts/synth_chat.py --lang es --platform ios --seed 7 --lines 8000 \
    --out chats/synth-es-ios.txt --content-out content/example
```

Run the pipeline on it (with `report.config.json` copied from `report.config.example.json`); to refresh the published
example after a change to the generator or the pipeline, point `--out` at it:

```bash
uv run python -I scripts/build_pipeline.py --config report.config.json --content content/example --thresholds derived \
    --out web/data/example
```

`uv run pytest -q` runs the same pipeline on the 8,000-line chat in Spanish and English (and on Android), checks
that every chapter has data and that the published example matches, and leaves the output in `web/data/synth/`
(gitignored) so that `cd web && pnpm test` validates it against the site's schemas.

## Development

`uv run pytest -q` runs the Python suite and `cd web && pnpm test` the web one (vitest reads the committed
`web/data/example/` whatever sits in `web/data/`). A guard test keeps a real group's names out of this public repo:
maintainers keep a private word list outside the repo (one word per line, `#` comments, a trailing ` whole`
for whole-word matching) and run `WGR_PRIVATE_WORDS=/path/to/words.txt uv run pytest -q`. Without that variable the
name check is skipped; the generic checks (no tracked chat exports, no tracked data outside `web/data/example/`, no
contact surname from a local `content/people.json`) always run.

`content/badwords.txt` starts from the language's base list; edit freely (only the words in the file are counted).

The agent skill that builds a report lives in `.agents/skills/whatsapp-group-report/`; `AGENTS.md` says how each
agent finds it.

## Deploy notes

The user-facing deploy steps are in the README (step 6). What happens underneath:

- `pnpm run deploy` (in `web/`) runs `vercel pull --yes --environment=production`, `vercel build --prod` and
  `vercel deploy --prebuilt --prod`. It is always written with `run`: without it pnpm runs its own workspace command
  of the same name.
- The pull goes first because `vercel build` bakes `NEXT_PUBLIC_GATE_WORD` from the environment pulled into
  `web/.vercel`, so pulling first makes a changed word take effect on the next deploy (and the build never stops to
  ask whether to pull the project settings).
- With `mode: "single"` the export also holds two empty placeholder pages (`out/_/`, `out/p/_/`) that answer 404,
  because Next 16 rejects an empty `generateStaticParams` under `output: export`.
- `pnpm dev` serves the language (and mode) in `global.json`, like the build. It reads them once, at start: after
  running the pipeline in another language or mode, restart it.

## Demo

`scripts/demo_deploy.py` builds the two public demos, the fictional chat with no gate, in Spanish and English. It is
for the maintainers of those demos; to publish your own report, use step 6 of the README.

```bash
uv run python -I scripts/demo_deploy.py --lang es --no-deploy   # build + language check only
uv run python -I scripts/demo_deploy.py --lang en               # also links, pulls, builds and deploys
```

It generates `chats/synth-<lang>-ios.txt`, `content/demo-<lang>/`, `report.config.demo-<lang>.json`,
`data/demo-<lang>/` and `web/data/demo-<lang>/` (all git-ignored, none of them touches your own data), builds `web/`
with `WGR_DATA_DIR` and `WGR_CONTENT_DIR` pointing there, and runs `pnpm check:en`, which fails if a page or chunk
carries UI words of the other language. Without `--no-deploy` it then runs `vercel link --yes --project
whatsapp-group-report-<lang>` (only if `web/.vercel` is not already that project) followed by `vercel git disconnect
--yes` (linking connects the GitHub remote, and every push would start a build from git), `vercel pull --yes
--environment=production`, `vercel build --prod` and `vercel deploy --prebuilt --prod`. Regenerate both with each
release.

`--mode full` (the default) builds the report with chapters; `--mode single` builds the one-page report and needs
`--no-deploy`, because the public demos are full.

`web/.vercel` holds one linked project at a time, so the script re-links it: alternating between the `es` and `en`
demos re-links, and if `web/.vercel` pointed at another project (your own report) the script prints a warning before
linking it to the demo. Afterwards a `pnpm run deploy` would go to the demo project: run `vercel link` in `web/` and
pick your project to point it back.

## Access gate

`gate` in the report config decides whether the site asks for a word before showing anything.

- `gate: true` (the default for real chats): visitors type the group's word once; the browser remembers it in
  `localStorage.wgr_gate`. The word is read at build from `NEXT_PUBLIC_GATE_WORD` and only its hash reaches the
  client. It lives in `web/.env.local` (never committed) and in the host's environment variables (Vercel project
  env). The build fails if it is missing.
- `gate: false`: no word is needed and `NEXT_PUBLIC_GATE_WORD` is not read. The report is served open to anyone
  who has the URL. This is discouraged for real chats: it only suits the fictional example or a chat everyone in
  it agreed to publish.

To change the word (only with `gate: true`), from `web/`:

```bash
vercel env rm NEXT_PUBLIC_GATE_WORD production
vercel env add NEXT_PUBLIC_GATE_WORD production --no-sensitive
pnpm run deploy                                    # pulls the new word, then builds and deploys
```

Locally, edit `web/.env.local`. Changing the word changes its hash, so everyone who already unlocked the site has to
type the new one.

The gate is a client-side deterrent, not authentication: pages are still static files.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests, in two jobs:

- `test`: `uv run pytest -q`, then in `web/` `pnpm lint` and `pnpm test` (vitest).
- `build`: the four synthetic builds, one per language and mode (`es`/`en` × `full`/`single`), each with
  `uv run python -I scripts/demo_deploy.py --lang <lang> --mode <mode> --no-deploy` (build and language check, no
  deploy). CI holds no Vercel token and deploys nothing.

## Screenshots

The README's captures (`docs/screenshots/{en,es}/{hero,heatmap,chapter,single-mobile}.png`) come from the fictional
chat. `web/scripts/screenshots.mjs` builds each language with `demo_deploy.py --no-deploy` (full, then single),
serves `web/out/` locally and takes the shots with Playwright. Regenerate them with each release:

```bash
cd web
pnpm exec playwright install chromium   # first time only
pnpm screenshots
```
