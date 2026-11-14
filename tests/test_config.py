import pytest
from conftest import ROOT

from config import ConfigError, ReportConfig, load_config


def test_load_example_config():
    cfg = load_config(ROOT / "report.config.example.json")
    assert cfg.title and cfg.lang in ("es", "en") and cfg.mode in ("single", "full")
    assert cfg.background == ()


def test_defaults(tmp_path):
    p = tmp_path / "c.json"
    p.write_text('{"title": "X", "chat": "chats/a.txt"}')
    cfg = load_config(p)
    assert (cfg.lang, cfg.mode, cfg.me, cfg.departer, cfg.gate) == ("es", "full", None, None, True)
    assert cfg.background == ()
    assert len(cfg.verified_on) == 10 and cfg.verified_on[4] == "-"


def test_camel_case_key_and_background_become_python_fields(tmp_path):
    p = tmp_path / "c.json"
    p.write_text('{"title": "X", "chat": "a", "verifiedOn": "2026-01-02", "background": ["b.txt"]}')
    cfg = load_config(p)
    assert cfg.verified_on == "2026-01-02"
    assert cfg.background == ("b.txt",)


@pytest.mark.parametrize(
    "body",
    [
        '{"title":"X","chat":"a","modo":"full"}',
        '{"title":"X","chat":"a","lang":"pt"}',
        '{"title":"X","chat":"a","mode":"both"}',
        '{"chat":"a"}',
        '{"title":"X"}',
        '{"title":"X","chat":"a","gate":"yes"}',
        '{"title":"X","chat":"a","background":"x"}',
        '{"title":"X","chat":"a","background":[1]}',
        '{"title":"X","chat":"a","me":3}',
        '{"title":"X","chat":"a","verifiedOn":"13/11/2026"}',
        '{"title":"X","chat":"a","departerAliases":"Brujo"}',
        '{"title":"X","chat":"a","departerAliases":["Brujo",""]}',
        '["not", "an", "object"]',
        "not json",
    ],
)
def test_rejects_unknown_key_and_bad_values(tmp_path, body):
    p = tmp_path / "c.json"
    p.write_text(body)
    with pytest.raises(ConfigError):
        load_config(p)


def test_departer_aliases_optional_list(tmp_path):
    p = tmp_path / "c.json"
    p.write_text('{"title": "X", "chat": "a", "departer": "Bruno", "departerAliases": ["Brujo", "Bru"]}')
    assert load_config(p).departer_aliases == ("Brujo", "Bru")
    p.write_text('{"title": "X", "chat": "a"}')
    assert load_config(p).departer_aliases == ()


def test_missing_file_is_a_config_error(tmp_path):
    with pytest.raises(ConfigError):
        load_config(tmp_path / "nope.json")


def test_check_people_names_the_bad_value():
    cfg = ReportConfig(title="X", chat="a", me="Ana", departer="Zoe")
    with pytest.raises(ConfigError, match="departer 'Zoe'.*Ana.*Bruno"):
        cfg.check_people({"Ana", "Bruno"})


def test_check_people_accepts_known_and_unset():
    ReportConfig(title="X", chat="a", me="Ana", departer="Bruno").check_people({"Ana", "Bruno"})
    ReportConfig(title="X", chat="a").check_people(set())
