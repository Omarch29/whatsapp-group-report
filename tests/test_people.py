import json

import pytest
from conftest import FIXTURE

from wa.names import load_people, load_people_cli


def test_canonical_maps_and_keeps_unknown(people):
    assert people.canonical('Bruno "Brujo" Castro') == "Bruno"
    assert people.canonical("Tú") == "Ana"
    assert people.canonical("Los del Parque 🌳") == "__grupo__"
    assert people.canonical("Los del Parque 🌳 (copia)") == "__grupo__"  # el export a veces trunca o alarga el título
    assert people.canonical("  Alguien Nuevo ") == "Alguien Nuevo"
    assert people.canonical("__system__") == "__grupo__"  # avisos sin firma de Android
    assert load_people(None).canonical("__system__") == "__grupo__"


def test_contact_surnames_and_short_names(people):
    assert people.contact_surnames() == {"rivas", "suárez", "benítez", "castro", "méndez"}
    assert people.short_names() == {"Ana", "Tomi", "Lucas", "Bruno", "Caro"}
    assert people.aliases == {"brujo", "tomate", "rulo", "carola", "capitana"}


def test_no_file_keeps_everything():
    p = load_people(None, me="Ana")
    assert p.canonical("Tú") == "Ana" and p.canonical("You") == "Ana" and p.canonical("Zoe Pérez") == "Zoe Pérez"
    assert p.contact_surnames() == set() and p.aliases == frozenset()


def test_explicit_me_beats_the_you_entry_in_the_file(people_path):
    p = load_people(people_path, me="Zoe")  # el archivo mapea "Tú" -> Ana; --me pisa
    assert p.canonical("Tú") == "Zoe" and p.canonical("You") == "Zoe"
    assert p.canonical('Bruno "Brujo" Castro') == "Bruno"
    assert load_people(people_path).canonical("Tú") == "Ana"


def test_empty_group_title_is_dropped(tmp_path):
    f = tmp_path / "people.json"
    f.write_text(json.dumps({"group": ["", "Mi Grupo"], "people": {"Ana Rivas": "Ana"}}), encoding="utf-8")
    p = load_people(f)
    assert p.group_senders == {"Mi Grupo"}
    assert p.canonical("Zoe Pérez") == "Zoe Pérez" and p.canonical("Mi Grupo") == "__grupo__"


def test_cli_loader_falls_back_when_file_is_missing(tmp_path, capsys):
    p = load_people_cli(tmp_path / "nope.json", me="Ana")
    assert p.canonical("Tú") == "Ana" and p.names == {}
    assert "nope.json" in capsys.readouterr().err
    load_people_cli(tmp_path / "nope.json", me="Ana", quiet=True)
    assert capsys.readouterr().err == ""


@pytest.mark.parametrize("text", ["{no es json", "[]", '{"people": ["Ana"]}', '{"group": "Mi Grupo"}'])
def test_cli_loader_exits_cleanly_on_malformed_file(tmp_path, text):
    f = tmp_path / "people.json"
    f.write_text(text, encoding="utf-8")
    with pytest.raises(SystemExit) as e:
        load_people_cli(f)
    assert str(f) in str(e.value)


def test_group_report_exits_cleanly_on_malformed_people(tmp_path, mini_parquet):
    import group_report

    f = tmp_path / "people.json"
    f.write_text("{no es json", encoding="utf-8")
    with pytest.raises(SystemExit) as e:
        group_report.run(["--data", str(mini_parquet), "--out", str(tmp_path / "o"), "--people", str(f)])
    assert str(f) in str(e.value)


def test_group_report_and_build_dataset_survive_missing_people(tmp_path, mini_parquet, capsys):
    import build_dataset
    import group_report

    missing = tmp_path / "nope.json"
    out = tmp_path / "ds.parquet"
    build_dataset.run([f"{FIXTURE}:main", "-o", str(out), "--people", str(missing), "--me", "Ana"])
    assert out.exists() and "nope.json" in capsys.readouterr().err
    group_report.run(["--data", str(mini_parquet), "--out", str(tmp_path / "o"), "--people", str(missing)])
    assert (tmp_path / "o" / "report.md").exists() and "nope.json" in capsys.readouterr().err


def test_contact_surnames_strip_curly_quoted_nicknames():
    from wa.names import People

    assert People(names={"“Flo” Flor Paredes": "Flor"}).contact_surnames() == {"paredes"}
    assert People(names={"‘Flo’ Flor Paredes": "Flor"}).contact_surnames() == {"paredes"}
    assert People(names={'"Brujo" Bruno Castro': "Bruno"}).contact_surnames() == {"castro"}
    assert People(names={"Bruno 'Brujo' Castro": "Bruno"}).contact_surnames() == {"castro"}


def test_two_short_names_with_one_slug_are_refused(tmp_path):
    from wa.names import PeopleError

    f = tmp_path / "people.json"
    f.write_text(json.dumps({"people": {"Martín Sosa": "Martín", "Martin Paz": "Martin"}}), encoding="utf-8")
    with pytest.raises(PeopleError) as e:
        load_people(f)
    assert "short names 'Martín' and 'Martin' would share the profile 'martin': rename one" in str(e.value)
    assert str(f) in str(e.value)


def test_one_short_name_for_several_contact_names_is_legal(tmp_path):
    f = tmp_path / "people.json"
    f.write_text(json.dumps({"people": {"Ana Rivas": "Ana", "Ana (trabajo)": "Ana", "Tú": "Ana"}}), encoding="utf-8")
    assert load_people(f).short_names() == {"Ana"}


@pytest.mark.parametrize("path", ["content/example/people.json", "tests/fixtures/content/people.json",
                                  "tests/fixtures/synth/content-en/people.json",
                                  "tests/fixtures/synth/content-es/people.json"])
def test_committed_people_files_load(path):
    from conftest import ROOT

    assert load_people(ROOT / path).short_names()
