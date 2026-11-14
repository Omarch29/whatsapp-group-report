import json
import re

import pytest

import draft_content
from draft_content import draft_nicknames, draft_people
from conftest import ROOT
from wa.names import People, load_people

SUMMARY = {"group_names": ["Los del Parque 🌳"], "people": [
    {"raw": 'Tomi "Tomate" Suárez🍅', "msgs": 50, "quoted_nickname": "Tomate"},
    {"raw": "Juan Pérez", "msgs": 40, "quoted_nickname": None},
    {"raw": "Juan García", "msgs": 30, "quoted_nickname": None},
    {"raw": "+54 9 11 5555-0101", "msgs": 20, "quoted_nickname": None},
    {"raw": "Ana Rivas", "msgs": 10, "quoted_nickname": None}]}


def summary_file(tmp_path, summary=SUMMARY):
    """Writes `summary` as summary.json under tmp_path and returns its path."""
    path = tmp_path / "summary.json"
    path.write_text(json.dumps(summary, ensure_ascii=False), encoding="utf-8")
    return path


def _summary(*rows):
    return {"group_names": [], "people": [{"quoted_nickname": None, **r} for r in rows]}


def test_people_draft():
    p = draft_people(SUMMARY, me_raw="Ana Rivas", lang="es")
    assert p["me"] == "Ana" and p["group"] == ["Los del Parque 🌳"] and p["aliases"] == ["tomate"]
    assert p["people"] == {'Tomi "Tomate" Suárez🍅': "Tomi", "Juan Pérez": "Juan P.", "Juan García": "Juan G.",
                           "+54 9 11 5555-0101": "Persona 1", "Ana Rivas": "Ana"}


def test_no_draft_short_name_carries_digits_or_a_surname():
    shorts = draft_people(SUMMARY, None, "en")["people"].values()
    assert "Person 1" in shorts and not any(re.search(r"\d{3}", s) for s in shorts)
    assert not any(w in s for s in shorts for w in ("Pérez", "García", "Suárez", "Rivas"))


def test_nicknames_draft():
    assert draft_nicknames(SUMMARY, draft_people(SUMMARY, None, "es")) == {"Tomi": "Tomate"}


def test_run_never_overwrites(tmp_path, capsys):
    (tmp_path / "people.json").write_text("{}")
    draft_content.run(["--summary", str(summary_file(tmp_path)), "--content", str(tmp_path), "--lang", "es"])
    out = capsys.readouterr().out
    assert (tmp_path / "people.json").read_text() == "{}" and "kept" in out
    assert (tmp_path / "badwords.txt").is_file() and "wrote" in out


def test_draft_people_loads(tmp_path):
    path = tmp_path / "people.json"
    path.write_text(json.dumps(draft_people(SUMMARY, "Ana Rivas", "es")))
    assert load_people(path).canonical("Juan Pérez") == "Juan P."


def test_run_creates_the_content_dir_and_writes_exact_keys(tmp_path, capsys):
    content = tmp_path / "new" / "content"
    draft_content.run(["--summary", str(summary_file(tmp_path)), "--content", str(content), "--lang", "es",
                       "--me-raw", "Ana Rivas"])
    out = capsys.readouterr().out.splitlines()
    assert out == [f"wrote {content / n}" for n in ("people.json", "nicknames.json", "badwords.txt")]
    people = json.loads((content / "people.json").read_text(encoding="utf-8"))
    assert list(people["people"]) == [p["raw"] for p in SUMMARY["people"]] and people["me"] == "Ana"
    assert json.loads((content / "nicknames.json").read_text(encoding="utf-8")) == {"Tomi": "Tomate"}
    words = (content / "badwords.txt").read_text(encoding="utf-8").splitlines()
    assert words and words == sorted(words)


def test_invisible_characters_and_emoji_only_names():
    s = _summary({"raw": "‎Lucas Benítez 🌚", "msgs": 9}, {"raw": "🌳🌳", "msgs": 5},
                 {"raw": "+54 11 5555-0102", "msgs": 7})
    people = draft_people(s, None, "es")["people"]
    assert people == {"‎Lucas Benítez 🌚": "Lucas", "🌳🌳": "Persona 2", "+54 11 5555-0102": "Persona 1"}


def test_quoted_nickname_at_the_start_of_the_name():
    s = _summary({"raw": '"Brujo" Bruno Castro', "msgs": 9, "quoted_nickname": "Brujo"},
                 {"raw": "“Flo” Flor Paredes", "msgs": 5, "quoted_nickname": "Flo"})
    p = draft_people(s, None, "es")
    assert p["people"]['"Brujo" Bruno Castro'] == "Bruno" and p["aliases"] == ["brujo", "flo"]
    # wa.names.QUOTED_RE knows the curly quotes too: "flor" is not a surname of “Flo” Flor Paredes.
    assert p["people"]["“Flo” Flor Paredes"] == "Flor"
    surnames = People(names=p["people"]).contact_surnames()
    assert not any(short.lower() in surnames for short in p["people"].values())


def test_three_people_sharing_a_first_name():
    s = _summary({"raw": "Nico Sosa", "msgs": 30}, {"raw": "Nico Sánchez", "msgs": 20}, {"raw": "Nico", "msgs": 10},
                 {"raw": "Nico 🍕", "msgs": 5})
    assert draft_people(s, None, "es")["people"] == {"Nico Sosa": "Nico S.", "Nico Sánchez": "Nico S. 2",
                                                     "Nico": "Nico", "Nico 🍕": "Nico 2"}


def test_empty_people_list():
    assert draft_people({"group_names": [], "people": []}, None, "en") == {"me": None, "group": [], "people": {},
                                                                           "aliases": []}


def test_unknown_me_raw_is_a_one_line_error(tmp_path):
    with pytest.raises(SystemExit) as e:
        draft_content.run(["--summary", str(summary_file(tmp_path)), "--content", str(tmp_path), "--lang", "es",
                           "--me-raw", "Nadie"])
    assert "Nadie" in str(e.value) and "\n" not in str(e.value)
    assert "'Ana Rivas'" in str(e.value) and "'Juan Pérez'" in str(e.value)  # the names it could have been


@pytest.mark.parametrize("text", [None, "{not json", "[]"])
def test_missing_or_malformed_summary_is_a_one_line_error(tmp_path, text):
    path = tmp_path / "summary.json"
    if text is not None:
        path.write_text(text, encoding="utf-8")
    with pytest.raises(SystemExit) as e:
        draft_content.run(["--summary", str(path), "--content", str(tmp_path / "c"), "--lang", "es"])
    assert str(path) in str(e.value) and "\n" not in str(e.value)
    assert not (tmp_path / "c").exists()


@pytest.mark.parametrize("you", ["Tú", "You"])
def test_me_raw_as_the_exports_you_is_a_one_line_error(tmp_path, you):
    content = tmp_path / "content"
    with pytest.raises(SystemExit) as e:
        draft_content.run(["--summary", str(summary_file(tmp_path)), "--content", str(content), "--lang", "es",
                           "--me-raw", you])
    msg = str(e.value)
    assert you in msg and "--me-raw" in msg and '"me"' in msg and "\n" not in msg
    assert not content.exists()


def test_nicknames_follow_a_kept_people_json(tmp_path, capsys):
    kept = draft_people(SUMMARY, "Ana Rivas", "es")
    kept["people"]['Tomi "Tomate" Suárez🍅'] = "Tomás"  # the developer renamed the short name
    (tmp_path / "people.json").write_text(json.dumps(kept, ensure_ascii=False), encoding="utf-8")
    draft_content.run(["--summary", str(summary_file(tmp_path)), "--content", str(tmp_path), "--lang", "es"])
    assert json.loads((tmp_path / "nicknames.json").read_text(encoding="utf-8")) == {"Tomás": "Tomate"}
    assert f"kept {tmp_path / 'people.json'}" in capsys.readouterr().out


@pytest.mark.parametrize("text", ["{not json", "[]", '{"people": ["Tomi"]}'])
def test_unreadable_kept_people_json_is_a_one_line_error(tmp_path, text):
    content = tmp_path / "content"
    content.mkdir()
    (content / "people.json").write_text(text, encoding="utf-8")
    with pytest.raises(SystemExit) as e:
        draft_content.run(["--summary", str(summary_file(tmp_path)), "--content", str(content), "--lang", "es"])
    assert str(content / "people.json") in str(e.value) and "\n" not in str(e.value)
    assert sorted(p.name for p in content.iterdir()) == ["people.json"]  # nothing written


def _scrubbed(people: dict) -> list[str]:
    """Drafted short names with a word (4 or more letters) that People.contact_surnames() takes for the surname of
    ANOTHER contact of the map: the report would scrub it, and the short name would publish a surname."""
    out = []
    for raw, short in people.items():
        others = People(names={r: s for r, s in people.items() if r != raw}).contact_surnames()
        if any(len(w) >= 4 and w in others for w in re.findall(r"\w+", short.lower())):
            out.append(short)
    return out


def test_short_names_that_share_a_slug_are_a_collision():
    from wa.slugs import slug

    s = _summary({"raw": "José Pérez", "msgs": 30}, {"raw": "Jose García", "msgs": 20})
    people = draft_people(s, None, "es")["people"]
    assert people == {"José Pérez": "José P.", "Jose García": "Jose G."}
    assert len({slug(v) for v in people.values()}) == 2
    assert not any(w in v for v in people.values() for w in ("Pérez", "García"))


def test_one_word_names_that_share_a_slug_get_a_number():
    from wa.slugs import slug

    people = draft_people(_summary({"raw": "Martín", "msgs": 300}, {"raw": "Martin", "msgs": 200}), None, "es")["people"]
    assert people == {"Martín": "Martín", "Martin": "Martin 2"}
    assert len({slug(v) for v in people.values()}) == 2


@pytest.mark.parametrize("raw, short", [("D'Angelo Russell", "D'Angelo"), ("O'Brien", "O'Brien"),
                                        ("Jean-Pierre Dupont", "Jean-Pierre")])
def test_apostrophes_and_hyphens_keep_the_first_name(raw, short):
    people = draft_people(_summary({"raw": raw, "msgs": 9}, {"raw": "Ana Rivas", "msgs": 5}), None, "en")["people"]
    assert people[raw] == short and _scrubbed(people) == []


def test_a_first_name_that_is_another_contacts_second_name():
    s = _summary({"raw": "Juan Rodrigo", "msgs": 30}, {"raw": "Rodrigo Pérez", "msgs": 20},
                 {"raw": "Rodrigo", "msgs": 10}, {"raw": 'Rodrigo "Charly"', "msgs": 5, "quoted_nickname": "Charly"})
    people = draft_people(s, None, "es")["people"]
    assert people == {"Juan Rodrigo": "Juan", "Rodrigo Pérez": "Persona 1", "Rodrigo": "Persona 2",
                      'Rodrigo "Charly"': "Charly"}
    assert _scrubbed(people) == []


def test_a_surname_first_contact_never_drafts_with_the_surname():
    s = _summary({"raw": "Tomás Rivas", "msgs": 30}, {"raw": "Rivas Ana", "msgs": 20})
    people = draft_people(s, None, "es")["people"]
    assert people == {"Tomás Rivas": "Tomás", "Rivas Ana": "Persona 1"}
    assert not any("rivas" in v.lower() for v in people.values()) and _scrubbed(people) == []
    nick = _summary({"raw": "Tomás Rivas", "msgs": 30}, {"raw": 'Rivas "Anita" Ana', "msgs": 20, "quoted_nickname": "Anita"})
    assert draft_people(nick, None, "es")["people"]['Rivas "Anita" Ana'] == "Anita"


def test_the_invariant_checks_every_word():
    assert _scrubbed({"Tomás Rivas": "Tomás", "Rivas Ana": "Rivas A."}) == ["Rivas A."]


def test_no_drafted_short_name_is_scrubbed_on_the_synthetic_cast():
    people = json.loads((ROOT / "content" / "example" / "people.json").read_text(encoding="utf-8"))["people"]
    rows = [{"raw": r, "msgs": 100 - i, "quoted_nickname": None} for i, r in enumerate(people) if r not in ("Tú", "You")]
    drafted = draft_people({"group_names": [], "people": rows}, None, "es")["people"]
    assert drafted == {r: s for r, s in people.items() if r in drafted}
    assert _scrubbed(drafted) == []


@pytest.mark.parametrize("given", ["Ana Rivas", " Ana Rivas ", "‎Ana Rivas", "Ana⁨ Rivas⁩"])
def test_me_raw_matches_without_invisible_marks(given):
    s = _summary({"raw": "‎Ana Rivas‎", "msgs": 9}, {"raw": "Tomi", "msgs": 5})
    assert draft_people(s, given, "es")["me"] == "Ana"
