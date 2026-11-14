import json
import shutil

import pandas as pd
import pytest
from conftest import CONTENT, FIXTURE, ROOT

import build_pipeline


def _setup(tmp_path, **overrides):
    """Config de ejemplo apuntando al fixture + copia del content del fixture, todo dentro de tmp_path."""
    cfg = json.loads((ROOT / "report.config.example.json").read_text(encoding="utf-8"))
    cfg.update(chat=str(FIXTURE), **overrides)
    (tmp_path / "report.config.json").write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
    shutil.copytree(CONTENT, tmp_path / "content")
    return tmp_path


def _argv(root, *extra):
    return ["--config", str(root / "report.config.json"), "--content", str(root / "content"),
            "--data", str(root / "data" / "messages.parquet"), "--analysis", str(root / "data" / "analysis"),
            "--out", str(root / "web" / "data"), *extra]


@pytest.fixture(scope="module")
def pipeline(tmp_path_factory):
    root = _setup(tmp_path_factory.mktemp("pipeline"))
    build_pipeline.run(_argv(root, "--thresholds", "legacy", "--min-msgs", "1"))
    return root


def test_pipeline_end_to_end(pipeline):
    out = pipeline / "web" / "data"
    assert {p.name for p in out.glob("*.json")} >= {"global.json", "departures.json", "facts.json", "census.json",
                                                    "language.json"}
    assert (out / "people" / "ana.json").exists()
    assert (pipeline / "data" / "analysis" / "summary.json").exists()
    assert len(pd.read_parquet(pipeline / "data" / "messages.parquet")) >= 60
    summary = json.loads((pipeline / "data" / "analysis" / "summary.json").read_text(encoding="utf-8"))
    assert summary["departure_candidates"][0]["short"] == "Bruno"


def test_pipeline_prints_one_line_per_step(tmp_path, capsys):
    root = _setup(tmp_path)
    build_pipeline.run(_argv(root, "--thresholds", "legacy", "--min-msgs", "1"))
    steps = [ln for ln in capsys.readouterr().err.splitlines() if ln.startswith("[")]
    assert [ln[:5] for ln in steps] == ["[1/6]", "[2/6]", "[3/6]", "[4/6]", "[5/6]", "[6/6]"]


def test_pipeline_builds_departer_aliases_from_content(tmp_path, monkeypatch):
    root = _setup(tmp_path)
    seen = {}
    monkeypatch.setattr(build_pipeline.group_report, "run", lambda argv: seen.update(argv=argv))
    for name in ("events", "records", "build_web_data"):
        monkeypatch.setattr(getattr(build_pipeline, name), "run", lambda argv: None)
    build_pipeline.run(_argv(root))
    argv = seen["argv"]
    assert argv[argv.index("--departer") + 1] == "Bruno"
    assert argv[argv.index("--aliases") + 1] == "Bruno,El Brujo"  # corto, apodo de nicknames.json, primera palabra


def test_pipeline_explicit_departer_aliases_replace_the_derived_ones(tmp_path, monkeypatch):
    root = _setup(tmp_path, departerAliases=["Bru", "brujito"])
    seen = {}
    monkeypatch.setattr(build_pipeline.group_report, "run", lambda argv: seen.update(argv=argv))
    for name in ("events", "records", "build_web_data"):
        monkeypatch.setattr(getattr(build_pipeline, name), "run", lambda argv: None)
    build_pipeline.run(_argv(root))
    argv = seen["argv"]
    assert argv[argv.index("--aliases") + 1] == "Bruno,Bru,brujito"  # el nombre corto siempre va primero


def test_pipeline_without_departer_omits_departer_args(tmp_path, monkeypatch):
    root = _setup(tmp_path, departer=None)
    seen = {}
    monkeypatch.setattr(build_pipeline.group_report, "run", lambda argv: seen.update(argv=argv))
    for name in ("events", "records", "build_web_data"):
        monkeypatch.setattr(getattr(build_pipeline, name), "run", lambda argv: None)
    build_pipeline.run(_argv(root))
    assert "--departer" not in seen["argv"] and "--aliases" not in seen["argv"]


def test_pipeline_without_events_file_writes_empty_list(tmp_path, capsys):
    root = _setup(tmp_path)
    (root / "content" / "events.json").unlink()
    build_pipeline.run(_argv(root, "--thresholds", "legacy", "--min-msgs", "1"))
    assert json.loads((root / "data" / "analysis" / "events.json").read_text(encoding="utf-8")) == []
    assert "sin eventos" in capsys.readouterr().err
    assert (root / "web" / "data" / "global.json").exists()


def test_pipeline_until_analyze(tmp_path):
    argv = ["--chat", str(FIXTURE), "--me", "Ana", "--lang", "es", "--until", "analyze",
            "--content", str(tmp_path / "content"), "--data", str(tmp_path / "data" / "messages.parquet"),
            "--analysis", str(tmp_path / "data" / "analysis"), "--out", str(tmp_path / "web" / "data")]
    build_pipeline.run(argv)  # sin report.config.json ni content/
    assert sorted(p.name for p in (tmp_path / "data").rglob("*") if p.is_file()) == ["messages.parquet", "summary.json"]
    assert not (tmp_path / "web").exists()
    summary = json.loads((tmp_path / "data" / "analysis" / "summary.json").read_text(encoding="utf-8"))
    assert {p["short"] for p in summary["people"]} >= {"Ana Rivas", 'Bruno "Brujo" Castro'}


def test_pipeline_until_analyze_takes_background_chats(tmp_path):
    argv = ["--chat", str(FIXTURE), "--background", str(FIXTURE), str(FIXTURE), "--until", "analyze",
            "--content", str(tmp_path / "content"), "--data", str(tmp_path / "messages.parquet"),
            "--analysis", str(tmp_path / "analysis")]
    build_pipeline.run(argv)
    assert set(pd.read_parquet(tmp_path / "messages.parquet")["chat"].astype(str)) == {"main", "bg0", "bg1"}


def test_pipeline_rejects_unknown_departer(tmp_path):
    root = _setup(tmp_path, departer="Zoe")
    with pytest.raises(SystemExit) as e:
        build_pipeline.run(_argv(root))
    msg = str(e.value)
    assert "departer" in msg and "Zoe" in msg and "Bruno" in msg  # el campo y los nombres válidos
    assert not (root / "data" / "analysis").exists()  # falla antes de analizar


def test_pipeline_rejects_bad_config_cleanly(tmp_path):
    root = _setup(tmp_path)
    (root / "report.config.json").write_text("{no es json", encoding="utf-8")
    with pytest.raises(SystemExit) as e:
        build_pipeline.run(_argv(root))
    assert "report.config.json" in str(e.value)


def test_cli_chat_requires_until_analyze(tmp_path):
    root = _setup(tmp_path)
    with pytest.raises(SystemExit) as e:
        build_pipeline.run([*_argv(root), "--chat", str(FIXTURE)])
    assert "--until analyze" in str(e.value)


@pytest.mark.parametrize("field", ["chat", "background"])
def test_pipeline_rejects_missing_chat(tmp_path, field):
    missing = str(tmp_path / "chats" / "no_existe.txt")
    root = _setup(tmp_path)
    cfg = json.loads((root / "report.config.json").read_text(encoding="utf-8"))
    cfg.update(chat=missing) if field == "chat" else cfg.update(background=[missing])
    (root / "report.config.json").write_text(json.dumps(cfg), encoding="utf-8")
    with pytest.raises(SystemExit) as e:
        build_pipeline.run(_argv(root))
    assert missing in str(e.value)
    assert not (root / "data").exists() and not (root / "web").exists()


def test_alias_first_word_loses_quote_characters(tmp_path):
    from wa.names import People

    people = People(names={'"Brujo" Bruno Castro': "Bruno"})
    assert build_pipeline._aliases("Bruno", people, tmp_path) == "Bruno,Brujo"


@pytest.mark.parametrize("name, why", [("people.json", "apellidos"), ("badwords.txt", "puteadas")])
def test_pipeline_requires_people_and_badwords(tmp_path, name, why):
    root = _setup(tmp_path)
    (root / "content" / name).unlink()
    with pytest.raises(SystemExit) as e:
        build_pipeline.run(_argv(root, "--thresholds", "legacy", "--min-msgs", "1"))
    msg = str(e.value)
    assert name in msg and why in msg
    assert not (root / "data").exists()


@pytest.fixture(scope="module")
def synth_en_ios(tmp_path_factory):
    """A 400-line en/iOS synthetic chat (seed 7), written to a temp dir."""
    import synth_chat

    chat = tmp_path_factory.mktemp("synth-en-ios") / "chat.txt"
    synth_chat.run(["--lang", "en", "--platform", "ios", "--seed", "7", "--lines", "400", "--out", str(chat)])
    return chat


def test_discovery_defaults_to_the_exports_language(tmp_path, synth_en_ios):
    build_pipeline.run(["--until", "analyze", "--chat", str(synth_en_ios), "--data", str(tmp_path / "m.parquet"),
                        "--analysis", str(tmp_path / "a")])
    s = json.loads((tmp_path / "a" / "summary.json").read_text(encoding="utf-8"))
    assert s["locale"]["lang"] == "en" and "the" not in {t for p in s["peak_days"] for t in p["top_terms"]}


def test_discovery_accepts_a_language_other_than_the_exports(tmp_path, synth_en_ios):
    build_pipeline.run(["--until", "analyze", "--chat", str(synth_en_ios), "--lang", "es",
                        "--data", str(tmp_path / "m.parquet"), "--analysis", str(tmp_path / "a")])
    assert json.loads((tmp_path / "a" / "summary.json").read_text(encoding="utf-8"))["locale"]["lang"] == "en"


NOT_AN_EXPORT = "hola\nesto no es un export de WhatsApp\n" * 10


@pytest.mark.parametrize("path", ["full", "lang", "discovery"])
def test_unknown_export_format_is_a_one_line_error(tmp_path, path):
    chat = tmp_path / "chats" / "notes.txt"
    chat.parent.mkdir()
    chat.write_text(NOT_AN_EXPORT, encoding="utf-8")
    if path == "full":
        root = _setup(tmp_path)
        cfg = json.loads((root / "report.config.json").read_text(encoding="utf-8"))
        (root / "report.config.json").write_text(json.dumps({**cfg, "chat": str(chat)}), encoding="utf-8")
        argv = _argv(root)
    else:
        argv = ["--until", "analyze", "--chat", str(chat), *(["--lang", "es"] if path == "lang" else []),
                "--data", str(tmp_path / "data" / "m.parquet"), "--analysis", str(tmp_path / "data" / "a")]
    with pytest.raises(SystemExit) as e:
        build_pipeline.run(argv)
    msg = str(e.value)
    assert str(chat) in msg and "\n" not in msg and "formato" in msg
    assert not (tmp_path / "data").exists()
