import dataclasses
import json
import re
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import build_dataset  # noqa: E402
import events  # noqa: E402
import records  # noqa: E402
import group_report  # noqa: E402
from wa.names import People, load_people  # noqa: E402
from web.thresholds import Thresholds  # noqa: E402

LEGACY = Thresholds.legacy()  # los valores fijos de siempre: los tests de los capítulos no dependen del tamaño del chat
PROFILE_ALL = dataclasses.replace(LEGACY, profile_msgs=1)  # todos con perfil, como `--min-msgs 1`

FIXTURE = ROOT / "tests" / "fixtures" / "mini_chat.txt"
# El nombre al que el fixture renombra el grupo (se lee del propio fixture).
RENAMED_GROUP = re.search(r'cambió el nombre del grupo a "(.+?)"', FIXTURE.read_text(encoding="utf-8")).group(1)
CONTENT = ROOT / "tests" / "fixtures" / "content"
PEOPLE_JSON = CONTENT / "people.json"
FIXTURE_EVENTS = CONTENT / "events.json"
FIXTURE_BADWORDS = CONTENT / "badwords.txt"


def web_config(tmp_path: Path, **overrides) -> Path:
    """Escribe un report.config.json de prueba (Los del Parque) en tmp_path y devuelve su ruta."""
    cfg = {"title": "Los del Parque", "lang": "es", "mode": "full", "chat": str(FIXTURE), "me": "Ana",
           "departer": "Bruno", "gate": True, "verifiedOn": "2026-11-13", **overrides}
    path = tmp_path / "report.config.json"
    path.write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
    return path


@pytest.fixture(scope="session")
def people_path() -> Path:
    return PEOPLE_JSON


@pytest.fixture(scope="session")
def people(people_path) -> People:
    return load_people(people_path)


@pytest.fixture(scope="session")
def mini_parquet(people, tmp_path_factory) -> Path:
    path = tmp_path_factory.mktemp("mini") / "messages.parquet"
    df: pd.DataFrame = build_dataset.build([(str(FIXTURE), "main")], people)
    df.to_parquet(path, index=False)
    return path


@pytest.fixture(scope="session")
def mini_out(mini_parquet, tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("mini_out") / "out"
    argv = ["--data", str(mini_parquet), "--chat", "main", "--out", str(out)]
    group_report.run([*argv, "--people", str(PEOPLE_JSON), "--departer", "Bruno", "--aliases", "Bruno,Brujo"])
    events.run([*argv, "--events", str(FIXTURE_EVENTS)])
    records.run([*argv, "--thresholds", "legacy"])
    return out


@pytest.fixture(scope="session")
def web_data(mini_parquet, mini_out, tmp_path_factory) -> Path:
    import build_web_data

    out = tmp_path_factory.mktemp("web") / "web_data"
    cfg = web_config(tmp_path_factory.mktemp("web_cfg"))
    build_web_data.run(
        ["--config", str(cfg), "--content", str(CONTENT), "--data", str(mini_parquet), "--analysis", str(mini_out),
         "--out", str(out), "--thresholds", "legacy", "--min-msgs", "1"]
    )
    return out


# ---------------------------------------------------------------- pipeline de punta a punta sobre el chat ficticio
SYNTH_LINES = "8000"
SYNTH_WEB = ROOT / "web" / "data" / "synth"  # gitignored: vitest (web/src/lib/synthData.test.ts) valida cada dir


def _synth_pipeline(base: Path, lang: str, platform: str) -> Path:
    """Chat ficticio de 8.000 líneas (seed 7) + su content/, pipeline completo con --thresholds derived; devuelve el
    web/data generado (su content/ queda al lado, en base/content)."""
    import build_pipeline
    import synth_chat

    chat, content = base / "chat.txt", base / "content"
    synth_chat.run(["--lang", lang, "--platform", platform, "--seed", "7", "--lines", SYNTH_LINES,
                    "--out", str(chat), "--content-out", str(content)])
    cfg = {"title": "Los del Parque", "lang": lang, "mode": "full", "chat": str(chat), "background": [], "me": "Ana",
           "departer": "Bruno", "gate": True, "verifiedOn": "2026-11-13"}
    cfg_path = base / "report.config.json"
    cfg_path.write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
    out = base / "web_data"
    build_pipeline.run(["--config", str(cfg_path), "--content", str(content), "--thresholds", "derived",
                        "--data", str(base / "data" / "messages.parquet"), "--analysis", str(base / "data" / "analysis"),
                        "--out", str(out)])
    return out


@pytest.fixture(scope="session")
def synth_data(tmp_path_factory):
    """Fábrica: synth_data(lang, platform="ios") -> Path del web/data del chat ficticio, generado una vez por sesión.
    También lo copia a web/data/synth/<lang>[-android]/ para que vitest lo valide contra los esquemas zod."""
    import shutil

    cache: dict[tuple[str, str], Path] = {}

    def build(lang: str, platform: str = "ios") -> Path:
        if (lang, platform) not in cache:
            name = lang if platform == "ios" else f"{lang}-{platform}"
            out = _synth_pipeline(tmp_path_factory.mktemp(f"synth-{name}"), lang, platform)
            dest = SYNTH_WEB / name
            shutil.rmtree(dest, ignore_errors=True)
            shutil.copytree(out, dest)
            cache[(lang, platform)] = out
        return cache[(lang, platform)]

    return build


@pytest.fixture(scope="session")
def synth_android_data(synth_data) -> Path:
    return synth_data("es", "android")
