"""El pipeline completo sobre el chat ficticio de 8.000 líneas (conftest.synth_data): cada capítulo con datos, en
castellano y en inglés, y ningún apellido del elenco en lo publicado."""
import json
import re

import pytest
from conftest import ROOT

from wa.names import load_people

ES_DAYS = {"lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"}
EN_DAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}


def _load(path):
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize("lang", ["es", "en"])
def test_every_chapter_populated(lang, synth_data):
    d = synth_data(lang)
    g = _load(d / "global.json")
    assert g["lang"] == lang and g["platform"] == "ios"
    assert len(g["people"]) >= 9
    assert len(list((d / "people").glob("*.json"))) == 9
    departures = _load(d / "departures.json")
    assert departures["person"] == {"slug": "bruno", "name": "Bruno"}
    assert departures["reentries"] == 3
    assert departures["complaints"] and departures["quotesRepeated"]
    assert _load(d / "polls.json")["total"] == 6
    assert len(_load(d / "lore.json")) >= 8
    emojis = _load(d / "emojis.json")
    assert emojis["top"] and emojis["signature"] and emojis["byYear"]
    mentions = _load(d / "mentions.json")
    assert mentions["mostMentioned"] is not None and mentions["topTagger"] is not None
    assert len(_load(d / "events.json")) == 3
    lang_json = _load(d / "language.json")
    assert lang_json["laughs"]["byPerson"][0]["mix"][0]["key"] == ("jaja" if lang == "es" else "haha")
    assert all(lang_json["muletillas"].values())
    assert _load(d / "awards.json")[0]["title"] == ("Más mensajes" if lang == "es" else "Most messages")
    assert _load(d / "facts.json")["peakDow"] in (ES_DAYS if lang == "es" else EN_DAYS)
    media = _load(d / "media.json")
    assert media["audios"]["byPerson"] and media["links"]["domains"]
    rhythm = _load(d / "rhythm.json")
    assert rhythm["latency"] and rhythm["fastest"] is not None
    census = _load(d / "census.json")
    assert census["timeline"] and census["earlyBird"] is not None and census["owl"] is not None
    assert census["absence"]["slug"] == "juli" and census["absence"]["days"] >= 40  # story.SILENCE


def test_android_synth_turns_audios_off(synth_android_data):
    g = _load(synth_android_data / "global.json")
    assert (g["platform"], g["timeResolution"]) == ("android", "minute")
    assert _load(synth_android_data / "media.json")["audios"]["byPerson"] == []


def test_android_synth_minute_resolution(synth_android_data):
    """Sin segundos, las respuestas del mismo minuto cuentan (las medianas no son todas 60 s) y no hay premio al más
    rápido."""
    medians = [x[k] for x in _load(synth_android_data / "rhythm.json")["latency"] for k in ("medianToSec", "medianFromSec")]
    assert medians and set(medians) != {60.0}
    awards = _load(synth_android_data / "awards.json")
    assert len(awards) == 11 and "fastest" not in {a["id"] for a in awards}
    assert _load(synth_android_data / "facts.json")["fastest"] is None


@pytest.mark.parametrize("lang,platform", [("es", "ios"), ("en", "ios"), ("es", "android")])
def test_no_surnames_in_synth_output(lang, platform, synth_data):
    """Ni apellidos ni nombres de contacto completos en lo publicado; en Android las menciones son @Nombre en texto
    plano (sin aisladores) y también se limpian."""
    d = synth_data(lang, platform)
    people = load_people(d.parent / "content" / "people.json")
    surnames = people.contact_surnames()
    assert {"castro", "rivas"} <= surnames
    pattern = re.compile(r"\b(" + "|".join(sorted(map(re.escape, surnames))) + r")\b", re.IGNORECASE)
    raw_full = [n for n in people.raw_names if " " in n]
    for path in sorted(d.rglob("*.json")):
        text = path.read_text(encoding="utf-8")
        assert not pattern.search(text), (path.name, pattern.search(text))
        assert not [n for n in raw_full if n in text or json.dumps(n)[1:-1] in text], path.name


def test_published_example_is_the_synth_chat(synth_data):
    """web/data/example y content/example son el chat ficticio en es/iOS tal cual (salvo generatedAt): si cambia el
    generador o el pipeline, hay que regenerarlos (docs/development.md, "Synthetic chat")."""
    d = synth_data("es")
    example = ROOT / "web" / "data" / "example"
    built = sorted(p.relative_to(d) for p in d.rglob("*.json"))
    assert built == sorted(p.relative_to(example) for p in example.rglob("*.json"))
    for rel in built:
        a, b = _load(d / rel), _load(example / rel)
        if rel.name == "global.json":
            a.pop("generatedAt"), b.pop("generatedAt")
        assert a == b, rel
    for f in ("people.json", "events.json", "nicknames.json", "badwords.txt", "conclusion.md"):
        assert (d.parent / "content" / f).read_bytes() == (ROOT / "content" / "example" / f).read_bytes(), f
