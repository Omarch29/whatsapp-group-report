# Deploying the report

Only when the developer asks to publish. The report is a static export; this path uses Vercel's CLI from the
developer's machine, without git: only `web/out/` is uploaded, never the chat, `report.config.json`, `content/` or
`data/`. Use the `vercel` CLI, not a Vercel MCP server or the dashboard's git import. Never push the repo to make a
deploy work.

Steps the developer must do themselves are marked **(developer)**: tell them the exact command, then wait until
they say it is done. Never ask for the access word or type it.

## Before the first deploy

1. The report is built: the full run and `cd web && pnpm build` passed (`SKILL.md` step 6).
2. With `"gate": false` in `report.config.json`, warn once: anyone with the link can read the chat's report. Offer
   to turn the gate on (`changes.md`) and go on only with their answer.
3. With `"gate": true`, check that the word is in none of the site's tracked sources (`web/src`, `web/content`,
   `web/app`): `cd web && pnpm vitest run src/lib/gateWord.test.ts` (it reads the word from `web/.env.local` without
   printing it). If it fails because the word is also in tracked files (a common word such as "asado" is in the test
   fixtures), the word is too easy to guess: ask the developer to choose a less common one, put it in
   `web/.env.local` themselves, and run the check again.
4. Tell the developer to open the site locally (`cd web && pnpm dev`, http://localhost:3000) and read the closing
   text before it goes out: it is signed with their name. Go on when they say it is fine (changes: `changes.md`).
5. `vercel --version`. If missing: `npm install -g vercel`.

## First deploy

All commands run in `web/`.

1. **(developer)** `vercel login` (opens the browser).
2. **(developer)** `vercel link`: answer the prompts, create a new project and give it a name. Do not run it with
   `--yes` for them: it would name the project after the folder. If it connects their Git repository to the
   project (or offers to), the answer is no; when it has already connected it, `vercel git disconnect` undoes it.
   The report is deployed from the machine, never from git. It also adds a `VERCEL_OIDC_TOKEN` line to
   `web/.env.local`: leave it, and never remove the developer's own line from that file.
3. Only with `"gate": true`, **(developer)**:
   `vercel env add NEXT_PUBLIC_GATE_WORD production --no-sensitive`
   and type the word at the prompt. `--no-sensitive` lets `vercel pull` read it back, so the local build of the
   deploy bakes it in. Without it the deploy fails.
4. **(developer)** In the Vercel dashboard, project > Settings > Deployment Protection: keep Vercel Authentication
   on **Preview** deployments only, not on production. Production must open for their friends; the word gate guards
   it.
5. `pnpm run deploy`. Never `pnpm deploy`: that is pnpm's own workspace command. The script runs
   `vercel pull --yes --environment=production`, `vercel build --prod` and `vercel deploy --prebuilt --prod`.
6. Give the developer the production URL it prints. They send it to the group and share the word themselves.

The site always carries `noindex`, so search engines do not list it.

## Later deploys

After any change (`changes.md`): rerun what the change needs, then `cd web && pnpm run deploy`.

## Changing the access word

1. **(developer)** `vercel env rm NEXT_PUBLIC_GATE_WORD production`
2. **(developer)** `vercel env add NEXT_PUBLIC_GATE_WORD production --no-sensitive` and type the new word.
3. **(developer)** Put the same word in `web/.env.local` for local builds.
4. `cd web && pnpm run deploy` (it pulls the new word first).

Everyone who already unlocked the site has to type the new word. The gate keeps casual visitors out; it is not
authentication (the pages are static files).

## If something fails

- `NEXT_PUBLIC_GATE_WORD is not set`: step 3 of the first deploy is missing, or the variable was added as
  sensitive. Ask the developer to remove it and add it again with `--no-sensitive`.
- The URL asks for a Vercel login: Deployment Protection covers production; see step 4 of the first deploy.
- The deploy went to a project the developer does not recognise: `web/.vercel` is linked elsewhere. Ask them to run
  `vercel link` in `web/` and pick their project.
