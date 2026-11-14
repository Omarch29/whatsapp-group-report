"""scripts/demo_deploy.py: las dos demos del chat ficticio, con vercel y pnpm falsos (nada sale de la máquina)."""
import json
from pathlib import Path

import pytest

import demo_deploy


class Recorder:
    """Callable que anota cada (argv, cwd, env) en vez de ejecutar nada."""

    def __init__(self, log: list, name: str):
        self.log, self.name = log, name

    def __call__(self, argv, *, cwd, env):
        self.log.append((self.name, list(argv), Path(cwd), dict(env)))


def fake_pipeline(argv):
    out = Path(argv[argv.index("--out") + 1])
    out.mkdir(parents=True, exist_ok=True)
    (out / "global.json").write_text("{}", encoding="utf-8")


def fake_synth(argv):
    Path(argv[argv.index("--out") + 1]).parent.mkdir(parents=True, exist_ok=True)
    Path(argv[argv.index("--out") + 1]).write_text("x", encoding="utf-8")
    content = Path(argv[argv.index("--content-out") + 1])
    content.mkdir(parents=True, exist_ok=True)
    (content / "people.json").write_text("{}", encoding="utf-8")


def go(tmp_path, *argv, fake=True):
    log: list = []
    extra = {"synth": fake_synth, "pipeline": fake_pipeline} if fake else {}
    demo_deploy.run(list(argv), root=tmp_path, vercel=Recorder(log, "vercel"), pnpm=Recorder(log, "pnpm"), **extra)
    return log


@pytest.mark.parametrize("lang,title", [("es", "Los del Parque"), ("en", "The Park Crew")])
def test_no_deploy_builds_into_demo_paths_and_never_calls_vercel(tmp_path, lang, title):
    log = go(tmp_path, "--lang", lang, "--no-deploy")
    cfg = json.loads((tmp_path / f"report.config.demo-{lang}.json").read_text(encoding="utf-8"))
    assert (cfg["gate"], cfg["mode"], cfg["lang"], cfg["title"]) == (False, "full", lang, title)
    assert (cfg["me"], cfg["departer"]) == ("Ana", "Bruno")
    assert cfg["chat"] == str(tmp_path / "chats" / f"synth-{lang}-ios.txt")
    assert (tmp_path / "web" / "data" / f"demo-{lang}" / "global.json").is_file()
    assert not list((tmp_path / "web" / "data").glob("*.json"))
    assert [name for name, *_ in log] == ["pnpm", "pnpm"]
    (_, build, cwd, env), (_, check, _, env2) = log
    assert build == ["pnpm", "build"] and cwd == tmp_path / "web"
    assert check == ["pnpm", "check:en"] and env2 == env
    assert env["WGR_DATA_DIR"] == str(tmp_path / "web" / "data" / f"demo-{lang}")
    assert env["WGR_CONTENT_DIR"] == str(tmp_path / "content" / f"demo-{lang}")


def test_pipeline_gets_demo_only_paths(tmp_path):
    seen = []
    demo_deploy.run(["--lang", "en", "--no-deploy"], root=tmp_path, vercel=Recorder([], "v"), pnpm=Recorder([], "p"),
                    synth=fake_synth, pipeline=lambda argv: (seen.append(argv), fake_pipeline(argv)))
    argv = seen[0]
    opt = lambda k: argv[argv.index(k) + 1]  # noqa: E731
    assert opt("--config") == str(tmp_path / "report.config.demo-en.json")
    assert opt("--content") == str(tmp_path / "content" / "demo-en")
    assert opt("--data") == str(tmp_path / "data" / "demo-en" / "messages.parquet")
    assert opt("--analysis") == str(tmp_path / "data" / "demo-en" / "analysis")
    assert opt("--out") == str(tmp_path / "web" / "data" / "demo-en")
    assert opt("--thresholds") == "derived"


@pytest.mark.parametrize("linked", [None, "other"])
def test_deploy_links_builds_and_deploys_in_order(tmp_path, linked):
    if linked:
        (tmp_path / "web" / ".vercel").mkdir(parents=True)
        (tmp_path / "web" / ".vercel" / "project.json").write_text(json.dumps({"projectName": linked}))
    log = go(tmp_path, "--lang", "en")
    vercel = [argv for name, argv, *_ in log if name == "vercel"]
    assert vercel == [["vercel", "link", "--yes", "--project", "whatsapp-group-report-en"],
                      ["vercel", "pull", "--yes", "--environment=production"],
                      ["vercel", "build", "--prod"], ["vercel", "deploy", "--prebuilt", "--prod"]]
    order = [argv[:2] for _, argv, *_ in log]
    assert order.index(["pnpm", "check:en"]) < order.index(["vercel", "link"])
    assert all(cwd == tmp_path / "web" and env["WGR_DATA_DIR"].endswith("demo-en") for _, _, cwd, env in log)


def test_deploy_skips_link_when_already_linked(tmp_path):
    (tmp_path / "web" / ".vercel").mkdir(parents=True)
    (tmp_path / "web" / ".vercel" / "project.json").write_text(json.dumps({"projectName": "whatsapp-group-report-es"}))
    log = go(tmp_path, "--lang", "es")
    assert [argv for name, argv, *_ in log if name == "vercel"] == [
        ["vercel", "pull", "--yes", "--environment=production"],
        ["vercel", "build", "--prod"], ["vercel", "deploy", "--prebuilt", "--prod"]]


def test_warns_before_relinking_away_from_another_project(tmp_path, capsys):
    (tmp_path / "web" / ".vercel").mkdir(parents=True)
    (tmp_path / "web" / ".vercel" / "project.json").write_text(json.dumps({"projectName": "my-own-report"}))
    log = go(tmp_path, "--lang", "es")
    err = capsys.readouterr().err
    assert "my-own-report" in err and "whatsapp-group-report-es" in err and "vercel link" in err
    assert [argv[1] for name, argv, *_ in log if name == "vercel"][0] == "link"


@pytest.mark.parametrize("linked", [None, "whatsapp-group-report-es", "whatsapp-group-report-en"])
def test_no_warning_without_a_foreign_link(tmp_path, capsys, linked):
    if linked:
        (tmp_path / "web" / ".vercel").mkdir(parents=True)
        (tmp_path / "web" / ".vercel" / "project.json").write_text(json.dumps({"projectName": linked}))
    go(tmp_path, "--lang", "es")
    assert "WARNING" not in capsys.readouterr().err


def test_unknown_lang_exits_nonzero_without_running_anything(tmp_path):
    log: list = []
    with pytest.raises(SystemExit) as e:
        demo_deploy.run(["--lang", "fr"], root=tmp_path, vercel=Recorder(log, "v"), pnpm=Recorder(log, "p"))
    assert e.value.code != 0 and not log and not list(tmp_path.iterdir())


def test_real_synth_and_pipeline_accept_the_config(tmp_path):
    log = go(tmp_path, "--lang", "en", "--no-deploy", fake=False)
    data = tmp_path / "web" / "data" / "demo-en"
    assert json.loads((data / "global.json").read_text(encoding="utf-8"))["gate"] is False
    assert (data / "census.json").is_file() and len(log) == 2


def test_mode_reaches_the_config(tmp_path):
    go(tmp_path, "--lang", "en", "--mode", "single", "--no-deploy")
    assert json.loads((tmp_path / "report.config.demo-en.json").read_text())["mode"] == "single"


def test_single_mode_is_never_deployed(tmp_path):
    log: list = []
    with pytest.raises(SystemExit):
        demo_deploy.run(["--lang", "es", "--mode", "single"], root=tmp_path, vercel=Recorder(log, "vercel"),
                        pnpm=Recorder(log, "pnpm"), synth=fake_synth, pipeline=fake_pipeline)
    assert log == [] and not (tmp_path / "chats").exists()
