import json

import pandas as pd
import pytest

import analyze
import build_dataset
from conftest import FIXTURE, ROOT
from wa.lang import get_lang
from wa.names import load_people
from web.thresholds import Thresholds

ES = get_lang("es")

FORMATS = ROOT / "tests" / "fixtures" / "formats"


def test_summary_shape(mini_parquet, people):
    s = analyze.summarize(pd.read_parquet(mini_parquet), people, ES)
    assert set(s) == {"locale", "size", "group_names", "me_candidates", "people", "departure_candidates", "has_polls",
                      "peak_days", "sample", "active_people", "profiled_people", "recommended_mode"}
    assert s["locale"] is None  # sin el .txt no hay de dónde detectarlo
    assert s["size"]["msgs"] >= 60 and s["has_polls"] is True
    assert s["size"]["from"] == "2023-09-01" and s["size"]["to"] > s["size"]["from"] and s["size"]["days"] >= 2
    assert s["departure_candidates"][0]["short"] == "Bruno"
    assert any(p["quoted_nickname"] == "Brujo" for p in s["people"])
    assert 0 < len(s["sample"]) <= 300 and all(len(m["body"]) <= 200 for m in s["sample"])
    assert set(s["sample"][0]) == {"ts", "short", "body"}


def test_summary_locale_is_detected_from_the_source(mini_parquet, people):
    s = analyze.summarize(pd.read_parquet(mini_parquet), people, ES, source=str(FIXTURE))
    assert s["locale"] == {"platform": "ios", "lang": "es", "date_order": "dmy", "verified": True}


def test_android_export_without_group_title(people):
    """Android firma los avisos con el grupo sin nombrarlo: no hay título de grupo que proponer."""
    df = build_dataset.build([(str(FORMATS / "android-es.txt"), "main")], load_people(None, me="Ana"))
    s = analyze.summarize(df, load_people(None, me="Ana"), ES, source=str(FORMATS / "android-es.txt"))
    assert s["group_names"] == [] and s["locale"]["platform"] == "android"


def test_people_sorted_by_msgs_with_raw_and_nicknames(mini_parquet, people):
    s = analyze.summarize(pd.read_parquet(mini_parquet), people, ES)
    ps = s["people"]
    assert [p["msgs"] for p in ps] == sorted((p["msgs"] for p in ps), reverse=True)
    assert {p["short"] for p in ps} == {"Ana", "Tomi", "Lucas", "Bruno", "Caro"}
    by = {p["short"]: p for p in ps}
    assert by["Bruno"]["raw"] == 'Bruno "Brujo" Castro' and by["Bruno"]["quoted_nickname"] == "Brujo"
    assert by["Ana"]["raw"] == "Ana Rivas" and by["Ana"]["quoted_nickname"] is None
    assert by["Ana"]["first"] <= by["Ana"]["last"]


def test_group_names_and_me_candidates(mini_parquet, people):
    s = analyze.summarize(pd.read_parquet(mini_parquet), people, ES)
    assert s["group_names"] == ["Los del Parque 🌳"]
    assert s["me_candidates"] == []  # "Tú" no firma ningún mensaje del fixture


def test_without_people_file_names_stay_raw(mini_parquet):
    s = analyze.summarize(pd.read_parquet(mini_parquet), load_people(None, me="Ana"), ES)
    assert {p["short"] for p in s["people"]} >= {'Bruno "Brujo" Castro', "Ana Rivas"}
    assert s["group_names"] == ["Los del Parque 🌳"]
    assert s["departure_candidates"][0]["short"] == 'Bruno "Brujo" Castro'


def test_me_candidates_from_you_sender(mini_parquet, people):
    df = pd.read_parquet(mini_parquet)
    df.loc[df["kind"] == "system", "sender_raw"] = ["Tú"] + ["Los del Parque 🌳"] * ((df["kind"] == "system").sum() - 1)
    assert analyze.summarize(df, people, ES)["me_candidates"] == ["Ana"]  # mapeado a su nombre corto
    assert analyze.summarize(df, load_people(None), ES)["me_candidates"] == ["Tú"]


def test_peak_days_have_top_terms(mini_parquet, people):
    s = analyze.summarize(pd.read_parquet(mini_parquet), people, ES)
    assert s["peak_days"], "el fixture tiene días pico"
    d = s["peak_days"][0]
    assert set(d) == {"date", "msgs", "top_terms"} and 0 < len(d["top_terms"]) <= 8
    assert all(t not in {"que", "los", "con"} for p in s["peak_days"] for t in p["top_terms"])


def test_sample_is_stratified_by_year_and_reproducible(mini_parquet, people):
    df = pd.read_parquet(mini_parquet)
    texts = df[df["kind"] == "text"]
    extra = texts.head(40).copy()
    extra["ts"] = extra["ts"] - pd.Timedelta(days=800)  # otro año, ~40 mensajes
    extra["year"] = extra["ts"].dt.year.astype("int16")
    two_years = pd.concat([df, extra], ignore_index=True)
    s = analyze.summarize(two_years, people, ES, sample_n=30)
    assert len(s["sample"]) == 30
    years = pd.Series([m["ts"][:4] for m in s["sample"]]).value_counts()
    assert set(years.index) == set(two_years["year"].astype(str).unique())
    expected = two_years[two_years["kind"] == "text"].groupby("year").size()
    assert abs(years[str(expected.idxmax())] / 30 - expected.max() / expected.sum()) < 0.1
    assert s["sample"] == analyze.summarize(two_years, people, ES, sample_n=30)["sample"]
    assert [m["ts"] for m in s["sample"]] == sorted(m["ts"] for m in s["sample"])
    tiny = analyze.summarize(two_years, people, ES, sample_n=2)
    assert len(tiny["sample"]) == 2


def test_run_writes_summary_json(mini_parquet, people_path, tmp_path):
    out = tmp_path / "analysis" / "summary.json"
    analyze.run(["--data", str(mini_parquet), "--chat", "main", "--people", str(people_path), "--out", str(out)])
    s = json.loads(out.read_text(encoding="utf-8"))
    assert s["people"][0]["short"] and s["has_polls"] is True


def test_run_without_people_file_is_silent_and_uses_me(mini_parquet, tmp_path, capsys):
    out = tmp_path / "summary.json"
    analyze.run(["--data", str(mini_parquet), "--chat", "main", "--people", str(tmp_path / "nope.json"),
                 "--me", "Ana", "--out", str(out)])
    assert out.exists() and "nope.json" not in capsys.readouterr().err


def test_run_only_summarizes_the_requested_chat(mini_parquet, people_path, tmp_path):
    df = pd.read_parquet(mini_parquet)
    bg = df.head(20).copy()
    bg["chat"] = "bg0"
    mixed = tmp_path / "mixed.parquet"
    pd.concat([df, bg], ignore_index=True).to_parquet(mixed, index=False)
    out = tmp_path / "summary.json"
    analyze.run(["--data", str(mixed), "--chat", "main", "--people", str(people_path), "--out", str(out)])
    assert json.loads(out.read_text(encoding="utf-8"))["size"]["msgs"] == analyze.summarize(df, load_people(people_path), ES)["size"]["msgs"]


@pytest.fixture(scope="module")
def mini_summary(mini_parquet, people):
    return analyze.summarize(pd.read_parquet(mini_parquet), people, ES)


def test_small_chat_recommends_single(mini_summary):
    assert mini_summary["recommended_mode"] == "single" and mini_summary["active_people"] >= 1


def test_active_people_counts_those_above_the_active_share(mini_summary):
    floor = Thresholds.derived(mini_summary["size"]["msgs"]).active_share * mini_summary["size"]["msgs"]
    assert mini_summary["active_people"] == sum(p["msgs"] >= floor for p in mini_summary["people"])


def test_recommended_mode_thresholds():
    assert analyze.recommend_mode(msgs=19_999, active=9) == "single"
    assert analyze.recommend_mode(msgs=20_000, active=4) == "single"
    assert analyze.recommend_mode(msgs=20_000, active=5) == "full"


def test_profiled_people_counts_those_who_would_get_a_profile(mini_summary):
    th = Thresholds.derived(mini_summary["size"]["msgs"])
    floor = max(th.profile_msgs, th.active_share * mini_summary["size"]["msgs"])
    assert mini_summary["profiled_people"] == sum(p["msgs"] >= floor for p in mini_summary["people"]) == 0


def test_profiled_people_on_the_synthetic_chat(synth_data):
    summary = json.loads((synth_data("es").parent / "data" / "analysis" / "summary.json").read_text(encoding="utf-8"))
    profiles = json.loads((synth_data("es") / "global.json").read_text(encoding="utf-8"))["people"]
    assert summary["profiled_people"] == len([p for p in profiles if p["slug"] != "resto"]) > 0
