"""Construye (y deploya) una de las dos demos públicas: el chat ficticio "Los del Parque", sin puerta.

Uso (desde la raíz del repo):
    uv run python -I scripts/demo_deploy.py --lang es|en [--mode full|single] [--no-deploy]

Todo lo que genera va a rutas solo de la demo, así que nunca pisa tus datos:
    chats/synth-<lang>-ios.txt  content/demo-<lang>/  report.config.demo-<lang>.json
    data/demo-<lang>/{messages.parquet,analysis/}  web/data/demo-<lang>/
Luego, en web/ con WGR_DATA_DIR y WGR_CONTENT_DIR apuntando ahí: `pnpm build` y `pnpm check:en`.
--mode (por defecto full) elige el informe completo o la página única; single exige --no-deploy porque las demos
públicas son full.
Con --no-deploy termina ahí y no invoca vercel. Sin él: `vercel link --yes --project whatsapp-group-report-<lang>`
(solo si web/.vercel no apunta ya a ese proyecto), `vercel pull --yes --environment=production`, `vercel build --prod`
y `vercel deploy --prebuilt --prod`.
Es para quienes mantienen las demos públicas. web/.vercel guarda un solo proyecto linkeado: alternar entre es y en
vuelve a linkear, y si web/.vercel apuntaba a otro proyecto (tu propio reporte) el script avisa antes de re-linkear;
después, `vercel link` en web/ lo vuelve a apuntar a tu proyecto.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_pipeline  # noqa: E402
import synth_chat  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
TITLES = {"es": "Los del Parque", "en": "The Park Crew"}
DEMO_PROJECTS = {f"whatsapp-group-report-{lang}" for lang in TITLES}


def _exec(argv: list[str], *, cwd: Path, env: dict[str, str]) -> None:
    subprocess.run(argv, cwd=cwd, env=env, check=True)


def _linked_project(web: Path) -> str | None:
    try:
        return json.loads((web / ".vercel" / "project.json").read_text(encoding="utf-8")).get("projectName")
    except (OSError, ValueError):
        return None


def run(argv: list[str], *, root: Path = ROOT, vercel=_exec, pnpm=_exec, synth=synth_chat.run,
        pipeline=build_pipeline.run) -> None:
    """`vercel` y `pnpm` se llaman como f(argv, cwd=..., env=...); los tests pasan falsos."""
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lang", choices=sorted(TITLES), required=True)
    ap.add_argument("--mode", choices=["full", "single"], default="full")
    ap.add_argument("--no-deploy", action="store_true", help="frena tras el build y el chequeo de idioma")
    args = ap.parse_args(argv)
    if args.mode == "single" and not args.no_deploy:
        ap.exit(2, "the public demos are full mode: --mode single needs --no-deploy\n")
    lang = args.lang

    chat = root / "chats" / f"synth-{lang}-ios.txt"
    content = root / "content" / f"demo-{lang}"
    config = root / f"report.config.demo-{lang}.json"
    data = root / "data" / f"demo-{lang}"
    web = root / "web"
    web_data = web / "data" / f"demo-{lang}"

    synth(["--lang", lang, "--platform", "ios", "--seed", "7", "--lines", "8000",
           "--out", str(chat), "--content-out", str(content)])
    cfg = {"title": TITLES[lang], "lang": lang, "mode": args.mode, "chat": str(chat), "background": [], "me": "Ana",
           "departer": "Bruno", "gate": False, "verifiedOn": "2026-11-13"}
    config.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    pipeline(["--config", str(config), "--content", str(content), "--thresholds", "derived",
              "--data", str(data / "messages.parquet"), "--analysis", str(data / "analysis"), "--out", str(web_data)])

    env = {**os.environ, "WGR_DATA_DIR": str(web_data), "WGR_CONTENT_DIR": str(content)}
    pnpm(["pnpm", "build"], cwd=web, env=env)
    pnpm(["pnpm", "check:en"], cwd=web, env=env)
    if args.no_deploy:
        return

    project = f"whatsapp-group-report-{lang}"
    linked = _linked_project(web)
    if linked != project:
        if linked and linked not in DEMO_PROJECTS:
            print(f"WARNING: web/.vercel is linked to {linked!r}; linking it to the demo project {project!r} instead.\n"
                  f"         Afterwards `pnpm run deploy` in web/ would deploy to the demo. To point it back at your own\n"
                  f"         project, run `vercel link` in web/ and pick {linked!r}.", file=sys.stderr)
        vercel(["vercel", "link", "--yes", "--project", project], cwd=web, env=env)
    # vercel build bakes the env pulled into web/.vercel (NEXT_PUBLIC_*): pulling first keeps it current.
    vercel(["vercel", "pull", "--yes", "--environment=production"], cwd=web, env=env)
    vercel(["vercel", "build", "--prod"], cwd=web, env=env)
    vercel(["vercel", "deploy", "--prebuilt", "--prod"], cwd=web, env=env)


if __name__ == "__main__":
    run(sys.argv[1:])
