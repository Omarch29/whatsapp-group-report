"""Corre el pipeline completo con un comando: dataset -> resumen -> análisis -> web/data.

Uso (corrida completa, con report.config.json y content/ ya escritos):
    .venv/bin/python -I scripts/build_pipeline.py --config report.config.json --content content

Pasos, cada uno imprime una línea a stderr:
    [1/6] dataset         build_dataset (chat + chats de fondo)       -> data/messages.parquet
    [2/6] resumen         analyze                                      -> data/analysis/summary.json
    [3/6] grupo           group_report (con --departer/--aliases)      -> data/analysis/
    [4/6] eventos         events (content/events.json, si existe)      -> data/analysis/events.json
    [5/6] records         records                                 -> data/analysis/records.json
    [6/6] web             build_web_data                               -> web/data/

Corrida de descubrimiento (primera pasada de la skill, antes de que existan report.config.json y content/):
    .venv/bin/python -I scripts/build_pipeline.py --until analyze --chat chats/_chat.txt \
        --background chats/otro.txt --me Ana [--lang es]
Con --until analyze se frena tras el paso 2 y el chat, los chats de fondo, el dueño del export y el idioma salen
de la línea de comandos en vez de --config (--config puede no existir). Esas cuatro opciones solo valen con
--until analyze. Sin --lang, el idioma es el que wa.parser.detect_format lee en el export. Sin content/people.json
los remitentes quedan con su nombre de contacto crudo.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import analyze  # noqa: E402
import build_dataset  # noqa: E402
import build_web_data  # noqa: E402
import records  # noqa: E402
import events  # noqa: E402
import group_report  # noqa: E402
from config import ConfigError, ReportConfig, load_config  # noqa: E402
from wa.locales import UnknownFormat  # noqa: E402
from wa.names import GROUP, YOU, People, PeopleError, load_people  # noqa: E402
from wa.parser import detect_format  # noqa: E402

STEPS = 6

# Content that a full run cannot do without, and why (checked before any step writes anything).
REQUIRED_CONTENT = (
    ("people.json", "sin él los apellidos de los nombres de contacto llegan al JSON publicado"),
    ("badwords.txt", "el bloque de puteadas del capítulo Lenguaje necesita la lista"),
)


def _step(n: int, text: str) -> None:
    print(f"[{n}/{STEPS}] {text}", file=sys.stderr)


def _one_line(text: str) -> str:
    """A multi-line message (UnknownFormat quotes the export's first lines) as one line."""
    return " | ".join(line.strip() for line in text.splitlines() if line.strip())


def _json_file(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise SystemExit(f"no se pudo leer {path}: {e}") from e


def _aliases(departer: str, people: People, content: Path, explicit: tuple[str, ...] = ()) -> str:
    """Cómo lo llama el chat: su nombre corto y, si el config no trae departerAliases (`explicit`), su apodo de
    nicknames.json y la primera palabra de su nombre de contacto."""
    if explicit:
        return ",".join(dict.fromkeys([departer, *explicit]))
    names = [departer]
    nicknames = content / "nicknames.json"
    if nicknames.is_file():
        data = _json_file(nicknames)
        if isinstance(data, dict) and isinstance(data.get(departer), str):
            names.append(data[departer])
    raw = next((r for r, short in people.names.items() if short == departer and r.strip() not in YOU), "")
    first = raw.split()[0].strip("\"'“”‘’") if raw.split() else ""  # 'Bruno' de 'Bruno "Brujo" Castro'; sin comillas si el nombre empieza con apodo
    if first:
        names.append(first)
    return ",".join(dict.fromkeys(n for n in names if n))


def _config(args: argparse.Namespace) -> ReportConfig:
    cli = (args.chat, args.background, args.me, args.lang)
    if args.until is None:
        if any(v for v in cli):
            raise SystemExit("--chat, --background, --me y --lang solo valen con --until analyze (si no, salen de --config)")
        return load_config(Path(args.config))
    if args.chat is None:
        return load_config(Path(args.config))
    lang = args.lang
    if lang is None:  # el idioma del export (el .txt inexistente lo frena run(), con su propio mensaje)
        try:
            lang = detect_format(args.chat)["lang"] if Path(args.chat).is_file() else "es"
        except UnknownFormat as e:
            raise SystemExit(_one_line(f"{args.chat}: {e}")) from e
    return ReportConfig(title="", chat=args.chat, background=tuple(args.background or ()), me=args.me, lang=lang)


def run(argv: list[str]) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="report.config.json")
    ap.add_argument("--content", default="content", help="carpeta con people.json, nicknames.json, events.json, etc.")
    ap.add_argument("--thresholds", choices=["derived", "legacy"], default="derived")
    ap.add_argument("--min-msgs", type=int, default=None, help="pisa el mínimo de mensajes para tener perfil")
    ap.add_argument("--data", default="data/messages.parquet")
    ap.add_argument("--analysis", default="data/analysis")
    ap.add_argument("--out", default="web/data")
    ap.add_argument("--until", choices=["analyze"], default=None, help="frena tras el paso 2 (corrida de descubrimiento)")
    ap.add_argument("--chat", default=None, help="solo con --until analyze: export del chat principal")
    ap.add_argument("--background", nargs="+", default=None, help="solo con --until analyze: exports de fondo")
    ap.add_argument("--me", default=None, help="solo con --until analyze: nombre corto del dueño del export")
    ap.add_argument("--lang", choices=["es", "en"], default=None, help="solo con --until analyze: idioma del chat (default: el del export)")
    args = ap.parse_args(argv)

    try:
        cfg = _config(args)
        content, analysis = Path(args.content), Path(args.analysis)
        people_json = content / "people.json"
        have_people = people_json.is_file()
        if args.until is None:
            for name, why in REQUIRED_CONTENT:
                if not (content / name).is_file():
                    raise SystemExit(f"falta {content / name}: {why}")

        # 1. dataset
        inputs = [(cfg.chat, "main"), *((bg, f"bg{i}") for i, bg in enumerate(cfg.background))]
        for path, _ in inputs:
            if not Path(path).is_file():
                raise SystemExit(f"no encuentro el chat: {path}")
        _step(1, f"dataset: {len(inputs)} chat(s) -> {args.data}")
        people = load_people(people_json if have_people else None, me=cfg.me)
        df = build_dataset.build(inputs, people)
        Path(args.data).parent.mkdir(parents=True, exist_ok=True)
        df.to_parquet(args.data, index=False)
        if args.until is None:  # el descubrimiento no tiene personas contra las que validar
            known = people.short_names() if have_people else set(df.loc[~df["is_system"], "sender"].astype(str)) - {GROUP}
            cfg.check_people(known)
    except (ConfigError, PeopleError) as e:
        raise SystemExit(str(e)) from e
    except UnknownFormat as e:  # build_dataset names the export that is not one
        raise SystemExit(_one_line(str(e))) from e

    people_arg = ["--people", str(people_json)]
    me_arg = ["--me", cfg.me] if cfg.me else []
    chat_arg = ["--data", args.data, "--chat", "main", "--out", str(analysis)]

    _step(2, "resumen del chat")
    analyze.run(["--data", args.data, "--chat", "main", *people_arg, *me_arg, "--source", cfg.chat,
                 "--lang", cfg.lang, "--out", str(analysis / "summary.json")])
    if args.until == "analyze":
        return

    _step(3, "análisis del grupo")
    departer_arg = []
    if cfg.departer:
        departer_arg = ["--departer", cfg.departer,
                        "--aliases", _aliases(cfg.departer, people, content, cfg.departer_aliases)]
    group_report.run([*chat_arg, "--lang", cfg.lang, *people_arg, *me_arg, *departer_arg])

    events_json = content / "events.json"
    if events_json.is_file():
        _step(4, f"eventos: {events_json}")
        events.run([*chat_arg, "--events", str(events_json)])
    else:
        _step(4, "eventos: sin eventos (no hay content/events.json)")
        analysis.mkdir(parents=True, exist_ok=True)
        (analysis / "events.json").write_text("[]", encoding="utf-8")

    _step(5, "records")
    records.run([*chat_arg, "--thresholds", args.thresholds, "--lang", cfg.lang])

    _step(6, f"web -> {args.out}")
    min_msgs = ["--min-msgs", str(args.min_msgs)] if args.min_msgs is not None else []
    build_web_data.run(["--config", args.config, "--content", str(content), "--data", args.data,
                        "--analysis", str(analysis), "--out", args.out, "--thresholds", args.thresholds, *min_msgs])


def main() -> None:
    run(sys.argv[1:])


if __name__ == "__main__":
    main()
