import dataclasses
import json

import pandas as pd

import build_web_data
import records
from web.awards import awards_table
from web.thresholds import Thresholds, clamp
from wa.lang import get_lang

ES = get_lang("es")


def test_legacy_matches_today():
    th = Thresholds.legacy()
    assert (th.profile_msgs, th.active_share, th.fastest_min_replies, th.poll_min_votes,
            th.signature_min_own, th.quote_min_times, th.funny_min_laughs, th.record_min_group, th.proper_min_n) == (
        5000, 0.0, 500, 5, 20, 3, 4, 500, 30)


def test_derived_small_chat():
    th = Thresholds.derived(3000)
    assert (th.profile_msgs, th.fastest_min_replies) == (200, 20)
    assert (th.signature_min_own, th.record_min_group, th.proper_min_n) == (5, 30, 8)
    assert (th.quote_min_times, th.funny_min_laughs, th.poll_min_votes, th.active_share) == (2, 3, 3, 0.01)


def test_derived_large_chat_caps_at_legacy():
    th = Thresholds.derived(2_000_000)
    assert (th.fastest_min_replies, th.record_min_group) == (500, 500)
    assert (th.signature_min_own, th.proper_min_n) == (20, 30)
    assert (th.quote_min_times, th.funny_min_laughs) == (3, 4)


def test_derived_scales_between_the_bounds():
    th = Thresholds.derived(240_000)
    assert (th.fastest_min_replies, th.record_min_group) == (200, 200)
    assert (th.signature_min_own, th.proper_min_n) == (8, 12)
    assert (th.quote_min_times, th.funny_min_laughs) == (3, 4)


def test_clamp_is_an_int_inside_the_bounds():
    assert clamp(3.9, 5, 20) == 5 and clamp(13.6, 5, 20) == 13 and clamp(99, 5, 20) == 20
    assert isinstance(clamp(13.6, 5, 20), int)


def _chat(shares: dict[str, float], total: int) -> pd.DataFrame:
    senders = [name for name, share in shares.items() for _ in range(round(total * share))]
    ts = pd.date_range("2024-01-01", periods=len(senders), freq="min")
    return pd.DataFrame({
        "chat": "main", "ts": ts, "sender": senders, "kind": "text", "body": "hola", "date": ts.date,
        "dow": ts.day_of_week, "hour": ts.hour,
    })


def test_small_fixture_people_get_no_profiles_under_derived(mini_parquet, people):
    df = build_web_data.load_chat(str(mini_parquet), people)
    th = Thresholds.derived(len(df))
    assert th.profile_msgs == 200
    g = build_web_data.build_global(df, th, "t", ES)
    assert [p["slug"] for p in g["people"]] == ["resto"]


def test_derived_profiles_in_mid_chat():
    df = _chat({"a": 0.40, "b": 0.25, "c": 0.20, "d": 0.10, "e": 0.05}, 3000)
    g = build_web_data.build_global(df, Thresholds.derived(len(df)), "t", ES)
    assert {p["slug"] for p in g["people"]} == {"a", "b", "c", "d", "resto"}  # e: 150 msgs < 200


def test_active_share_excludes_a_big_but_tiny_share_person():
    df = _chat({"a": 0.9912, "b": 0.0088}, 25_000)  # b: 220 msgs >= 200, pero 0,88 % < 1 %
    g = build_web_data.build_global(df, Thresholds.derived(len(df)), "t", ES)
    assert {p["slug"] for p in g["people"]} == {"a", "resto"}


def test_award_criterion_cites_the_real_minimum():
    criterion = {a[0]: a[2] for a in awards_table(Thresholds.derived(3000), ES)}["fastest"]
    assert "al menos 20 veces" in criterion
    assert "al menos 500 veces" in {a[0]: a[2] for a in awards_table(Thresholds.legacy(), ES)}["fastest"]


def test_facts_cite_the_thresholds_in_use(web_data):
    facts = json.loads((web_data / "facts.json").read_text(encoding="utf-8"))
    assert facts["thresholds"] == {  # legacy, con --min-msgs 1 pisando el mínimo de perfil
        "profileMsgs": 1, "fastestMinReplies": 500, "pollMinVotes": 5, "signatureMinOwn": 20, "quoteMinTimes": 3,
        "funnyMinLaughs": 4, "recordMinGroup": 500, "properMinN": 30}


def test_facts_profile_minimum_is_the_effective_one():
    """En un chat de 30 mil mensajes el 1 % (300) pesa más que el piso de 200: es lo que hizo falta para tener perfil."""
    df = _chat({"a": 0.5, "b": 0.5}, 30_000)
    th = Thresholds.derived(len(df))
    assert th.profile_msgs == 200
    facts = build_web_data.build_facts(build_web_data.build_global(df, th, "t", ES), {}, thresholds=th, lang=ES)
    assert facts["thresholds"]["profileMsgs"] == 300
    small = dataclasses.replace(th, profile_msgs=1)  # --min-msgs 1: el 1 % sigue mandando
    assert build_web_data.build_facts(build_web_data.build_global(df, small, "t", ES), {},
                                      thresholds=small, lang=ES)["thresholds"]["profileMsgs"] == 300
    legacy = Thresholds.legacy()  # sin active_share, vale el piso
    assert build_web_data.build_facts(build_web_data.build_global(df, legacy, "t", ES), {},
                                      thresholds=legacy, lang=ES)["thresholds"]["profileMsgs"] == 5000


def test_records_threshold_modes(mini_parquet, tmp_path):
    """El fixture tiene ~110 mensajes: con legacy nadie llega a 100 (por persona) y con derived (30 // 5 = 6) todos."""
    by_person = {}
    for mode in ("legacy", "derived"):
        out = tmp_path / mode
        records.run(["--data", str(mini_parquet), "--chat", "main", "--out", str(out), "--thresholds", mode])
        by_person[mode] = json.loads((out / "records.json").read_text(encoding="utf-8"))["message_length"][
            "record_by_person"]
    assert by_person["legacy"] == {}
    assert set(by_person["derived"]) == {"Ana", "Bruno", "Caro", "Lucas", "Tomi"}


def test_records_funniest_uses_the_laugh_threshold(mini_parquet, tmp_path):
    """Un mensaje con exactamente 3 risas de otros entra en `funniest` con derived (3) y no con legacy (4)."""
    base = pd.read_parquet(mini_parquet)
    t0 = base["ts"].max() + pd.Timedelta(days=1)
    rows = [("Tomi", "esto es un chiste buenisimo")] + [(who, "jajaja") for who in ("Ana", "Lucas", "Caro")]
    extra = pd.DataFrame([{**base.iloc[1].to_dict(), "ts": t0 + pd.Timedelta(seconds=20 * i), "sender": who,
                           "body": body, "kind": "text", "is_system": False, "date": (t0 + pd.Timedelta(seconds=20 * i)).date(),
                           "n_chars": len(body), "msg_id": 10_000 + i} for i, (who, body) in enumerate(rows)])
    data = tmp_path / "messages.parquet"
    pd.concat([base, extra], ignore_index=True).astype(base.dtypes.to_dict()).to_parquet(data, index=False)
    top = {}
    for mode in ("legacy", "derived"):
        out = tmp_path / mode
        records.run(["--data", str(data), "--chat", "main", "--out", str(out), "--thresholds", mode])
        funniest = json.loads((out / "records.json").read_text(encoding="utf-8"))["funniest"]
        top[mode] = [m["text"] for m in funniest["top"]]
    assert "esto es un chiste buenisimo" not in top["legacy"]
    assert "esto es un chiste buenisimo" in top["derived"]
