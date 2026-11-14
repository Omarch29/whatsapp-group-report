import json

import pytest

import events
from conftest import FIXTURE_EVENTS
from events import load_events


def _write(tmp_path, items):
    p = tmp_path / "events.json"
    p.write_text(json.dumps(items), encoding="utf-8")
    return p


def _ev(**over):
    base = {"id": "x", "title": "X", "terms": "x", "from": "2023-09-01", "to": "2023-09-02", "note": "n"}
    return {**base, **over}


def test_load_events_shape():
    evs = load_events(FIXTURE_EVENTS)
    assert [e.id for e in evs] == ["cena-dia-uno", "la-encuesta"] and evs[0].saga is False


def test_load_events_saga_flag(tmp_path):
    evs = load_events(_write(tmp_path, [_ev(saga=True)]))
    assert evs[0].saga is True


def test_load_events_missing_key_names_event(tmp_path):
    bad = _ev(id="sin-nota")
    del bad["note"]
    with pytest.raises(ValueError, match="sin-nota.*note"):
        load_events(_write(tmp_path, [bad]))


def test_load_events_reversed_window_names_event(tmp_path):
    with pytest.raises(ValueError, match="ventana-rara"):
        load_events(_write(tmp_path, [_ev(id="ventana-rara", **{"from": "2023-09-05", "to": "2023-09-01"})]))


@pytest.mark.parametrize("content", [{"id": "x"}, "texto", [1, 2], [_ev(), "otro"]])
def test_load_events_top_level_must_be_a_list_of_objects(tmp_path, content):
    path = _write(tmp_path, content)
    with pytest.raises(ValueError, match="events.json.*lista de eventos"):
        load_events(path)


@pytest.mark.parametrize("key, value", [("from", "ayer"), ("to", "2023-13-40"), ("from", 20230901), ("to", None)])
def test_load_events_dates_must_be_iso(tmp_path, key, value):
    with pytest.raises(ValueError, match=rf"fecha-mala.*'{key}'"):
        load_events(_write(tmp_path, [_ev(id="fecha-mala", **{key: value})]))


def test_load_events_terms_must_compile(tmp_path):
    with pytest.raises(ValueError, match=r"regex-rota.*terms.*regex"):
        load_events(_write(tmp_path, [_ev(id="regex-rota", terms="(sin cerrar")]))


def test_load_events_invalid_json_names_the_file(tmp_path):
    path = tmp_path / "events.json"
    path.write_text("[{", encoding="utf-8")
    with pytest.raises(ValueError, match="events.json.*JSON"):
        load_events(path)


def test_run_builds_events_from_file(mini_parquet, tmp_path):
    events.run(["--data", str(mini_parquet), "--chat", "main", "--out", str(tmp_path), "--events", str(FIXTURE_EVENTS)])
    out = json.loads((tmp_path / "events.json").read_text())
    assert {e["id"] for e in out} == {"cena-dia-uno", "la-encuesta"}


def test_run_marks_saga_kind(mini_parquet, tmp_path):
    p = _write(tmp_path, [_ev(id="cena", terms=r"\bcena\b", **{"from": "2023-09-01", "to": "2023-09-01", "saga": True})])
    out = tmp_path / "out"
    events.run(["--data", str(mini_parquet), "--chat", "main", "--out", str(out), "--events", str(p)])
    assert json.loads((out / "events.json").read_text())[0]["kind"] == "saga"


def test_run_missing_events_file_is_clear_exit(mini_parquet, tmp_path):
    missing = tmp_path / "nope" / "events.json"
    with pytest.raises(SystemExit) as exc:
        events.run(["--data", str(mini_parquet), "--chat", "main", "--out", str(tmp_path), "--events", str(missing)])
    assert str(missing) in str(exc.value)
