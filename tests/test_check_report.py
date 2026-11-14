import json
import re
import shutil

import pytest
from conftest import CONTENT, FIXTURE_EVENTS, PEOPLE_JSON, ROOT, web_config

import check_report

CHAPTER_IDS = ["censo", "carrera", "horas", "parejas", "lenguaje", "multimedia", "emojis", "encuestas", "ritmo",
               "menciones", "salidas", "eventos", "records", "diccionario", "premios", "personas", "conclusion"]


@pytest.fixture(scope="module")
def web_data_no_departer(mini_parquet, tmp_path_factory):
    """The web_data fixture's pipeline on the mini chat, with no departer."""
    import build_web_data
    import events
    import group_report
    import records

    analysis = tmp_path_factory.mktemp("nodep_out") / "out"
    argv = ["--data", str(mini_parquet), "--chat", "main", "--out", str(analysis)]
    group_report.run([*argv, "--people", str(PEOPLE_JSON)])
    events.run([*argv, "--events", str(FIXTURE_EVENTS)])
    records.run([*argv, "--thresholds", "legacy"])
    out = tmp_path_factory.mktemp("nodep_web") / "web_data"
    cfg = web_config(tmp_path_factory.mktemp("nodep_cfg"), departer=None)
    build_web_data.run(["--config", str(cfg), "--content", str(CONTENT), "--data", str(mini_parquet),
                        "--analysis", str(analysis), "--out", str(out), "--thresholds", "legacy", "--min-msgs", "1"])
    return out


def test_chapter_ids_match_the_web():
    source = (ROOT / "web" / "src" / "chapters" / "index.ts").read_text(encoding="utf-8")
    block = re.search(r"CHAPTER_IDS = \[(.*?)\]", source, re.S).group(1)
    assert re.findall(r'"([a-z]+)"', block) == CHAPTER_IDS
    assert list(check_report.CHAPTER_IDS) == CHAPTER_IDS


def test_example_has_every_chapter_on():
    r = check_report.check(ROOT / "web" / "data" / "example")
    assert [c["id"] for c in r["chapters"]] == CHAPTER_IDS and all(c["on"] for c in r["chapters"])


def test_off_chapters_say_why(web_data_no_departer):
    off = {c["id"]: c["reason"] for c in check_report.check(web_data_no_departer)["chapters"] if not c["on"]}
    assert "salidas" in off and off["salidas"]


def test_missing_data_exits_1(tmp_path):
    with pytest.raises(SystemExit) as e:
        check_report.run(["--data", str(tmp_path)])
    assert e.value.code not in (0, None)
    assert "global.json" in str(e.value) and "\n" not in str(e.value)


def test_thin_spots_are_listed(tmp_path):
    data = tmp_path / "data"
    shutil.copytree(ROOT / "web" / "data" / "example", data)
    g = json.loads((data / "global.json").read_text(encoding="utf-8"))
    g["people"] = [p for p in g["people"] if p["slug"] == "resto"]
    g["timeResolution"] = "minute"
    (data / "global.json").write_text(json.dumps(g), encoding="utf-8")
    awards = [a for a in json.loads((data / "awards.json").read_text(encoding="utf-8")) if a["id"] != "fastest"]
    awards[0]["winner"] = None
    (data / "awards.json").write_text(json.dumps(awards), encoding="utf-8")
    media = json.loads((data / "media.json").read_text(encoding="utf-8"))
    media["audios"]["byPerson"] = []
    (data / "media.json").write_text(json.dumps(media), encoding="utf-8")
    for name in ("events.json", "lore.json"):
        (data / name).write_text("[]", encoding="utf-8")
    (data / "polls.json").write_text(json.dumps({**json.loads((data / "polls.json").read_text()), "total": 0}))
    r = check_report.check(data)
    thin = "\n".join(r["thin"])
    assert len(r["thin"]) == 6
    for needle in ("0 profiles", awards[0]["id"], "events", "dictionary", "fastest", "audios"):
        assert needle in thin
    assert "0 profiles: nobody has enough messages for a profile" in thin and "--" not in thin  # no flag to try
    off = [c["id"] for c in r["chapters"] if not c["on"]]
    assert off == ["encuestas"]


def test_run_prints_one_line_per_chapter(web_data_no_departer, capsys):
    check_report.run(["--data", str(web_data_no_departer)])
    lines = capsys.readouterr().out.splitlines()
    assert [ln.split()[1] for ln in lines[:17]] == CHAPTER_IDS
    assert any(ln.startswith("off  salidas  ") for ln in lines) and any(ln.startswith("on   censo") for ln in lines)
