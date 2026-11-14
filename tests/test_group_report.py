import json
from pathlib import Path

import build_dataset
import group_report
import pandas as pd
import pytest
from web import census
from wa.lang import get_lang

ES = get_lang("es")

FORMATS = Path(__file__).resolve().parent / "fixtures" / "formats"

N_BRUNO_REENTRIES = 3  # las re-entradas de Bruno en el fixture


def _group(mini_parquet):
    df = pd.read_parquet(mini_parquet)
    df["sender"] = df["sender"].astype(str)
    return df


def test_reentries_for_named_person(mini_parquet, people):
    df = _group(mini_parquet)
    ev = group_report.membership(df, people, ES)
    assert len(group_report.departer_reentries(df, ev, "Bruno")) == N_BRUNO_REENTRIES
    assert group_report.departer_reentries(df, ev, "Nadie").empty


def test_candidates_sorted(mini_parquet, people):
    ev = group_report.membership(_group(mini_parquet), people, ES)
    # Bruno: 3 entradas únicas, la primera (alta inicial) no cuenta; Caro solo fue quitada, nunca volvió.
    assert group_report.departure_candidates(ev) == [("Bruno", N_BRUNO_REENTRIES - 1)]


def _format_df(name, people):
    return build_dataset.build([(str(FORMATS / f"{name}.txt"), "main")], people)


@pytest.mark.parametrize("name", ["ios-es", "ios-en", "android-es", "android-en", "ios-es-24h"])
def test_membership_from_format_fixtures(name, people):
    ev = group_report.membership(_format_df(name, people), people, ES)
    assert list(ev.columns) == ["ts", "ev", "quien", "por", "quien_c", "por_c"]
    assert {"añadió", "link", "salió", "quitó", "nombre"} <= set(ev["ev"])
    added = ev[ev["ev"] == "añadió"]
    assert list(added["quien_c"]) == ["Bruno", "Caro", "Tomi"]
    assert list(added["por_c"]) == ["Ana", people.me, "Ana"]  # "Añadiste a Caro" lo hace el dueño
    removed = ev[ev["ev"] == "quitó"].iloc[0]
    assert (removed["quien_c"], removed["por_c"]) == ("Bruno", "Ana")
    left = ev[ev["ev"] == "salió"].iloc[0]
    assert left["quien_c"] == "Bruno" and left["por"] == "-" and left["por_c"] == "-"
    assert list(ev[ev["ev"] == "link"]["quien_c"]) == ["Lucas", "Bruno"]
    renamed = ev[ev["ev"] == "nombre"].iloc[0]
    assert (renamed["quien"], renamed["por_c"]) == ("Los del Parque 🌳", "Tomi")


def test_membership_from_android_fixture(people):
    ev = group_report.membership(_format_df("android-es", people), people, ES)
    for kind in ("añadió", "link", "salió", "quitó", "nombre"):
        assert (ev["ev"] == kind).any(), kind
    caro = ev[(ev["ev"] == "añadió") & (ev["quien_c"] == "Caro")].iloc[0]
    assert caro["por_c"] == people.me


def _sys_rows(*rows):
    df = pd.DataFrame(rows, columns=["ts", "kind", "sys_event", "sys_who", "sys_by"])
    df["body"] = "aviso"
    df["ts"] = pd.to_datetime(df["ts"])
    return df


@pytest.mark.parametrize("who", ["Bruno, Caro y Tomi", "Bruno, Caro and Tomi"])
def test_membership_splits_multi_person_adds(who, people):
    df = _sys_rows(("2024-01-01 10:00", "system", "added", who, "Ana"),
                   ("2024-01-01 10:01", "text", "", "", ""))
    ev = group_report.membership(df, people, ES)
    assert list(ev["quien"]) == ["Bruno", "Caro", "Tomi"] and set(ev["ev"]) == {"añadió"}
    assert set(ev["por_c"]) == {"Ana"}


def test_membership_ignores_other_events_and_empty_who(people):
    df = _sys_rows(("2024-01-01 10:00", "system", "added", "", "Ana"),
                   ("2024-01-01 10:01", "system", "photo_changed", "", "Ana"),
                   ("2024-01-01 10:02", "system", "admin", "Tomi", ""),
                   ("2024-01-01 10:03", "system", "added", "Bruno", "?"))
    ev = group_report.membership(df, people, ES)
    assert list(zip(ev["quien"], ev["por"])) == [("Bruno", "?")] and ev["por_c"].iloc[0] == "?"


@pytest.mark.parametrize("event, ev", [("left", "salió"), ("joined_link", "link")])
def test_membership_does_not_split_left_or_link(event, ev, people):
    df = _sys_rows(("2024-01-01 10:00", "system", event, "Ana y Lu", "-"),
                   ("2024-01-01 10:01", "system", event, "Ana and Lu", "-"))
    out = group_report.membership(df, people, ES)
    assert list(out["quien"]) == ["Ana y Lu", "Ana and Lu"] and set(out["ev"]) == {ev}


def test_membership_keeps_known_multiword_contact_in_added():
    from wa.names import People

    known = People(me="Ana", names={"Tom and Jerry": "TJ"})
    df = _sys_rows(("2024-01-01 10:00", "system", "added", "Tom and Jerry", "Ana"),
                   ("2024-01-01 10:01", "system", "added", "TJ", "Ana"),
                   ("2024-01-01 10:02", "system", "removed", "Tom and Jerry", "Ana"),
                   ("2024-01-01 10:03", "system", "added", "Bruno and Caro", "Ana"))
    out = group_report.membership(df, known, ES)
    assert list(zip(out["ev"], out["quien"], out["quien_c"])) == [
        ("añadió", "Tom and Jerry", "TJ"), ("añadió", "TJ", "TJ"), ("quitó", "Tom and Jerry", "TJ"),
        ("añadió", "Bruno", "Bruno"), ("añadió", "Caro", "Caro")]


@pytest.mark.parametrize("lang, label", [("es", "(sin nombre)"), ("en", "(unnamed)")])
def test_membership_nameless_rename_keeps_the_row_with_a_label(lang, label, people):
    # el cuerpo del aviso trae el nombre de contacto crudo: no se usa como rótulo
    df = _sys_rows(("2024-01-01 10:00", "system", "name_changed", "", 'Tomi "Tomate" Suárez🍅'))
    df["body"] = 'Tomi "Tomate" Suárez🍅 cambió el nombre del grupo'
    out = group_report.membership(df, people, get_lang(lang))
    assert list(zip(out["ev"], out["quien"], out["por_c"])) == [("nombre", label, "Tomi")]


def test_membership_empty(people):
    ev = group_report.membership(_sys_rows(("2024-01-01 10:01", "text", "", "", "")), people, ES)
    assert ev.empty and list(ev.columns) == ["ts", "ev", "quien", "por", "quien_c", "por_c"]


def _ev(rows):
    ev = pd.DataFrame(rows, columns=["ts", "ev", "quien_c"])
    ev["ts"] = pd.to_datetime(ev["ts"])
    return ev


def test_candidates_empty_when_nobody_left():
    ev = _ev([("2024-01-01 10:00", "añadió", "Ana"), ("2024-01-02 10:00", "link", "Tomi"),
              ("2024-03-01 10:00", "añadió", "Ana")])
    assert group_report.departure_candidates(ev) == []


def test_candidates_count_only_entries_after_a_leave():
    ev = _ev([("2024-01-01 10:00", "añadió", "Lucas"), ("2024-01-02 10:00", "salió", "Lucas"),
              ("2024-01-03 10:00", "link", "Lucas"), ("2024-01-04 10:00", "salió", "Lucas"),
              ("2024-01-05 10:00", "añadió", "Lucas"),
              ("2024-01-01 11:00", "añadió", "Caro"), ("2024-02-01 10:00", "quitó", "Caro"),
              ("2024-02-02 10:00", "añadió", "Caro"),
              ("2024-01-01 12:00", "añadió", "Ana")])  # Ana entró una vez y no se fue: no es candidata
    assert group_report.departure_candidates(ev) == [("Lucas", 2), ("Caro", 1)]


def test_quotes_use_given_aliases(mini_parquet):
    df = _group(mini_parquet)
    texts = pd.DataFrame({
        "ts": pd.to_datetime(["2024-01-01 10:00", "2024-01-01 10:01"]),
        "sender": ["Ana", "Ana"], "kind": ["text", "text"],
        "body": ['Bruno: "esa sopa la cocino yo"', 'Zeta: "esto no debería salir nunca"'],
        "n_chars": [34, 36], "date": [pd.Timestamp("2024-01-01").date()] * 2,
    })
    by_bruno = group_report.departer_quotes(texts, ["Bruno"], ES)["attributed"]
    assert [q["quote"] for q in by_bruno] == ["esa sopa la cocino yo"]
    by_zeta = group_report.departer_quotes(texts, ["Zeta"], ES)["attributed"]
    assert [q["quote"] for q in by_zeta] == ["esto no debería salir nunca"]
    assert group_report.departer_quotes(df, ["Bruno", "Brujo"], ES)["attributed"] is not None


def test_run_without_departer_writes_no_departures(mini_parquet, people_path, tmp_path):
    group_report.run(["--data", str(mini_parquet), "--chat", "main", "--out", str(tmp_path),
                      "--people", str(people_path)])
    for name in ("departures.csv", "departures_scenes.json", "departures_quotes.json"):
        assert not (tmp_path / name).exists()
    assert (tmp_path / "peak_days.json").exists() and (tmp_path / "membership_events.csv").exists()
    assert "sin capítulo de salidas" in (tmp_path / "report.md").read_text(encoding="utf-8")


def test_run_with_departer_writes_departures(mini_out):
    assert len(pd.read_csv(mini_out / "departures.csv")) == N_BRUNO_REENTRIES
    assert "attributed" in json.loads((mini_out / "departures_quotes.json").read_text(encoding="utf-8"))
    assert "scenes" in json.loads((mini_out / "departures_scenes.json").read_text(encoding="utf-8"))
    assert "sin capítulo de salidas" not in (mini_out / "report.md").read_text(encoding="utf-8")


def test_census_without_departer_has_no_marker(people):
    df = pd.DataFrame(
        [("2024-01-01 10:00", "Ana", "hola", "text"), ("2024-02-01 10:00", "Tomi", "chau", "text")],
        columns=["ts", "sender", "body", "kind"],
    )
    df["ts"] = pd.to_datetime(df["ts"])
    df["is_system"] = df["kind"] == "system"
    df[["sys_event", "sys_who", "sys_by"]] = ""
    df["hour"] = df["ts"].dt.hour
    df["date"] = df["ts"].dt.date
    cens = census.build_census(df, [{"name": "Ana", "slug": "ana"}], [], [], 0, None, people, ES)
    assert all(i["kind"] != "departures" for i in cens["timeline"])


def test_departer_scenes_english_curly_apostrophe():
    ts = pd.to_datetime(["2024-01-01 10:00", "2024-01-01 11:00", "2024-01-02 10:00"])
    group = pd.DataFrame({"ts": ts, "date": ts.date, "sender": ["Bruno", "Bruno", "Ana"], "kind": "text",
                         "body": ["you didn’t invite me again", "you didn't invite me", "bruno is jealous lol"]})
    reentries = pd.DataFrame({"reentry": pd.to_datetime([])})
    scenes = group_report.departer_scenes(group, reentries, "Bruno", ["Bruno"], get_lang("en"))
    assert scenes["total_complaint_msgs"] == 2 and scenes["complaint_chip"] == 2
    assert scenes["days_with_2plus_complaints"] == 1 and scenes["total_accusation_msgs"] == 1
    assert scenes["top_complaints"] == {"you didnt invite me again": 1, "you didnt invite me": 1}


# ---------------------------------------------------------------- días pico
FILLER = "que de la el en y los se del las un por con no una su para es al lo como"  # solo stopwords: sin tokens


def _day_rows(day, n, hour=12, bodies=()):
    """`n` mensajes de texto de `day`, uno por minuto desde la hora `hour`: los primeros con `bodies`, el resto relleno sin tokens."""
    bodies = list(bodies) + [FILLER] * (n - len(bodies))
    ts = [pd.Timestamp(day) + pd.Timedelta(hours=hour, minutes=i) for i in range(n)]
    return [{"ts": t, "date": t.date(), "hour": t.hour, "sender": "Ana" if i % 2 else "Tomi", "kind": "text",
             "body": b, "n_chars": len(b)} for i, (t, b) in enumerate(zip(ts, bodies))]


def _peak_frame(spike_n, spike_bodies=(), hour=12):
    """30 días tranquilos (10 mensajes) y un día pico de `spike_n` mensajes en el medio (2025-04-16)."""
    days = pd.date_range("2025-04-01", periods=31, freq="D")
    rows = []
    for d in days:
        if d == pd.Timestamp("2025-04-16"):
            rows += _day_rows(d, spike_n, hour, spike_bodies)
        else:
            rows += _day_rows(d, 10, hour)
    return pd.DataFrame(rows)


def _peak(df):
    return next(p for p in group_report.peak_days(df, ES) if p["date"] == "2025-04-16")


def test_peak_day_keywords_floor_depends_on_the_days_size():
    word = "chimichurri muy rico, gracias al que lo trajo"
    small = _peak(_peak_frame(60, [word] * 3))
    assert "chimichurri" in small["keywords"]  # 60 mensajes: 3 veces alcanza (piso 2)
    big = _peak(_peak_frame(250, [word] * 3))
    assert "chimichurri" not in big["keywords"]  # 250 mensajes: 3 veces no alcanza (piso 4)


def test_peak_day_sample_prefers_the_days_keywords():
    body = "la parrilla ya está prendida desde temprano"
    peak = _peak(_peak_frame(40, [FILLER] * 30 + [body] * 6))  # 6 de 40 mensajes de la hora pico la nombran
    assert peak["keywords"][0] == "parrilla"
    assert len(peak["sample"]) == 8
    assert sum("parrilla" in line for line in peak["sample"]) >= 5
    assert peak["sample"] == sorted(peak["sample"])  # cronológica (un mensaje por minuto: HH:MM ordena)
    assert _peak(_peak_frame(40, [FILLER] * 30 + [body] * 6))["sample"] == peak["sample"]  # reproducible


def test_synth_barbecue_peak_day_has_its_keyword(synth_data):
    from synth.story import EVENT_DAYS

    peaks = json.loads((synth_data("es").parent / "data" / "analysis" / "peak_days.json").read_text(encoding="utf-8"))
    day = next(p for p in peaks if p["date"] == EVENT_DAYS["asado"].isoformat())
    assert "asado" in day["keywords"], day["keywords"]


def test_peak_day_sample_of_one_minute_keeps_chat_order():
    """Android exports have minute resolution: messages of the same minute keep the order of the chat."""
    df = _peak_frame(40)
    spike = df["date"] == pd.Timestamp("2025-04-16").date()
    df.loc[spike, "ts"] = pd.Timestamp("2025-04-16 12:00")
    df.loc[spike, "body"] = [f"mensaje {i:02d} {FILLER}" for i in range(int(spike.sum()))]
    df["n_chars"] = df["body"].str.len()
    order = [int(line.split("mensaje ")[1][:2]) for line in _peak(df)["sample"]]
    assert len(order) == 8 and order == sorted(order)
