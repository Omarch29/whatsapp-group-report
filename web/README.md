# whatsapp-group-report (web)

Static Next.js site (`output: "export"`) built from the JSON that the pipeline writes into `web/data/`. How to run
the pipeline by hand, the demo, the access gate and the deploy details are in `docs/development.md` (repo root);
building a report with an AI agent, which writes `content/`, is "Six steps" in the root `README.md`.

```bash
pnpm install
pnpm dev          # local; reads the language and mode once, at start
pnpm test         # vitest (reads the committed web/data/example/, whatever sits in web/data/)
pnpm lint
pnpm build        # writes out/
pnpm check:en     # after a build: fails if a page or chunk carries UI words of the other language
```

`pnpm dev` reads `lang` and `mode` from `global.json` once, when it starts: after running the pipeline in another
language or mode, restart it.

## Data and content

- The build reads `WGR_DATA_DIR` when it is set; otherwise `web/data/` when it holds a `global.json`; otherwise the
  committed fictional `web/data/example/`, with a warning (`src/lib/dataDir.ts`).
- Editable content (`people.json`, `nicknames.json`, `badwords.txt`, `conclusion.md`) lives in `content/` at the repo
  root, or in `WGR_CONTENT_DIR` when it is set (`src/lib/data.ts`).
- Besides the report's data, `global.json` carries its settings, copied from `report.config.json`: `title`, `lang`,
  `platform`, `timeResolution`, `mode` and `gate`.

## Texts

Every UI text lives in `web/i18n/`: `es.ts` is the reference and `en.ts` has exactly its shape (keys and function
arities; `i18n/copy.test.ts`). `web/content/copy.ts` only picks the language of the build (`global.json.lang`, passed
in as `NEXT_PUBLIC_WGR_LANG` by `next.config.ts`), so a bundle carries one language.

- Numbers never sit in the copy: any entry that shows one is a function that receives it. The method criteria read
  their thresholds from `facts.thresholds` (written by the pipeline), so nobody edits a number in the copy when a
  threshold changes; `i18n/copy.test.ts` fails if a criterion string embeds one.
- `verifiedOn` (the date the qualitative phrases were last re-read) is in `report.config.json`. The pipeline compares
  it with the export's last message and, when the export is newer, lists the phrases to re-read (`COPY_REVIEW_KEYS`
  in `scripts/build_web_data.py`).

## Routes

`mode` in the report config decides what the export holds.

- `full`: `/` (the introduction), one page per chapter and one profile per person under `/p/[slug]/`. Chapters are
  served by `src/app/(report)/[chapter]/page.tsx`; their ids and page bodies are in `src/chapters/`, and their titles,
  public slugs (Spanish and English) and blocks are in `web/i18n/{es,en}.ts` (`chapters`). Three chapters only exist
  when the data has them: departures (a `departer` in the config), polls (the chat has polls) and mentions; without
  them the route is not generated and the navigation skips it (`chaptersFor`, `loadChapterFlags`).
- `single`: one long page at `/` (`src/single/`) with a floating index of its blocks, no sidebar and no pager. The
  export holds `/`, the 404 pages and two placeholder directories, `_/` and `p/_/`, that answer 404: Next 16 rejects
  an empty `generateStaticParams` under `output: "export"`.

## Gate

With `gate: true` in the report config (`global.json.gate`), the site asks for the group's word before showing
anything. Only then is `NEXT_PUBLIC_GATE_WORD` read at build (from `web/.env.local` locally, from the host's
environment in production) and the build fails without it; only its SHA-256 reaches the client, and the browser
remembers the unlock in `localStorage.wgr_gate`; changing the word changes the hash, so everyone types the new one.
When the word is set (in the environment or `web/.env.local`), `pnpm vitest run src/lib/gateWord.test.ts` checks that
it appears in no tracked source file. With `gate: false` the variable is not read and the site is served open to
anyone with the URL, which is discouraged for real chats.

To change the word (only with `gate: true`), from `web/`: `vercel env rm NEXT_PUBLIC_GATE_WORD production`, then
`vercel env add NEXT_PUBLIC_GATE_WORD production --no-sensitive`, then `pnpm run deploy`. Locally, edit `web/.env.local`.

`NEXT_PUBLIC_GATE_DISABLED=1` builds the site without the gate, for local audits only: the build throws if it is set
together with `VERCEL` or `CI` (`src/lib/gateEnv.ts`).

## Scroll and motion

- **Smooth scroll** (`src/components/SmoothScroll.tsx`): Lenis, only on a real desktop
  (`(min-width: 1024px) and (hover: hover)`) and never under `prefers-reduced-motion`. It runs inside the gate.
- **Section pins** (`src/lib/scrollPins.ts`): Race, Departures and Events hold still for 60% of a viewport while their
  entrance plays, on the same desktop query and without reduced motion.
- **Reduced motion**: every entrance shows its final state. `src/test/reducedMotion.test.tsx` covers the
  introduction, a profile and the sections of the media, emojis, polls, rhythm, mentions and awards chapters.

## After regenerating the data

1. **Swear words** (`content/badwords.txt`): the pipeline prints the 30 with the most messages; remove what is not a
   swear word and add what is missing, then regenerate.
2. **Conclusion** (`content/conclusion.md`): the build warns while the file still has the draft marker (`BORRADOR` or `DRAFT`). Rewrite
   it and delete the marker.
3. **Copy**: when the pipeline asks, re-read the listed phrases and bump `verifiedOn` in `report.config.json`.

## Deploy

See "Deploy notes", "Demo" and "Access gate" in `docs/development.md` (repo root).
