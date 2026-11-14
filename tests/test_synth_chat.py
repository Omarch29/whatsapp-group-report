"""Generador del chat ficticio (scripts/synth_chat.py, scripts/synth/): determinismo, formatos y contenido."""
import json
from pathlib import Path

import pytest
from conftest import ROOT

import synth_chat
from synth import story
from wa.parser import detect_format, parse_file

SYNTH = ROOT / "tests" / "fixtures" / "synth"
CONTENT_FILES = ("people.json", "events.json", "nicknames.json", "badwords.txt", "conclusion.md")
FORMATS = [("es", "ios"), ("en", "ios"), ("es", "android"), ("en", "android")]


def run_to(out: Path, *args: str) -> Path:
    synth_chat.run(["--out", str(out), *args])
    return out


def test_synth_is_deterministic(tmp_path):
    args = ("--lang", "es", "--platform", "ios", "--seed", "7", "--lines", "400")
    a = run_to(tmp_path / "a.txt", *args)
    b = run_to(tmp_path / "b.txt", *args)
    assert a.read_text(encoding="utf-8") == b.read_text(encoding="utf-8")
    assert 380 <= a.read_text(encoding="utf-8").count("\n") <= 420


def test_story_structure_is_shared_between_languages():
    es, en = story.build(7, "es", 400), story.build(7, "en", 400)
    assert [(e.ts, e.kind, e.sender) for e in es.events] == [(e.ts, e.kind, e.sender) for e in en.events]
    assert [e.body for e in es.events] != [e.body for e in en.events]


@pytest.mark.parametrize("lang,platform", FORMATS)
def test_synth_round_trips_through_parser(lang, platform, tmp_path):
    out = run_to(tmp_path / "c.txt", "--lang", lang, "--platform", platform, "--seed", "7", "--lines", "400")
    fmt = detect_format(str(out))
    assert (fmt["platform"], fmt["lang"]) == (platform, lang)
    assert fmt["date_order"] == ("dmy" if lang == "es" else "mdy")
    msgs = list(parse_file(str(out)))
    kinds = {m.kind for m in msgs}
    assert {"text", "system", "poll", "deleted"} <= kinds
    assert ("media" in kinds) == (platform == "android")
    assert sum(m.sys_event == "left" for m in msgs) >= 3
    assert sum(m.sys_event in ("added", "joined_link") for m in msgs) >= 4
    assert sum(m.edited for m in msgs) >= 1
    assert not [m for m in msgs if m.kind == "system" and m.sys_event == "other"]


def test_synth_content_files(tmp_path):
    run_to(tmp_path / "c.txt", "--lang", "es", "--platform", "ios", "--seed", "7", "--lines", "400",
           "--content-out", str(tmp_path / "c"))
    p = json.loads((tmp_path / "c" / "people.json").read_text(encoding="utf-8"))
    assert p["me"] == "Ana" and len(p["people"]) >= 9
    assert p["group"] == ["Los del Parque 🌳"] and p["people"]["Tú"] == "Ana"
    assert len(json.loads((tmp_path / "c" / "events.json").read_text(encoding="utf-8"))) == 3
    assert len(json.loads((tmp_path / "c" / "nicknames.json").read_text(encoding="utf-8"))) == 8
    assert (tmp_path / "c" / "conclusion.md").read_text(encoding="utf-8").rstrip().endswith("— Ana")


def test_date_order_flag(tmp_path):
    out = run_to(tmp_path / "c.txt", "--lang", "es", "--platform", "android", "--seed", "7", "--lines", "400",
                 "--date-order", "mdy")
    assert detect_format(str(out))["date_order"] == "mdy"


@pytest.mark.parametrize("lang,platform", FORMATS)
def test_committed_fixture_is_reproducible(lang, platform, tmp_path):
    out = run_to(tmp_path / "c.txt", "--lang", lang, "--platform", platform, "--seed", "7", "--lines", "400")
    assert out.read_bytes() == (SYNTH / f"{platform}-{lang}.txt").read_bytes()


@pytest.mark.parametrize("lang", ["es", "en"])
def test_committed_content_is_reproducible(lang, tmp_path):
    run_to(tmp_path / "c.txt", "--lang", lang, "--platform", "ios", "--seed", "7", "--lines", "400",
           "--content-out", str(tmp_path / "c"))
    for name in CONTENT_FILES:
        assert (tmp_path / "c" / name).read_bytes() == (SYNTH / f"content-{lang}" / name).read_bytes(), name


SCRIPTED_TEXT = {"catch", "quote", "quote_rep", "complain_exit", "complain", "accuse", "scene_reply", "back",
                 "welcome", "welcome_back", "poll_react"}


@pytest.fixture(scope="module")
def big_es():
    return story.build(7, "es", 8000)


def test_synth_8000_quotas(big_es):
    from collections import Counter
    from datetime import timedelta

    from synth import cast

    s, v = big_es, cast.vocab("es")
    texts = [e for e in s.events if e.kind in ("text", "edited")]
    # ninguna oración de 5+ palabras de plantilla sale más de 3 veces en toda la historia
    long = Counter(" ".join(w) for e in texts if e.role not in SCRIPTED_TEXT
                   for w in [story.norm_tokens(e.body)] if len(w) >= story.QUOTE_WORDS)
    assert max(long.values()) <= story.MAX_TEXT_USES, long.most_common(3)
    words = [Counter(story.norm_tokens(e.body)) for e in texts]
    for word, _ in v.LORE:
        assert sum(c[story.norm_tokens(word)[0]] for c in words) >= 20, word
    for owner, phrases in v.CATCH.items():
        for phrase in phrases:
            own = sum(e.sender == owner and phrase in e.body for e in texts)
            assert own >= 12, (owner, phrase, own)
    for q in v.QUOTES:
        assert sum(e.sender != "Bruno" and q in e.body for e in texts) >= 3, q
    bruno = [e for e in s.events if e.kind.startswith("system:") and e.tag.get("who") == "Bruno"]
    assert [e.kind for e in bruno] == ["system:left", "system:joined_link", "system:left", "system:added",
                                       "system:left", "system:joined_link"]
    assert [e.tag.get("by") for e in bruno if e.kind == "system:added"] == ["Ana"]
    polls = [e for e in s.events if e.kind == "poll"]
    assert len(polls) == 6 and [sum(p.tag["votes"]) for p in polls].count(9) == 1
    morning = v.CATCH["Dani"][0]  # "buen día familia": solo antes del mediodía
    assert all(e.ts.hour < 12 for e in texts if e.tag.get("catch") == ("Dani", 0)), morning
    pairs = zip(s.events, s.events[1:], strict=False)
    assert all(a.sender != b.sender for a, b in pairs if a.role == "ask" and b.role == "answer")
    assert len({e.tag["doc"] for e in s.events if e.kind == "media:document"}) >= 8
    days = Counter(e.ts.date() for e in s.events)
    mean = len(s.events) / ((max(days) - min(days)) / timedelta(days=1) + 1)
    for ev, day in s.event_days.items():
        assert days[day] >= 5 * mean, (ev, days[day], mean)
    quiet, _, n_days = story.SILENCE  # sigue en el grupo pero no escribe: el récord de ausencia del censo
    active = sorted({e.ts.date() for e in s.events if e.sender == quiet})
    gaps = sorted(((b - a).days for a, b in zip(active, active[1:])), reverse=True)
    assert gaps[0] >= n_days and gaps[1] < 30, gaps[:3]


def test_synth_8000_departer_quotes_are_brunos(big_es, tmp_path):
    import build_dataset
    import group_report
    from synth.render import content_files, render
    from wa.lang import get_lang
    from wa.locales import LOCALES
    from wa.names import load_people

    chat = tmp_path / "chat.txt"
    chat.write_text("\n".join(render(big_es, LOCALES[("ios", "es")], "dmy")) + "\n", encoding="utf-8")
    people_json = tmp_path / "people.json"
    people_json.write_text(content_files(big_es, get_lang("es"))["people.json"], encoding="utf-8")
    df = build_dataset.build([(str(chat), "main")], load_people(people_json))
    group = df[df["chat"] == "main"].sort_values("ts").reset_index(drop=True)
    group["sender"] = group["sender"].astype(str)
    quotes = group_report.departer_quotes(group, ["Bruno", "Brujo"], get_lang("es"))
    from synth import cast

    assert {q["phrase"] for q in quotes["repeated"]} == set(cast.vocab("es").QUOTES)


def test_english_swear_fallback_is_english():
    """El respaldo corto de las puteadas (vocab BAD_FALLBACK) sale del vocabulario del idioma: nada de "che" en inglés."""
    import re

    bad = [e.body for e in story.build(7, "en", 8000).events if e.role == "badword"]
    assert bad and not [b for b in bad if re.match(r"(?:che|uy|ay|uh|uff)\b", b, re.IGNORECASE)]
