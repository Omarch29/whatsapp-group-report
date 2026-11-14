"""Says which chapters of the built report are on, which are off and why, and where the report is thin.

Usage (after a full run of build_pipeline.py):
    uv run python -I scripts/check_report.py --data web/data

Prints `on   <id>` or `off  <id>  <reason>` per chapter, in the site's order, then one `thin <what>` line per thin
spot. Exits 0; exits 1 with a one-line message when <data>/global.json is missing or unreadable.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# The seventeen chapters of web/src/chapters/index.ts (CHAPTER_IDS), in the same order.
CHAPTER_IDS = ("censo", "carrera", "horas", "parejas", "lenguaje", "multimedia", "emojis", "encuestas", "ritmo",
               "menciones", "salidas", "eventos", "records", "diccionario", "premios", "personas", "conclusion")
REST_SLUG = "resto"  # the global.json entry for everyone without a profile


class DataError(ValueError):
    """global.json is missing or unreadable."""


def _load(data: Path, name: str):
    """The parsed <data>/<name>, or None when it is missing or not JSON."""
    try:
        return json.loads((data / name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _get(obj, *keys):
    for k in keys:
        obj = obj.get(k) if isinstance(obj, dict) else None
    return obj


def check(data: Path) -> dict:
    """{"chapters": [{"id", "on", "reason"}], "thin": [str]} for the report data in `data` (web/data).

    `on` mirrors chapterFlagsOf in web/src/lib/data.ts (keep both in step): salidas needs a departer, encuestas a
    poll, menciones someone mentioned; every other chapter is always on. DataError when global.json is missing."""
    data = Path(data)
    g = _load(data, "global.json")
    if not isinstance(g, dict):
        raise DataError(f"{data / 'global.json'} is missing or unreadable: run build_pipeline.py first")
    departures, polls, mentions = (_load(data, n) for n in ("departures.json", "polls.json", "mentions.json"))
    media, awards = _load(data, "media.json"), _load(data, "awards.json")
    events, lore = _load(data, "events.json"), _load(data, "lore.json")

    off = {}
    if departures is None:
        off["salidas"] = "departures.json is missing"
    elif _get(departures, "person") is None:
        off["salidas"] = "no departer: set \"departer\" in report.config.json (departures.json person is null)"
    if polls is None:
        off["encuestas"] = "polls.json is missing"
    elif not (_get(polls, "total") or 0) > 0:
        off["encuestas"] = "the chat has no polls (polls.json total is 0)"
    if mentions is None:
        off["menciones"] = "mentions.json is missing"
    elif _get(mentions, "mostMentioned") is None:
        off["menciones"] = "nobody is @mentioned (mentions.json mostMentioned is null)"
    chapters = [{"id": c, "on": c not in off, "reason": off.get(c, "")} for c in CHAPTER_IDS]

    thin = []
    profiles = [p for p in g.get("people") or [] if isinstance(p, dict) and p.get("slug") != REST_SLUG]
    if not profiles:
        thin.append("0 profiles: nobody has enough messages for a profile (everyone is in the rest)")
    if media is not None and not _get(media, "audios", "byPerson"):
        thin.append("multimedia: nobody sent audios (media.json audios.byPerson is empty)")
    awards = awards if isinstance(awards, list) else []
    thin += [f"award {a.get('id')} has no winner" for a in awards if isinstance(a, dict) and a.get("winner") is None]
    if not events:
        thin.append("no events (content/events.json is missing or empty)")
    if not lore:
        thin.append("dictionary: lore.json has no words")
    if g.get("timeResolution") == "minute" and not any(isinstance(a, dict) and a.get("id") == "fastest" for a in awards):
        thin.append("no fastest award: the export has minute resolution (Android keeps no seconds)")
    return {"chapters": chapters, "thin": thin}


def run(argv: list[str]) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default="web/data", help="the report data written by build_pipeline.py")
    args = ap.parse_args(argv)
    try:
        report = check(Path(args.data))
    except DataError as e:
        raise SystemExit(str(e)) from e
    for c in report["chapters"]:
        print(f"on   {c['id']}" if c["on"] else f"off  {c['id']}  {c['reason']}")
    for line in report["thin"]:
        print(f"thin {line}")


def main() -> None:
    run(sys.argv[1:])


if __name__ == "__main__":
    main()
