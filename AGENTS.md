# whatsapp-group-report

Turns a WhatsApp group export into a static web report (chapters, charts, records, profiles, the group's own words).
A deterministic Python pipeline (`scripts/`) reads the export in `chats/` plus the editorial files in `content/` and
writes JSON into `web/data/`; a static Next.js site (`web/`) renders it.

## The skill

To build, change or deploy a report ("build the report of my WhatsApp group", "armame el informe de mi grupo"),
follow the skill in `.agents/skills/whatsapp-group-report/SKILL.md`. There is one copy; each agent finds it here:

| Agent | Where it reads project skills | How this repo provides it |
|---|---|---|
| Codex | `.agents/skills/` in every directory from the working directory up to the repo root | the folder itself |
| Cursor | `.agents/skills/` and `.cursor/skills/`; also `.claude/skills/` and `.codex/skills/` for compatibility | the folder itself; there is deliberately no `.cursor/skills/` link, which would list the skill once more |
| Claude Code | `.claude/skills/<name>/SKILL.md`; a symlinked skill folder is followed | `.claude/skills/whatsapp-group-report`, a symlink to `../../.agents/skills/whatsapp-group-report` |

Checked on 2026-11-14 against https://developers.openai.com/codex/skills (now served at
https://learn.chatgpt.com/docs/build-skills), https://cursor.com/docs/skills and
https://code.claude.com/docs/en/skills. `CLAUDE.md` imports this file (`@AGENTS.md`).

## Privacy rules

- Never read, quote or commit a chat export. `chats/*`, `content/*` (except `content/example/`), `data/`,
  `report.config.json` and `web/data/*` (except `web/data/example/`) are gitignored: never `git add -f` them.
- The access word lives only in `web/.env.local` (`NEXT_PUBLIC_GATE_WORD`), typed by the developer. Never ask for
  it, echo it or write it into a tracked file.
- No contact surname and no phone number in anything published: `web/data/`, `content/example/`, the README,
  screenshots.
- Examples and tests use only the fictional group "Los del Parque" / "The Park Crew" (Ana, Tomi, Lucas, Bruno,
  Caro, Dani, Flor, Nico, Juli). Never write a real person's or a real group's name.

## Commands

```bash
uv sync && (cd web && pnpm install)                         # dependencies (uv; pnpm 9.15)
uv run python -I scripts/build_pipeline.py --until analyze --chat chats/<file>.txt   # discovery: data/analysis/summary.json
uv run python -I scripts/build_pipeline.py                  # full run: report.config.json + content/ -> web/data/
uv run python -I scripts/check_report.py                    # which chapters are on, off and thin
uv run pytest -q                                            # Python tests
cd web && pnpm test && pnpm lint && pnpm build              # web tests, lint, static export in web/out/
cd web && pnpm run deploy                                   # Vercel, from this machine (never `pnpm deploy`)
```

## Layout

```
chats/          the developer's exports (gitignored)
content/        editorial files: people, nicknames, events, swear words, conclusion (example/ is tracked)
report.config.json   title, lang, mode, chat, me, departer, gate (gitignored; see report.config.example.json)
scripts/        pipeline: wa/ (parser, names, languages), web/ (one module per chapter), build_*.py, analyze.py
data/           parquet and intermediate analysis (gitignored)
web/            Next.js static site; i18n/ holds every UI string (es, en); data/ the generated JSON
tests/          pytest, on a synthetic chat (scripts/synth_chat.py)
docs/design.md  the design (in Spanish)
.agents/skills/ the skill; .claude/skills/ links to it
```

For work inside `web/` (Next.js), read `web/AGENTS.md` first.
