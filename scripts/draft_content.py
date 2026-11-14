"""Drafts content/people.json, content/nicknames.json and content/badwords.txt from the discovery summary.

Usage (after the discovery run, `build_pipeline.py --until analyze`):
    uv run python -I scripts/draft_content.py --summary data/analysis/summary.json --content content --lang es \
        [--me-raw '<raw contact name of the owner of the export>']

Contact names carry quotes, emoji and invisible characters: the keys of people.json are copied from summary.json
byte for byte, so nobody ever has to retype them. Only files that do not exist yet are written; an existing file is
kept as it is, and a kept people.json is the one nicknames.json is drafted against. --me-raw takes a contact name,
never the export's own "Tú"/"You"; it matches ignoring invisible marks (Unicode Cf) and surrounding spaces. Needs only
summary.json, never the chat export.
"""
from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wa.lang import get_lang  # noqa: E402
from wa.names import QUOTED_RE, SURNAME_MIN_CHARS, YOU, People  # noqa: E402
from wa.slugs import slug  # noqa: E402
from web.language import base_badwords  # noqa: E402

NAMELESS = {"es": "Persona", "en": "Person"}  # short name of a contact with no usable first name (a number, mostly)
_KEEP = "'’-"  # besides letters, what a short name may carry


def _words(raw: str) -> list[str]:
    """The words of a contact name with its quoted nickname dropped: runs of letters, apostrophes and hyphens.
    Invisible format characters (LRM and the like) are dropped; anything else (spaces, emoji, digits) separates."""
    text = unicodedata.normalize("NFC", QUOTED_RE.sub(" ", raw))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Cf")
    text = "".join(ch if ch.isalpha() or ch in _KEEP else " " for ch in text)
    return [w for w in (w.strip(_KEEP) for w in text.split()) if any(ch.isalpha() for ch in w)]


def _is_surname(word: str, surnames: set[str]) -> bool:
    """Whether a whole word ("D'Angelo", not its pieces) is one that the report scrubs as a contact surname."""
    return word.lower() in surnames


def _invisible_free(text: str) -> str:
    """`text` without Unicode format characters (LRM and the like, category Cf) and surrounding whitespace."""
    return "".join(ch for ch in text if unicodedata.category(ch) != "Cf").strip()


def _dedupe(names: dict[int, str], order: list[int]) -> dict[int, str]:
    """`order` (by message count) keeps each name for its first holder; a later holder whose name has the same
    wa.slugs.slug (the key of a profile) gets " 2", " 3", ..."""
    taken: set[str] = set()
    out = {}
    for i in order:
        name, n = names[i], 1
        while slug(name) in taken:
            n += 1
            name = f"{names[i]} {n}"
        out[i] = name
        taken.add(slug(name))
    return out


def draft_people(summary: dict, me_raw: str | None, lang: str) -> dict:
    """The people.json object {"me", "group", "people", "aliases"} for the people of `summary`.

    Short name: the first word of the raw name (see _words), whole: "D'Angelo", "Jean-Pierre". A first word is a first
    name, except when it is also a later word of ANOTHER contact name and wa.names.People.contact_surnames takes it for
    a surname (the report scrubs those: "Rodrigo" next to "Juan Rodrigo", or "Rivas Ana" saved surname first next to
    "Tomás Rivas"); then the quoted nickname, or else "Persona N": the code cannot tell a given name from a surname
    written first, so it never drafts with the word. A raw name with no letter gets "Persona N" ("Person N" in en),
    numbered by message count. Shorts with the same wa.slugs.slug ("Martín", "Martin") collide: each
    gets the initial of its next word ("Juan P."); what still collides gets " 2", " 3" by message count."""
    rows = summary.get("people") or []
    raws = [r["raw"] for r in rows]
    order = sorted(range(len(rows)), key=lambda i: -rows[i].get("msgs", 0))  # stable: ties keep summary order
    surnames = People(names={r: "" for r in raws}).contact_surnames()
    own = [_words(r) for r in raws]
    later = [{w.casefold() for w in ws[1:]} for ws in own]  # each contact's non-first words

    def taken_as_surname(i: int, word: str) -> bool:
        return (sum(ch.isalpha() for ch in word) >= SURNAME_MIN_CHARS and _is_surname(word, surnames)
                and any(word.casefold() in later[j] for j in range(len(rows)) if j != i))

    words: dict[int, list[str]] = {}
    for i, r in enumerate(rows):
        nick = _words(r.get("quoted_nickname") or "")
        if own[i] and not taken_as_surname(i, own[i][0]):
            words[i] = own[i]
        elif nick and not _is_surname(nick[0], surnames):
            words[i] = nick[:1]  # the nickname stands alone: no next word to disambiguate with
    nameless = [i for i in order if i not in words]
    short = {i: f"{NAMELESS[lang]} {n}" for n, i in enumerate(nameless, 1)}
    short.update({i: w[0] for i, w in words.items()})

    groups: dict[str, list[int]] = {}
    for i in words:
        groups.setdefault(slug(short[i]), []).append(i)
    for members in groups.values():
        if len(members) > 1:
            for i in members:
                if len(words[i]) > 1:
                    short[i] = f"{words[i][0]} {words[i][1][0].upper()}."
    short = _dedupe(short, order)

    me = None
    if me_raw is not None:
        match = next((i for i, r in enumerate(raws) if r == me_raw), None)
        if match is None:
            match = next((i for i, r in enumerate(raws) if _invisible_free(r) == _invisible_free(me_raw)), None)
        if match is None:
            raise ValueError(f"--me-raw {me_raw!r} is not a contact name of the summary; its contact names are: "
                             + ", ".join(repr(r) for r in raws))
        me = short[match]
    aliases = sorted({r["quoted_nickname"].lower() for r in rows if r.get("quoted_nickname")})
    return {"me": me, "group": list(summary.get("group_names") or []),
            "people": {raws[i]: short[i] for i in range(len(rows))}, "aliases": aliases}


def draft_nicknames(summary: dict, people: dict) -> dict:
    """Short name -> quoted nickname of the contact name, for every person whose contact name has one."""
    names = people["people"]
    out = {}
    for r in summary.get("people") or []:
        nick, short = r.get("quoted_nickname"), names.get(r["raw"])
        if nick and short and nick != short:
            out[short] = nick
    return out


def _load_summary(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise SystemExit(f"cannot read {path}: {e}") from e
    if not isinstance(data, dict) or not isinstance(data.get("people"), list) or not all(
            isinstance(r, dict) and isinstance(r.get("raw"), str) for r in data["people"]):
        raise SystemExit(f"{path} is not a summary.json (run build_pipeline.py --until analyze first)")
    return data


def _kept_people(path: Path) -> dict:
    """The people.json object of an existing file, for drafting nicknames against its short names."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise SystemExit(f"cannot read {path}: {e}") from e
    names = data.get("people", {}) if isinstance(data, dict) else None
    if not isinstance(names, dict):
        raise SystemExit(f"{path} is not a people.json object (fix it or move it away and run again)")
    return {**data, "people": names}


def _json(data) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def run(argv: list[str]) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--summary", default="data/analysis/summary.json")
    ap.add_argument("--content", default="content")
    ap.add_argument("--lang", choices=["es", "en"], required=True, help="language of the chat")
    ap.add_argument("--me-raw", default=None, help="raw contact name of the export's owner, as in summary.json")
    args = ap.parse_args(argv)

    if args.me_raw is not None and args.me_raw.strip() in YOU:
        raise SystemExit(f"--me-raw {args.me_raw!r} is how the export names its owner, not a contact name: pass your "
                         f"contact name from the list, or leave --me-raw out and set \"me\" in people.json by hand "
                         f"when the export only shows you as Tú/You")
    summary = _load_summary(Path(args.summary))
    try:
        people = draft_people(summary, args.me_raw, args.lang)
    except ValueError as e:
        raise SystemExit(str(e)) from e
    content = Path(args.content)
    kept_people = content / "people.json"
    if kept_people.exists() and not (content / "nicknames.json").exists():
        people = _kept_people(kept_people)  # nicknames are keyed by the short names the report will use
    drafts = {
        "people.json": _json(people),
        "nicknames.json": _json(draft_nicknames(summary, people)),
        "badwords.txt": "".join(f"{w}\n" for w in sorted(base_badwords(get_lang(args.lang)))),
    }
    content.mkdir(parents=True, exist_ok=True)
    for name, text in drafts.items():
        path = content / name
        if path.exists():
            print(f"kept {path} (already exists)")
        else:
            path.write_text(text, encoding="utf-8")
            print(f"wrote {path}")


def main() -> None:
    run(sys.argv[1:])


if __name__ == "__main__":
    main()
