import json

import pandas as pd
import pytest

from build_web_data import (
    LORE_COLUMNS, REENTRY_COLUMNS, build_departures, build_events, build_global, build_lore, build_person,
    build_records, clean_text, copy_review_message, load_all, load_chat, read_json, web_text,
)
from conftest import CONTENT, PROFILE_ALL, web_config
from wa.slugs import slug
from wa.lang import get_lang

ES = get_lang("es")


def _load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_global_shape(web_data):
    g = _load(web_data / "global.json")
    assert g["totals"]["msgs"] > 0
    assert len(g["heatmap"]) == 7 and len(g["heatmap"][0]) == 24
    assert all(p["colorIndex"] in range(-1, 12) for p in g["people"])
    assert "resto" not in g["monthly"]["series"]


def test_global_has_mode_and_gate(web_data):
    g = _load(web_data / "global.json")
    assert (g["mode"], g["gate"]) == ("full", True)


def test_global_mode_and_gate_come_from_the_config(mini_parquet, mini_out, tmp_path):
    import build_web_data

    cfg = web_config(tmp_path, mode="single", gate=False)
    out = tmp_path / "web_data"
    build_web_data.run(["--config", str(cfg), "--content", str(CONTENT), "--data", str(mini_parquet),
                        "--analysis", str(mini_out), "--out", str(out), "--thresholds", "legacy", "--min-msgs", "1"])
    g = _load(out / "global.json")
    assert (g["mode"], g["gate"]) == ("single", False)


def test_twelve_colors():
    names = [f"p{i:02d}" for i in range(14)]
    senders = [n for i, n in enumerate(names) for _ in range(20 - i)]
    ts = pd.date_range("2024-01-01", periods=len(senders), freq="min")
    df = pd.DataFrame({"chat": "main", "ts": ts, "sender": senders, "kind": "text", "body": "hola", "date": ts.date,
                       "dow": ts.day_of_week, "hour": ts.hour})
    people = build_global(df, PROFILE_ALL, "t", ES)["people"]
    assert [p["colorIndex"] for p in people] == [*range(12), -1, -1]


def test_global_consistency(web_data):
    g = _load(web_data / "global.json")
    assert sum(sum(row) for row in g["heatmap"]) == g["totals"]["msgs"]
    assert sum(p["msgs"] for p in g["people"]) == g["totals"]["msgs"]
    msgs = [p["msgs"] for p in g["people"]]
    assert msgs == sorted(msgs, reverse=True)
    assert g["people"][0]["colorIndex"] == 0
    months = g["monthly"]["months"]
    assert all(len(s) == len(months) for s in g["monthly"]["series"].values())
    assert {"bruno", "tomi", "ana", "lucas", "caro"} <= set(g["monthly"]["series"])
    assert g["period"]["from"] <= g["period"]["to"]
    for e in g["edges"]:
        assert e["a"] in g["monthly"]["series"] and e["b"] in g["monthly"]["series"] and e["w"] > 0
    assert set(g["starters"]) <= set(g["monthly"]["series"])


def test_person_file_and_records(web_data):
    p = _load(web_data / "people" / "tomi.json")
    assert p["records"]["longest"]["record"]["who"] == "tomi"
    assert len(p["rankByMonth"]) == len(p["monthly"])
    assert len(p["heatmap"]) == 7 and all(len(r) == 24 for r in p["heatmap"])
    assert sum(sum(r) for r in p["heatmap"]) == p["msgs"] == sum(p["monthly"])
    assert sum(p["kinds"].values()) == p["msgs"]
    assert set(p["records"]) == {"longest", "busiestDay", "streak", "silence", "lateNightShare"}
    assert set(p["records"]["streak"]) == {"days", "from", "to"}


def test_person_active_days_are_their_own(web_data, mini_parquet, people):
    df = load_chat(str(mini_parquet), people)
    g = _load(web_data / "global.json")
    for s in g["monthly"]["series"]:
        name = next(p["name"] for p in g["people"] if p["slug"] == s)
        p = _load(web_data / "people" / f"{s}.json")
        assert p["activeDays"] == df.loc[df["sender"] == name, "date"].nunique() > 0
    assert _load(web_data / "people" / "tomi.json")["activeDays"] < g["totals"]["daysActive"]


def test_person_longest_text_is_the_whole_message(web_data, mini_parquet, people):
    """value cuenta caracteres crudos; el texto es el cuerpo entero, solo limpiado (menciones -> nombre corto)."""
    df, raw_all = load_chat(str(mini_parquet), people), pd.read_parquet(mini_parquet)
    exact = 0
    for f in (web_data / "people").glob("*.json"):
        p = _load(f)
        longest = p["records"]["longest"]
        row = df[(df["sender"] == p["name"]) & (df["ts"] == pd.Timestamp(longest["record"]["when"]))]
        assert int(row["n_chars"].max()) == longest["value"], f.name
        assert longest["record"]["text"] == web_text(row["body"].iloc[0], people), f.name
        raw = raw_all[(raw_all["sender"] == p["name"]) & (raw_all["ts"] == pd.Timestamp(longest["record"]["when"]))]
        if "⁨" not in raw["body"].iloc[0]:  # sin menciones, el largo coincide con el contador
            assert len(longest["record"]["text"]) == longest["value"], f.name
            exact += 1
    assert exact > 0


def test_longest_messages_are_not_truncated(mini_parquet, people):
    """records corta el texto a 600 y profile a 1500: la web saca el cuerpo entero de df por (sender, ts)."""
    df = load_chat(str(mini_parquet), people)
    i = df.index[(df["sender"] == "Tomi") & (df["kind"] == "text")][0]
    body = "palabra " * 1000
    df.loc[i, ["body", "n_chars"]] = [body, len(body)]
    plist = build_global(df, PROFILE_ALL, "", ES)["people"]

    longest = build_person(df, "tomi", plist, people, ES)["records"]["longest"]
    assert longest["value"] == len(body) and longest["record"]["text"] == body

    ts = df.loc[i, "ts"]
    rec = {"who": "Tomi", "when": str(ts), "text": body[:600], "chars": len(body)}
    raw = {**MINIMAL_RECORDS, "message_length": {"avg_chars_group": 1.0, "record": rec}}
    assert build_records(raw, plist, people, df, lang=ES)["messageLength"]["record"]["text"] == body
    assert build_records(raw, plist, people, lang=ES)["messageLength"]["record"]["text"] == body[:600]  # sin df, lo de records.json


def test_every_profiled_person_has_a_file(web_data):
    g = _load(web_data / "global.json")
    for s in g["monthly"]["series"]:
        assert (web_data / "people" / f"{s}.json").exists()


def test_facts_shape(web_data):
    f = _load(web_data / "facts.json")
    g = _load(web_data / "global.json")
    assert f["totalMsgs"] == g["totals"]["msgs"]
    assert f["daysActive"] == g["totals"]["daysActive"]
    assert f["peakDow"] in {"lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"}
    assert 0 <= f["peakHour"] <= 23
    assert f["departerPeakMonths"] and all(set(m) == {"month", "n"} for m in f["departerPeakMonths"])
    assert f["departerOvertakeMonth"] is None or f["departerOvertakeMonth"] in g["monthly"]["months"]


def test_clean_text_replaces_mentions(people):
    s = 'hola @⁨Bruno "Brujo" Castro⁩ <b>x</b>'
    assert clean_text(s, people) == "hola Bruno <b>x</b>"


def test_clean_text_nbsp_mention_and_marks(people):
    assert clean_text('@⁨Bruno\xa0"Brujo"\xa0Castro⁩ dale‎', people) == "Bruno dale"


def test_clean_text_plain_mentions_on_android(people):
    """Android no usa aisladores: los @Nombre en texto plano también pierden el nombre completo y los teléfonos."""
    s = 'che @Lucas "Rulo" Benítez, pasale a @5491155555555 o a @+54 9 11 5555-5555 y a @Juan Perez'
    assert clean_text(s, people, ES, isolates=False) == "che Lucas, pasale a @alguien o a @alguien y a @alguien"
    assert clean_text("mail@Bruno.com @bruno castro", people, get_lang("en"), isolates=False) == "mail@Bruno.com Bruno"


def test_clean_text_unknown_isolate_mention_on_ios(people):
    s = "@⁨Juan Perez⁩ y @⁨+54 9 11 5555-5555⁩ con @⁨Tomi \"Tomate\" Suárez🍅⁩"
    assert clean_text(s, people, ES) == "@alguien y @alguien con Tomi"
    assert clean_text("@⁨Juan Perez⁩", people, get_lang("en")) == "@someone"
    assert clean_text("@Juan Perez", people, ES) == "@Juan Perez"  # en un export iOS, un @ suelto es texto


def test_slug():
    assert slug("Caró") == "caro" and slug("Vale") == "vale"


def test_first_message_skips_empty_media_body():
    ts = pd.to_datetime(["2024-01-01 10:00", "2024-01-01 10:05", "2024-01-02 09:00"])
    df = pd.DataFrame({
        "chat": "main", "ts": ts, "sender": ["Tomi", "Tomi", "Ana"], "kind": ["image", "text", "text"],
        "body": ["", "hola", "buenas"], "date": ts.date, "dow": ts.day_of_week, "hour": ts.hour,
    })
    tomi = next(p for p in build_global(df, PROFILE_ALL, "", ES)["people"] if p["slug"] == "tomi")
    assert tomi["firstMessage"] == {"when": "2024-01-01T10:05:00", "text": "hola"}


def test_events_sorted_and_clean(web_data):
    ev = json.loads((web_data / "events.json").read_text())
    assert ev == sorted(ev, key=lambda e: -e["laterDays"])
    assert all("⁨" not in s for e in ev for s in e["sampleOrigin"])


def test_records_poll_parsed(web_data):
    r = json.loads((web_data / "records.json").read_text())
    assert r["poll"]["totalVotes"] == sum(o["votes"] for o in r["poll"]["options"])


def test_departures_counts(web_data):
    m = json.loads((web_data / "departures.json").read_text())
    assert m["person"] == {"slug": "bruno", "name": "Bruno"}
    assert m["reentries"] == sum(x["n"] for x in m["byMonth"])


EVENT_KEYS = {
    "id", "title", "kind", "originDate", "originMsgs", "laterDays", "laterMentions", "note",
    "sampleOrigin", "sampleLater", "topReferencers", "protagonists",
}


def test_events_shape(web_data):
    ev = _load(web_data / "events.json")
    assert ev, "the fixture has at least one event without error"
    series = set(_load(web_data / "global.json")["monthly"]["series"])
    for e in ev:
        assert set(e) == EVENT_KEYS
        assert e["kind"] in {"evento", "saga"}
        assert len(e["protagonists"]) <= 3
        assert set(e["protagonists"]) | set(e["topReferencers"]) <= series
        assert all("⁨" not in s for s in e["sampleLater"])


def test_records_shape(web_data):
    r = _load(web_data / "records.json")
    assert set(r) == {"messageLength", "messagesPerDay", "funniest", "mostReplied", "media", "poll", "latestNight"}
    for key in ("messageLength", "messagesPerDay", "latestNight"):
        assert set(r[key]) == {"value", "record"}
        assert set(r[key]["record"]) == {"who", "when", "text"} | ({"msgs"} if key == "messagesPerDay" else set())
    day = r["messagesPerDay"]["record"]
    assert day["msgs"] > 0 and day["text"] == f"{day['msgs']} mensajes"
    assert "⁨" not in r["messageLength"]["record"]["text"]
    assert set(r["poll"]) == {"question", "options", "who", "when", "totalVotes"}
    assert r["poll"]["options"] == [
        {"label": "Asado", "votes": 3}, {"label": "Pizza", "votes": 2}, {"label": "Nada", "votes": 0}
    ]
    for m in r["media"].values():
        assert set(m) == {"total", "byPerson", "recordDay"}
        assert set(m["recordDay"]) == {"who", "date", "n"}
    assert isinstance(r["funniest"], list) and isinstance(r["mostReplied"], list)


def test_lore_and_departures_shapes(web_data):
    assert _load(web_data / "lore.json") == []  # el fixture no tiene términos de lore
    m = _load(web_data / "departures.json")
    assert set(m) == {
        "person", "reentries", "byMonth", "medianOutHours", "under10Min", "over1Day", "maxDays", "addedBy",
        "scenes", "complaints", "complaintLabel", "complaintCount", "quotesRepeated", "quotesAttributed",
    }
    assert m["complaintLabel"] == 'veces escribió "No me invitó"'
    assert isinstance(m["complaintCount"], int) and m["complaintCount"] >= 0
    assert m["reentries"] == 3 and m["under10Min"] == 2 and m["over1Day"] == 0
    assert m["byMonth"] == [{"month": "2023-09", "n": 2}, {"month": "2024-01", "n": 1}]
    assert m["addedBy"] == [{"slug": "tomi", "n": 1}, {"slug": "ana", "n": 1}]
    assert m["scenes"] == {"days": 1, "withExit": 1, "byYear": {"2023": 1}}
    assert m["quotesRepeated"] == [] and m["quotesAttributed"] == []


PEOPLE = [{"slug": "tomi", "name": "Tomi"}, {"slug": "ana", "name": "Ana"}, {"slug": "resto", "name": "Resto"}]


def test_records_drop_unprofiled_people(people):
    rec = {"who": "Tomi", "when": "2024-01-01 10:00:00", "text": "hola @⁨Ana Rivas⁩", "chars": 10}
    raw = {
        "message_length": {"avg_chars_group": 20.5, "record": rec},
        "messages_per_day": {"avg_group": 9.0, "record": {"date": "2024-01-01", "msgs": 7, "by": {"Pipo": 4, "Ana": 3}}},
        "funniest": {"top": [
            {**rec, "laughs": 3, "people": 2},
            {**rec, "who": "Meta AI", "laughs": 9, "people": 4},
            {**rec, "who": "Pipo", "laughs": 2, "people": 1},
        ]},
        "most_replied": {"top": [{**rec, "who": "Ana", "replies": 5, "people": 3}]},
        "media": {"audio": {"total": 9, "by_person": {"Pipo": 5, "Ana": 4}, "record_day": {"who": "Ana", "date": "2024-01-02", "count": 3}}},
        "latest_night": {"share_by_person": {"Pipo": 0.9, "Ana": 0.2, "Tomi": 0.1}, "record": rec},
        "polls": {"most_voted": {"who": "Ana", "when": "2024-02-01 20:00:00", "votes": 7,
                                 "text": "POLL:\n¿Asado?\nOPTION: Sí (5)\nOPTION: No (1)\nOPTION: Ni (1)"}},
    }
    r = build_records(raw, PEOPLE, people, lang=ES)
    assert r["messageLength"] == {"value": 20.5, "record": {"who": "tomi", "when": "2024-01-01T10:00:00", "text": "hola Ana"}}
    assert r["messagesPerDay"]["record"] == {"who": "ana", "when": "2024-01-01", "text": "7 mensajes", "msgs": 7}
    assert [q["who"] for q in r["funniest"]] == ["tomi"]
    assert r["funniest"][0] == {"who": "tomi", "when": "2024-01-01T10:00:00", "text": "hola Ana", "laughs": 3, "people": 2}
    assert r["mostReplied"][0]["replies"] == 5 and "laughs" not in r["mostReplied"][0]
    assert r["media"]["audio"] == {"total": 9, "byPerson": [{"slug": "ana", "n": 4}], "recordDay": {"who": "ana", "date": "2024-01-02", "n": 3}}
    assert r["latestNight"]["record"]["who"] == "tomi"
    assert r["latestNight"]["value"] == 0.1  # la del dueño del récord, no la más alta
    assert r["poll"] == {
        "question": "¿Asado?", "options": [{"label": "Sí", "votes": 5}, {"label": "No", "votes": 1}, {"label": "Ni", "votes": 1}],
        "who": "ana", "when": "2024-02-01T20:00:00", "totalVotes": 7,
    }


def test_lore_refers_to_threshold_and_top(people):
    rows = [
        ["chimi", 50, 4, 9, "2024-07-22", "Tomi", "Habla chimi", "Tomi", "Ana", 5],
        ["tilo", 80, 3, 7, "2023-12-01", "Ana", "la tilo", "Ana", "Tomi", 4],
        ["xx", 10, 2, 2, "2024-01-01", "Tomi", "xx", "Tomi", "Pipo", 30],
    ]
    cols = ["palabra", "usos", "personas", "dias", "primer_uso", "acuño", "primer_mensaje", "mas_usa", "responde_a", "responde_a_n"]
    lore = build_lore(pd.DataFrame(rows, columns=cols), PEOPLE, people)
    assert [t["w"] for t in lore] == ["tilo", "chimi", "xx"]
    assert lore[1] == {"w": "chimi", "n": 50, "people": 4, "days": 9, "firstUse": "2024-07-22", "coinedBy": "tomi", "refersTo": "ana"}
    assert lore[0]["refersTo"] is None and lore[2]["refersTo"] is None


def test_lore_drops_contact_surnames(people):
    rows = [
        ["castro", 90, 5, 30, "2023-09-02", "Ana", "Castro", "Ana", "Bruno", 9],
        ["Benítez", 70, 4, 20, "2023-09-03", "Tomi", "Benítez", "Tomi", "Ana", 1],
        ["tilo", 80, 3, 7, "2023-12-01", "Ana", "la tilo", "Ana", "Tomi", 4],
    ]
    lore = build_lore(pd.DataFrame(rows, columns=LORE_COLUMNS), PEOPLE, people)
    assert [t["w"] for t in lore] == ["tilo"]


def test_lore_drops_aliases_short_names_and_nickname_words(people):
    rows = [
        ["brujo", 95, 5, 30, "2023-09-02", "Ana", "brujo", "Ana", "Bruno", 9],  # alias de people.json
        ["Tomi", 85, 5, 30, "2023-09-02", "Ana", "Tomi", "Ana", "Tomi", 9],  # nombre corto
        ["jefá", 75, 4, 20, "2023-09-03", "Tomi", "jefa", "Tomi", "Ana", 1],  # palabra de un apodo, con o sin acento
        ["tilo", 80, 3, 7, "2023-12-01", "Ana", "la tilo", "Ana", "Tomi", 4],
    ]
    lore = build_lore(pd.DataFrame(rows, columns=LORE_COLUMNS), PEOPLE, people, {"Ana": "La Jefa"})
    assert [t["w"] for t in lore] == ["tilo"]


def test_departures_added_by_keeps_profiled_names_only(people):
    r = pd.DataFrame({
        "reentry": pd.to_datetime(["2024-01-01 10:00", "2024-01-05 10:00", "2024-02-01 10:00", "2024-02-02 10:00"]),
        "added_by": ["Tomi", "-", "Se", "Tomi"],
        "out_hours": [0.1, 30.0, 2.0, 50.0],
    })
    m = build_departures(r, {}, {}, PEOPLE, people, "Bruno", ES)
    assert m["addedBy"] == [{"slug": "tomi", "n": 2}]
    assert m["over1Day"] == 2 and m["under10Min"] == 1
    assert m["maxDays"] == 2.1 and m["medianOutHours"] == 16.0
    assert m["scenes"] == {"days": 0, "withExit": 0, "byYear": {}} and m["complaints"] == []


MINIMAL_RECORDS = {
    "message_length": {"avg_chars_group": 0.0, "record": {"who": "Tomi", "when": "2024-01-01 10:00:00", "text": "x"}},
    "messages_per_day": {"avg_group": 1.0, "record": {"date": "2024-01-01", "msgs": 1, "by": {"Tomi": 1}}},
    "funniest": {"top": []},
    "most_replied": {"top": []},
    "media": {},
    "latest_night": {"share_by_person": {"Tomi": 0.0}, "record": None},
}


def test_records_without_polls_or_late_night(people):
    r = build_records(MINIMAL_RECORDS, PEOPLE, people, lang=ES)
    assert r["poll"] is None and r["latestNight"] is None
    assert r["funniest"] == [] and r["mostReplied"] == [] and r["media"] == {}


def test_late_night_share_of_holder_outside_top10_comes_from_df(people):
    night = {"share_by_person": {"Tomi": 0.5}, "record": {"who": "Ana", "when": "2024-01-01 04:00:00", "text": "zz"}}
    df = pd.DataFrame({"sender": ["Ana", "Ana", "Ana", "Tomi"], "hour": [4, 12, 13, 2],
                       "ts": pd.to_datetime(["2024-01-01 04:00", "2024-01-01 12:00", "2024-01-01 13:00", "2024-01-02 02:00"]),
                       "body": ["zz", "a", "b", "c"], "n_chars": [2, 1, 1, 1]})
    r = build_records({**MINIMAL_RECORDS, "latest_night": night}, PEOPLE, people, df, lang=ES)
    assert r["latestNight"] == {"value": 0.333, "record": {"who": "ana", "when": "2024-01-01T04:00:00", "text": "zz"}}


LEAK = 'Pero Ana prefiere la plaza de enfrente\n[14/3/25, 6:12:41 p. m.] Tomi "Tomate" Suárez🍅:'


def test_web_text_cuts_export_headers(people):
    assert web_text(LEAK, people) == "Pero Ana prefiere la plaza de enfrente"
    assert web_text("hola\n[1/2/2024, 10:00] X Y: chau", people) == "hola"
    assert web_text("una lista\n[1] item", people) == "una lista\n[1] item"


def test_export_headers_never_reach_the_web(people):
    quotes = {"repeated": [{"ts": "2024-01-01 10:00:00", "phrase": LEAK, "times": 3, "people": 2}],
              "attributed": [{"ts": "2024-01-01 10:00:00", "by": "Ana", "quote": LEAK}]}
    m = build_departures(pd.DataFrame(columns=["reentry", "added_by", "out_hours"]), {}, quotes, PEOPLE, people,
                         "Ana", ES)
    assert m["quotesRepeated"][0]["text"] == m["quotesAttributed"][0]["text"] == "Pero Ana prefiere la plaza de enfrente"
    ev = {"id": "x", "title": "X", "kind": "evento", "note": "", "origin_date": "2024-01-01", "origin_day_msgs": 1,
          "origin_day_top_senders": {}, "later_mentions": 0, "later_days": 0, "top_referencers": {},
          "sample_origin": ["12:00 Tomi: " + LEAK], "sample_later": ["2024-02-01 Tomi: " + LEAK]}
    e = build_events([ev], PEOPLE, people)[0]
    assert e["sampleOrigin"] == ["12:00 Tomi: Pero Ana prefiere la plaza de enfrente"]
    assert e["sampleLater"] == ["2024-02-01 Tomi: Pero Ana prefiere la plaza de enfrente"]
    top = [{"who": "Tomi", "when": "2024-01-01 10:00:00", "text": LEAK, "laughs": 1, "people": 1}]
    r = build_records({**MINIMAL_RECORDS, "funniest": {"top": top}}, PEOPLE, people, lang=ES)
    assert r["funniest"][0]["text"] == "Pero Ana prefiere la plaza de enfrente"


def test_read_json_empty_file_uses_default(tmp_path):
    (tmp_path / "e.json").write_text("")
    assert read_json(tmp_path / "e.json", []) == []


def test_departures_ignores_rows_without_reentry_time(people):
    r = pd.DataFrame({"reentry": pd.to_datetime(["2024-01-01 10:00", None]), "added_by": ["Tomi", "Tomi"],
                      "out_hours": [1.0, 2.0]})
    m = build_departures(r, {}, {}, PEOPLE, people, "Bruno", ES)
    assert m["reentries"] == 1 == sum(x["n"] for x in m["byMonth"])


def test_copy_review_reminds_when_export_is_newer():
    msg = copy_review_message("2026-11-09", "2026-12-20")
    assert "2026-11-09" in msg and "2026-12-20" in msg
    assert msg.startswith("Copy review: the copy was verified on 2026-11-09")
    assert "heatmap.lede" in msg and "hero.bubbles" in msg and "bump verifiedOn" in msg


def test_copy_review_ok_when_verified_on_or_after_export_end():
    for verified_on in ("2026-12-20", "2027-01-01"):
        msg = copy_review_message(verified_on, "2026-12-20")
        assert msg == f"Copy verified on {verified_on} (export ends 2026-12-20): OK."


def test_run_prints_copy_review_to_stderr(mini_parquet, mini_out, tmp_path, capsys):
    from build_web_data import run

    cfg = web_config(tmp_path, verifiedOn="2000-01-01")
    run(["--config", str(cfg), "--content", str(CONTENT), "--data", str(mini_parquet), "--analysis", str(mini_out),
         "--out", str(tmp_path / "web"), "--min-msgs", "1"])
    err = capsys.readouterr().err
    assert "Copy review: the copy was verified on 2000-01-01" in err


def test_run_removes_stale_profiles_from_an_earlier_run(mini_parquet, mini_out, tmp_path):
    from build_web_data import run

    stale = tmp_path / "web" / "people" / "zeta.json"
    stale.parent.mkdir(parents=True)
    stale.write_text("{}", encoding="utf-8")
    run(["--config", str(web_config(tmp_path)), "--content", str(CONTENT), "--data", str(mini_parquet),
         "--analysis", str(mini_out), "--out", str(tmp_path / "web"), "--min-msgs", "1"])
    assert not stale.exists() and (tmp_path / "web" / "people" / "ana.json").exists()


def test_run_rejects_a_departer_who_is_not_in_people(mini_parquet, mini_out, tmp_path):
    from build_web_data import run

    with pytest.raises(SystemExit, match="departer 'Zeta'"):
        run(["--config", str(web_config(tmp_path, departer="Zeta")), "--content", str(CONTENT),
             "--data", str(mini_parquet), "--analysis", str(mini_out), "--out", str(tmp_path / "web")])


def test_run_without_config_exits_with_a_clear_message(mini_parquet, mini_out, tmp_path):
    from build_web_data import run

    with pytest.raises(SystemExit, match="no se pudo leer"):
        run(["--config", str(tmp_path / "nope.json"), "--content", str(CONTENT), "--data", str(mini_parquet),
             "--analysis", str(mini_out), "--out", str(tmp_path / "web")])


def _is_empty(v) -> bool:
    return all(_is_empty(x) for x in v.values()) if isinstance(v, dict) else not v


def test_departures_complaint_count_comes_from_the_scenes_chip(people):
    m = build_departures(pd.DataFrame(columns=REENTRY_COLUMNS), {"complaint_chip": 7}, {}, PEOPLE, people, "Bruno", ES)
    assert m["complaintCount"] == 7


def test_departures_without_departer_keeps_the_populated_shape(web_data, people):
    full = _load(web_data / "departures.json")
    empty = build_departures(pd.DataFrame(columns=REENTRY_COLUMNS), {}, {}, PEOPLE, people, None, ES)
    assert empty["person"] is None and full["person"] is not None
    assert empty.keys() == full.keys()
    for k in full.keys() - {"person", "complaintLabel"}:  # la etiqueta del chip es del idioma, no un dato
        assert type(empty[k]) is type(full[k]) and _is_empty(empty[k]), k
    assert empty["scenes"].keys() == full["scenes"].keys()
    assert empty["complaintLabel"] == full["complaintLabel"]
    en = build_departures(pd.DataFrame(columns=REENTRY_COLUMNS), {}, {}, PEOPLE, people, None, get_lang("en"))
    assert en["complaintLabel"] == 'times wrote "didn\'t invite me"'


def test_global_has_title_and_lang(web_data):
    g = _load(web_data / "global.json")
    assert g["title"] == "Los del Parque" and g["lang"] == "es"


def test_facts_departer_fields_renamed(web_data):
    f = _load(web_data / "facts.json")
    assert sorted(k for k in f if k.startswith("departer")) == [
        "departerMonthsToTop", "departerOvertakeMonth", "departerPeakMonths"]


def test_run_without_departer_writes_empty_departures_and_facts(mini_parquet, mini_out, tmp_path):
    from build_web_data import run

    out = tmp_path / "web"
    run(["--config", str(web_config(tmp_path, departer=None)), "--content", str(CONTENT),
         "--data", str(mini_parquet), "--analysis", str(mini_out), "--out", str(out), "--min-msgs", "1"])
    d = _load(out / "departures.json")
    assert d["person"] is None and d["reentries"] == 0 and d["byMonth"] == [] and d["scenes"]["days"] == 0
    f = _load(out / "facts.json")
    assert f["departerOvertakeMonth"] is None and f["departerMonthsToTop"] is None and f["departerPeakMonths"] == []


def test_load_all_keeps_system_rows(mini_parquet, people):
    group, everything = load_chat(str(mini_parquet), people), load_all(str(mini_parquet), people)
    assert len(everything) > len(group)
    assert (everything["kind"].astype(str) == "system").any()
    assert not (group["kind"].astype(str) == "system").any()
    assert everything["is_system"].any() and not group["is_system"].any()




def test_run_counts_only_the_words_in_badwords_txt(mini_parquet, mini_out, tmp_path, monkeypatch):
    """badwords.txt arranca de la lista base del idioma pero manda: una palabra base que se borra deja de contar (no
    se le vuelve a sumar la base)."""
    import shutil

    import build_web_data

    seen = []
    real = build_web_data.language.badword_hits
    monkeypatch.setattr(build_web_data.language, "badword_hits", lambda df, words, lang: seen.append(words) or real(df, words, lang))
    content = tmp_path / "content"
    shutil.copytree(CONTENT, content)
    (content / "badwords.txt").write_text("# solo esta\nboludo\n", encoding="utf-8")
    build_web_data.run(["--config", str(web_config(tmp_path)), "--content", str(content), "--data", str(mini_parquet),
                        "--analysis", str(mini_out), "--out", str(tmp_path / "web"), "--min-msgs", "1"])
    assert seen == [{"boludo"}]
