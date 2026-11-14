"""Chat ficticio de "Los del Parque 🌳" en cualquiera de los cuatro formatos de export, con su contenido.

Uso:
    uv run python -I scripts/synth_chat.py --lang es --platform ios --seed 7 --lines 8000 \\
        --out chats/synth-es-ios.txt [--content-out content/example] [--date-order dmy|mdy]

La misma semilla da la misma historia (horas, remitentes, tipos) en los dos idiomas; el idioma solo cambia las
palabras. Con --content-out escribe people.json, events.json, nicknames.json, badwords.txt y conclusion.md.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from synth.render import content_files, render  # noqa: E402
from synth.story import build  # noqa: E402
from wa.lang import get_lang  # noqa: E402
from wa.locales import LOCALES  # noqa: E402

DEFAULT_ORDER = {"es": "dmy", "en": "mdy"}


def run(argv: list[str]) -> None:
    ap = argparse.ArgumentParser(description="Genera un chat de WhatsApp ficticio")
    ap.add_argument("--lang", choices=("es", "en"), default="es")
    ap.add_argument("--platform", choices=("ios", "android"), default="ios")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--lines", type=int, default=8000)
    ap.add_argument("--out", default=None, help="default: chats/synth-<lang>-<platform>.txt")
    ap.add_argument("--content-out", default=None)
    ap.add_argument("--date-order", choices=("dmy", "mdy"), default=None, help="default: dmy en es, mdy en en")
    args = ap.parse_args(argv)
    if args.lines < 100:
        ap.error("--lines debe ser al menos 100 (el guion solo ya ocupa unas 80)")

    story = build(args.seed, args.lang, args.lines)
    lines = render(story, LOCALES[(args.platform, args.lang)], args.date_order or DEFAULT_ORDER[args.lang])
    out = Path(args.out or f"chats/synth-{args.lang}-{args.platform}.txt")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")  # LF en todo sistema: fixtures fijos
    if args.content_out:
        dest = Path(args.content_out)
        dest.mkdir(parents=True, exist_ok=True)
        for name, text in content_files(story, get_lang(args.lang)).items():
            (dest / name).write_text(text, encoding="utf-8", newline="\n")
    people = len({e.sender for e in story.events if e.sender})
    print(f"synth: {len(lines)} líneas, {len(story.events)} mensajes, {people} personas -> {out}", file=sys.stderr)


def main() -> None:
    run(sys.argv[1:])


if __name__ == "__main__":
    main()
