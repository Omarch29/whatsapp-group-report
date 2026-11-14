"""Capítulos Censo, Multimedia, Emojis y Encuestas (scripts/web/{census,media,emojis,polls}.py)."""
import json

import pandas as pd

from build_web_data import load_chat
from conftest import LEGACY, RENAMED_GROUP, ROOT
from web.census import build_census
from web.media import normalize_domain
from wa.locales import IOS_ES
from wa.parser import OWNER, classify
from wa.lang import get_lang

ES = get_lang("es")
FORMATS = ROOT / "tests" / "fixtures" / "formats"


def _load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def _profiled(web_data) -> dict[str, str]:
    g = _load(web_data / "global.json")
    return {p["name"]: p["slug"] for p in g["people"] if p["slug"] != "resto"}


# ---------------------------------------------------------------- censo
def test_census_shape(web_data):
    c = _load(web_data / "census.json")
    assert set(c) == {"timeline", "names", "tenure", "absence", "byYear", "hourOfEach", "earlyBird", "owl"}
    for item in c["timeline"]:
        assert set(item) == {"when", "kind", "label", "slug", "href"}
        assert item["kind"] in {"name", "photo", "join", "leave", "peak", "event", "departures"}
    assert set(c["names"]) == {"longest", "shortest"}
    assert set(c["byYear"]) == {"years", "series"}
    assert all(isinstance(y, str) for y in c["byYear"]["years"])


def test_census_timeline_sorted_with_one_departures_marker(web_data):
    c = _load(web_data / "census.json")
    whens = [t["when"] for t in c["timeline"]]
    assert whens == sorted(whens)
    bruno = [t for t in c["timeline"] if t["kind"] == "departures"]
    reentries = _load(web_data / "departures.json")["reentries"]
    assert bruno == [{"when": bruno[0]["when"], "kind": "departures", "label": f"{reentries} vueltas", "slug": "bruno",
                      "href": "/salidas/"}]
    # Las 3 vueltas del Bruno en el fixture no se dibujan como salidas sueltas.
    assert not any(t["kind"] == "leave" and t["slug"] == "bruno" for t in c["timeline"])
    # "Ana quitó a Caro" (18/1/24) sí es una salida.
    leaves = [t for t in c["timeline"] if t["kind"] == "leave"]
    assert leaves == [{"when": "2024-01-18T18:20:00", "kind": "leave", "label": "Caro", "slug": "caro",
                       "href": "/p/caro/"}]


def test_census_timeline_items(web_data):
    c = _load(web_data / "census.json")
    slugs = set(_profiled(web_data).values())
    joins = [t for t in c["timeline"] if t["kind"] == "join"]
    assert {t["slug"] for t in joins} == slugs and all(t["href"] == f"/p/{t['slug']}/" for t in joins)
    names = [t for t in c["timeline"] if t["kind"] == "name"]
    assert [t["label"] for t in names] == [RENAMED_GROUP] and names[0]["slug"] == "tomi"
    events = [t for t in c["timeline"] if t["kind"] == "event"]
    assert len(events) == len(_load(web_data / "events.json"))
    assert all(t["href"] == "/eventos/#rail" for t in events)


def test_census_names_tenure_and_years(web_data, mini_parquet, people):
    c = _load(web_data / "census.json")
    g = _load(web_data / "global.json")
    # Un solo cambio de nombre: el más largo y el más corto son el mismo.
    assert c["names"]["longest"] == c["names"]["shortest"]
    assert c["names"]["longest"]["label"] == RENAMED_GROUP
    assert set(c["names"]["longest"]) == {"label", "days", "seconds", "from", "to"}
    assert c["names"]["longest"]["to"][:10] == g["period"]["to"]
    slugs = _profiled(web_data)
    assert {t["slug"] for t in c["tenure"]} == set(slugs.values())
    for t in c["tenure"]:
        assert t["from"] <= t["to"] and all(gap["days"] > 30 for gap in t["gaps"])
    # Lucas no escribe entre el 20/10/23 y el 30/11/23: la ausencia más larga del fixture (41 días).
    gaps = [gap["days"] for t in c["tenure"] for gap in t["gaps"]]
    assert c["absence"] == {"slug": "lucas", "from": "2023-10-20", "to": "2023-11-30", "days": 41} and max(gaps) == 41
    df = load_chat(str(mini_parquet), people)
    for name, s in slugs.items():
        assert sum(c["byYear"]["series"][s]) == int((df["sender"] == name).sum())
        assert len(c["byYear"]["series"][s]) == len(c["byYear"]["years"])


def test_census_hours(web_data, mini_parquet, people):
    c = _load(web_data / "census.json")
    df = load_chat(str(mini_parquet), people)
    slugs = _profiled(web_data)
    by_slug = {h["slug"]: h for h in c["hourOfEach"]}
    for name, s in slugs.items():
        hours = df.loc[df["sender"] == name, "hour"]
        assert hours.value_counts()[by_slug[s]["hour"]] == hours.value_counts().max()
    owl = c["owl"]
    assert owl["slug"] == "lucas"  # el único que escribe dos veces de madrugada
    assert 0 < owl["share"] <= 1


TOMI = 'Tomi "Tomate" Suárez🍅'


def _sys_df(rows):
    """df_all mínimo: filas (ts, sender, body, kind). Las de sistema llevan su evento estructurado, el que daría el
    parser (iOS es) al leer el aviso; el dueño del export es "Ana"."""
    df = pd.DataFrame(rows, columns=["ts", "sender", "body", "kind"])
    sys = [classify(f"\u200e{b}", IOS_ES).sys if k == "system" else ("", "", "") for b, k in zip(df["body"], df["kind"])]
    df[["sys_event", "sys_who", "sys_by"]] = [[x.replace(OWNER, "Ana") for x in t] for t in sys]
    df["ts"] = pd.to_datetime(df["ts"])
    df["is_system"] = df["kind"] == "system"
    df["hour"] = df["ts"].dt.hour
    df["date"] = df["ts"].dt.date
    return df


def test_census_photos_names_and_departures_marker(people):
    df = _sys_df([
        ("2024-01-01 10:00", "Tomi", "hola", "text"),
        ("2024-01-02 10:00", "Bruno", "buenas", "text"),
        ("2024-01-03 10:00", "__grupo__", f"{TOMI} cambió la imagen de este grupo.", "system"),
        ("2024-01-04 10:00", "__grupo__", "Cambiaste el ícono de este grupo.", "system"),
        ("2024-01-05 10:00", "__grupo__", f'{TOMI} cambió el nombre del grupo a "Uno"', "system"),
        ("2024-01-06 10:00", "__grupo__", 'Bruno "Brujo" Castro salió del grupo.', "system"),
        ("2024-01-07 10:00", "__grupo__", 'Bruno "Brujo" Castro se unió con el enlace del grupo.', "system"),
        ("2024-01-15 10:00", "__grupo__", f'{TOMI} cambió el nombre del grupo a "Dos"', "system"),
        ("2024-01-16 10:00", "__grupo__", f'{TOMI} cambió el nombre del grupo a "Tres"', "system"),
        ("2024-01-20 10:00", "__grupo__", f'{TOMI} quitó a Bruno "Brujo" Castro.', "system"),
        ("2024-03-01 10:00", "Tomi", "chau", "text"),
    ])
    plist = [{"name": "Tomi", "slug": "tomi"}, {"name": "Bruno", "slug": "bruno"}, {"name": "Resto", "slug": "resto"}]
    c = build_census(df, plist, events=[], peaks=[], departures=173, departer="Bruno", people_names=people, lang=ES)
    photos = [t for t in c["timeline"] if t["kind"] == "photo"]
    assert [(t["label"], t["slug"]) for t in photos] == [("Nueva foto", "tomi"), ("Nueva foto", None)]
    bruno = [t for t in c["timeline"] if t["kind"] == "departures"]
    assert len(bruno) == 1 and bruno[0]["label"] == "173 vueltas" and bruno[0]["when"].startswith("2024-01-07")
    # La salida y la expulsión son del Bruno: van en su marcador.
    assert not [t for t in c["timeline"] if t["kind"] == "leave"]
    # Uno duró 10 días, Dos 1 día, Tres (el actual) hasta el final del export: 45 días.
    assert c["names"]["longest"]["label"] == "Tres" and c["names"]["longest"]["days"] == 45
    assert c["names"]["longest"]["seconds"] == 45 * 86400
    assert c["names"]["shortest"]["label"] == "Dos" and c["names"]["shortest"]["days"] == 1
    assert c["names"]["shortest"]["seconds"] == 86400 and isinstance(c["names"]["shortest"]["seconds"], int)
    # Tomi no escribe entre el 1/1 y el 1/3: 60 días de ausencia.
    assert c["absence"] == {"slug": "tomi", "from": "2024-01-01", "to": "2024-03-01", "days": 60}


def test_census_names_seconds_for_short_lived_names(people):
    df = _sys_df([
        ("2024-01-01 10:00:00", "Tomi", "hola", "text"),
        ("2024-01-05 10:00:00", "__grupo__", f'{TOMI} cambió el nombre del grupo a "Tipo"', "system"),
        ("2024-01-05 10:00:51", "__grupo__", f'{TOMI} cambió el nombre del grupo a "Tipeo"', "system"),
        ("2024-01-09 10:00:00", "__grupo__", f'{TOMI} cambió el nombre del grupo a "Final"', "system"),
        ("2024-01-10 10:00:00", "Tomi", "chau", "text"),
    ])
    c = build_census(df, [{"name": "Tomi", "slug": "tomi"}], events=[], peaks=[], departures=0, departer="Bruno", people_names=people, lang=ES)
    assert c["names"]["shortest"]["label"] == "Tipo"
    assert c["names"]["shortest"]["days"] == 0.0 and c["names"]["shortest"]["seconds"] == 51


def test_census_without_name_changes_or_reentries(people):
    df = _sys_df([("2024-01-01 10:00", "Tomi", "hola", "text"), ("2024-01-02 10:00", "Tomi", "chau", "text")])
    c = build_census(df, [{"name": "Tomi", "slug": "tomi"}], events=[], peaks=[], departures=0, departer="Bruno", people_names=people, lang=ES)
    assert c["names"] == {"longest": None, "shortest": None}
    bruno = [t for t in c["timeline"] if t["kind"] == "departures"]
    assert len(bruno) == 1 and bruno[0]["when"].startswith("2024-01-01") and bruno[0]["label"] == "0 vueltas"
    assert c["absence"] is None


def test_census_peaks_top_10_by_msgs(people):
    df = _sys_df([("2024-01-01 10:00", "Tomi", "hola", "text")])
    peaks = [{"date": f"2024-02-{d:02d}", "msgs": 100 + d} for d in range(1, 15)] + [{"date": "2024-03-01", "msgs": 2300}]
    c = build_census(df, [{"name": "Tomi", "slug": "tomi"}], events=[], peaks=peaks, departures=0, departer="Bruno", people_names=people, lang=ES)
    got = [t for t in c["timeline"] if t["kind"] == "peak"]
    assert len(got) == 10
    assert {t["label"] for t in got} == {f"{100 + d} mensajes" for d in range(6, 15)} | {"2.300 mensajes"}
    en = build_census(df, [{"name": "Tomi", "slug": "tomi"}], events=[], peaks=peaks, departures=1234,
                      departer="Bruno", people_names=people, lang=get_lang("en"))
    assert "2,300 messages" in {t["label"] for t in en["timeline"] if t["kind"] == "peak"}
    assert [t["label"] for t in en["timeline"] if t["kind"] == "departures"] == ["1,234 returns"]


# ---------------------------------------------------------------- multimedia
def test_normalize_domain():
    assert normalize_domain("https://www.instagram.com/p/abc") == "instagram.com"
    assert normalize_domain("http://m.youtube.com/watch?v=1") == "youtube.com"
    assert normalize_domain("https://youtu.be/xyz") == "youtube.com"
    assert normalize_domain("https://x.com/user/status/1") == "twitter.com"
    assert normalize_domain("https://twitter.com/user") == "twitter.com"
    assert normalize_domain("https://vm.tiktok.com/ZM/") == "tiktok.com"
    assert normalize_domain("https://Maps.Google.com:443/?q=1") == "maps.google.com"
    assert normalize_domain("https://mx.com/") == "mx.com"  # solo el prefijo exacto "m."


def test_media_shape_and_counts(web_data):
    m = _load(web_data / "media.json")
    g = _load(web_data / "global.json")
    assert set(m) == {"kinds", "audios", "links", "deletedEdited"}
    assert "text" not in m["kinds"]["kinds"] and {"image", "sticker", "audio"} <= set(m["kinds"]["kinds"])
    msgs = {p["slug"]: p["msgs"] for p in g["people"]}
    for p in m["kinds"]["byPerson"]:
        assert sum(p["counts"].values()) == msgs[p["slug"]]
        assert set(p["perMil"]) == set(p["counts"])
    assert len(m["audios"]["byHour"]) == 24 and sum(m["audios"]["byHour"]) == 1
    assert len(m["audios"]["byYear"]["years"]) == len(m["audios"]["byYear"]["n"])
    assert m["audios"]["byPerson"][0]["slug"] == "bruno"
    de = m["deletedEdited"]
    assert {r["slug"]: r["deleted"] for r in de["byPerson"]}["tomi"] == 1
    assert de["recordDay"] == {"date": "2023-11-30", "n": 1}


def test_media_links():
    from web.media import build_media

    df = pd.DataFrame({
        "ts": pd.to_datetime(["2024-01-01 10:00", "2024-01-01 11:00", "2024-01-02 12:00", "2024-01-03 12:00"]),
        "sender": ["Tomi", "Tomi", "Ana", "Tomi"],
        "body": ["mira https://www.instagram.com/p/1 y https://x.com/a", "https://instagram.com/p/2",
                 "https://youtu.be/v", "sin link"],
        "kind": ["text"] * 4,
        "edited": [False, True, False, False],
    })
    df["hour"] = df["ts"].dt.hour
    df["date"] = df["ts"].dt.date
    people = [{"name": "Tomi", "slug": "tomi"}, {"name": "Ana", "slug": "ana"}]
    links = build_media(df, people)["links"]
    assert links["byPerson"] == [{"slug": "tomi", "n": 3}, {"slug": "ana", "n": 1}]
    assert links["domains"][0] == {"domain": "instagram.com", "n": 2}
    assert {"slug": "tomi", "domain": "instagram.com", "n": 2} in links["favorite"]
    assert {"slug": "ana", "domain": "youtube.com", "n": 1} in links["favorite"]


# ---------------------------------------------------------------- emojis
def test_emojis_shape(web_data):
    e = _load(web_data / "emojis.json")
    assert set(e) == {"top", "signature", "byYear"}
    slugs = set(_profiled(web_data).values())
    assert {s["slug"] for s in e["signature"]} <= slugs
    assert len(e["top"]) <= 30 and all(set(t) == {"e", "n", "topUser"} for t in e["top"])
    ns = [t["n"] for t in e["top"]]
    assert ns == sorted(ns, reverse=True)
    for y in e["byYear"]:
        assert isinstance(y["year"], str) and len(y["top"]) <= 5


def test_emoji_seqs_keep_zwj_sequences_and_flags():
    from web.emojis import emoji_seqs

    # Tonos de piel fuera, el selector de variación fuera salvo dentro de una secuencia ZWJ (si no, no se dibuja).
    assert emoji_seqs("hola 🏳️‍🌈 y ❤️❤ 👍🏽 🇦🇷 🏊‍♂️") == ["🏳️‍🌈", "❤", "❤", "👍", "🇦🇷", "🏊‍♂️"]


def test_emojis_keep_most_frequent_surface_form():
    from web.emojis import build_emojis

    df = pd.DataFrame({"sender": ["Tomi"] * 4, "body": ["❤️", "❤️ hola", "❤️", "❤"], "kind": "text"})
    df["ts"] = pd.date_range("2024-01-01", periods=len(df), freq="h")
    e = build_emojis(df, [{"name": "Tomi", "slug": "tomi"}], LEGACY)
    assert e["top"] == [{"e": "❤️", "n": 4, "topUser": "tomi"}]
    assert e["byYear"] == [{"year": "2024", "top": [{"e": "❤️", "n": 4}]}]


def test_emoji_signature_ratio():
    from web.emojis import build_emojis

    bodies = ["🔥 dale"] * 25 + ["hola"] * 5 + ["😂"] * 30 + ["🔥"] * 1 + ["😂"] * 10 + ["nada"] * 29
    senders = ["Tomi"] * 30 + ["Ana"] * 30 + ["Ana"] + ["Tomi"] * 10 + ["Lucas"] * 29
    df = pd.DataFrame({"sender": senders, "body": bodies, "kind": "text"})
    df["ts"] = pd.date_range("2024-01-01", periods=len(df), freq="h")
    df["year"] = df["ts"].dt.year
    people = [{"name": n, "slug": n.lower()} for n in ["Tomi", "Ana", "Lucas"]]
    e = build_emojis(df, people, LEGACY)
    sig = {s["slug"]: s for s in e["signature"]}
    assert sig["tomi"]["e"] == "🔥" and sig["tomi"]["own"] == 25
    assert sig["ana"]["e"] == "😂"
    assert "lucas" not in sig  # sin emojis
    assert e["top"][0] == {"e": "😂", "n": 40, "topUser": "ana"}


# ---------------------------------------------------------------- encuestas
def test_polls(web_data, mini_parquet, people):
    p = _load(web_data / "polls.json")
    assert set(p) == {"byPerson", "total", "mostVoted", "unanimous", "divided"}
    df = load_chat(str(mini_parquet), people)
    slugs = _profiled(web_data)
    polls = df[df["kind"] == "poll"]
    resto = int((~polls["sender"].isin(slugs)).sum())
    assert p["total"] == len(polls) == sum(r["n"] for r in p["byPerson"]) + resto
    top = p["mostVoted"][0]
    assert set(top) == {"question", "options", "who", "when", "totalVotes"}
    assert top["who"] == "caro" and top["totalVotes"] == 5
    assert top["options"][0] == {"label": "Asado", "votes": 3}
    assert p["unanimous"] == p["divided"] == [top]


def test_polls_unanimous_and_divided():
    from web.polls import build_polls

    def poll(*votes):
        return "POLL:\nPregunta\n" + "\n".join(f"OPTION: o{i} ({v})" for i, v in enumerate(votes))

    bodies = [poll(9, 0), poll(4, 4, 1), poll(6, 1), poll(2, 1), poll(10, 3)]
    df = pd.DataFrame({"sender": ["Tomi"] * 4 + ["Ajeno"], "body": bodies, "kind": "poll"})
    df["ts"] = pd.date_range("2024-01-01", periods=len(df), freq="D")
    p = build_polls(df, [{"name": "Tomi", "slug": "tomi"}], LEGACY)
    assert p["total"] == 5 and p["byPerson"] == [{"slug": "tomi", "n": 4}]
    assert {x["who"] for x in p["mostVoted"]} == {"tomi", "resto"}  # el creador sin perfil nunca sale por nombre
    assert [x["totalVotes"] for x in p["mostVoted"]] == [13, 9, 9, 7, 3]
    assert [x["totalVotes"] for x in p["unanimous"]] == [9, 7, 13, 9]  # 100 %, 86 %, 77 %, 44 %
    assert [x["totalVotes"] for x in p["divided"]] == [9, 7, 13, 9]  # diferencias 0, 5, 7, 9


# ---------------------------------------------------------------- ritmo
AWARD_IDS = ["msgs", "stickers", "audios", "badwords", "early", "owl", "mentioned", "fastest", "edited", "deleted",
             "muletilla", "starters"]


def test_rhythm_shape(web_data):
    r = _load(web_data / "rhythm.json")
    g = _load(web_data / "global.json")
    slugs = set(_profiled(web_data).values())
    assert set(r) == {"starters", "killers", "latency", "fastest", "streaks", "rings"}
    for key in ("starters", "killers"):
        assert {x["slug"] for x in r[key]} == slugs
        ns = [x["n"] for x in r[key]]
        assert ns == sorted(ns, reverse=True)
        assert {x["slug"]: x["n"] for x in r[key]} == g[key]  # misma definición que global.json (3 h)
    assert r["latency"] and {x["slug"] for x in r["latency"]} <= slugs
    for x in r["latency"]:
        assert set(x) == {"slug", "medianToSec", "medianFromSec", "n"}
        assert x["medianToSec"] > 0 and x["medianFromSec"] > 0 and x["n"] > 0
    assert len(r["rings"]["dow"]) == 7 and sum(r["rings"]["dow"]) == g["totals"]["msgs"]
    assert len(r["rings"]["month"]) == 12 and sum(r["rings"]["month"]) == g["totals"]["msgs"]


def test_rhythm_streaks_come_from_people_files(web_data):
    r = _load(web_data / "rhythm.json")
    assert {s["slug"] for s in r["streaks"]} == set(_profiled(web_data).values())
    for s in r["streaks"]:
        rec = _load(web_data / "people" / f"{s['slug']}.json")["records"]
        assert s == {"slug": s["slug"], "streak": rec["streak"], "silence": rec["silence"]}


def test_rhythm_fastest_pair(web_data):
    f = _load(web_data / "rhythm.json")["fastest"]
    slugs = set(_profiled(web_data).values())
    assert set(f) == {"a", "b", "seconds"}
    assert f["a"]["who"] in slugs and f["b"]["who"] in slugs and f["a"]["who"] != f["b"]["who"]
    assert f["seconds"] >= 1 and f["a"]["when"] < f["b"]["when"]
    gap = pd.Timestamp(f["b"]["when"]) - pd.Timestamp(f["a"]["when"])
    assert gap.total_seconds() == f["seconds"]
    assert f["a"]["text"] and f["b"]["text"]


def _rhythm_df(rows):
    df = pd.DataFrame(rows, columns=["ts", "sender", "body"])
    df["ts"] = pd.to_datetime(df["ts"])
    df["chat"] = "main"
    df["kind"] = "text"
    df["dow"] = df["ts"].dt.day_of_week
    df["hour"] = df["ts"].dt.hour
    return df


def test_rhythm_latency_and_fastest_skip_crossed_messages():
    from web.rhythm import build_rhythm

    df = _rhythm_df([
        ("2024-01-01 10:00:00", "Tomi", "hola"),
        ("2024-01-01 10:00:00", "Ana", "cruzado"),  # 0 s: se cruzaron, no es respuesta
        ("2024-01-01 10:00:20", "Ana", "sigo yo"),  # mismo turno: no es respuesta
        ("2024-01-01 10:00:30", "Tomi", "que tal?"),  # responde 10 s después del último de Ana
        ("2024-01-01 10:00:33", "Ana", "bien, vos?"),
        ("2024-01-01 10:00:43", "Tomi", "joya"),
        ("2024-01-01 10:20:00", "Ana", "tarde"),  # más de 10 min: no es respuesta
    ])
    people = [{"name": "Tomi", "slug": "tomi"}, {"name": "Ana", "slug": "ana"}]
    span = {"days": 1, "from": "2024-01-01", "to": "2024-01-01"}
    files = {s: {"records": {"streak": span, "silence": span}} for s in ("tomi", "ana")}
    r = build_rhythm(df, people, files)
    lat = {x["slug"]: x for x in r["latency"]}
    # El gap se mide desde el mensaje inmediatamente anterior: Ana responde a los 3 s (el cruce de 0 s no cuenta);
    # Tomi a los 10 s ("sigo yo" -> "que tal?") y a los 10 s ("bien, vos?" -> "joya").
    assert lat["ana"] == {"slug": "ana", "medianToSec": 10.0, "medianFromSec": 3.0, "n": 1}
    assert lat["tomi"] == {"slug": "tomi", "medianToSec": 3.0, "medianFromSec": 10.0, "n": 2}
    assert r["fastest"]["seconds"] == 3.0
    assert r["fastest"]["a"]["text"] == "que tal?" and r["fastest"]["b"] == {
        "who": "ana", "when": "2024-01-01T10:00:33", "text": "bien, vos?"}
    assert r["rings"]["dow"][0] == 7 and r["rings"]["month"][0] == 7


def test_rhythm_minute_resolution_keeps_same_minute_replies():
    from web.rhythm import build_rhythm

    df = _rhythm_df([
        ("2024-01-01 10:00:00", "Tomi", "hola, cómo andan?"),
        ("2024-01-01 10:00:00", "Ana", "bien bien, vos?"),  # mismo minuto: en Android es una respuesta
        ("2024-01-01 10:01:00", "Tomi", "joya todo"),
    ])
    people = [{"name": "Tomi", "slug": "tomi"}, {"name": "Ana", "slug": "ana"}]
    lat = {x["slug"]: x for x in build_rhythm(df, people, {}, "minute")["latency"]}
    assert lat["ana"]["medianFromSec"] == 0.0 and lat["tomi"]["medianFromSec"] == 60.0
    assert "ana" not in {x["slug"] for x in build_rhythm(df, people, {})["latency"]}  # con segundos, 0 s es un cruce


def test_rhythm_fastest_needs_a_real_exchange():
    from web.rhythm import build_rhythm

    df = _rhythm_df([
        ("2024-01-01 10:00:00", "Tomi", "una foto de la playa"),
        ("2024-01-01 10:00:01", "Ana", "mirá esta otra foto"),  # 1 s, pero son dos pies de foto
        ("2024-01-01 11:00:00", "Tomi", "Jaja"),
        ("2024-01-01 11:00:01", "Ana", "Sí, obvio"),  # 1 s, pero "Jaja" no pregunta nada ni es largo
        ("2024-01-01 12:00:00", "Tomi", "Vienen?"),
        ("2024-01-01 12:00:01", "Ana", "Sí"),  # 1 s, pero la respuesta es de una palabra
        ("2024-01-01 13:00:00", "Tomi", "Vienen al asado?"),
        ("2024-01-01 13:00:02", "Ana", "Sí, voy"),  # la más rápida que vale
        ("2024-01-01 14:00:00", "Tomi", "Quién trae hielo?"),
        ("2024-01-01 14:00:02", "Ana", "Yo llevo"),  # empate a 2 s: las dos son preguntas cortas, gana la más reciente
        ("2024-01-01 15:00:00", "Tomi", "Rutina de piernas: " + "sentadilla 3x8, " * 30),  # pared pegada, más reciente
        ("2024-01-01 15:00:02", "Ana", "si el celular no va"),
        ("2024-01-01 16:00:00", "Tomi", "Y esto qué es? " + "bla " * 30 + "?"),  # termina en "?" pero es largo
        ("2024-01-01 16:00:02", "Ana", "ni idea che"),
    ])
    df.loc[[0, 1], "kind"] = "image"
    people = [{"name": "Tomi", "slug": "tomi"}, {"name": "Ana", "slug": "ana"}]
    span = {"days": 1, "from": "2024-01-01", "to": "2024-01-01"}
    r = build_rhythm(df, people, {s: {"records": {"streak": span, "silence": span}} for s in ("tomi", "ana")})
    assert r["fastest"] == {
        "a": {"who": "tomi", "when": "2024-01-01T14:00:00", "text": "Quién trae hielo?"},
        "b": {"who": "ana", "when": "2024-01-01T14:00:02", "text": "Yo llevo"},
        "seconds": 2.0,
    }
    df.loc[8, "body"] = "Llevo el hielo yo"  # ya no pregunta: la pregunta corta de las 13 h le gana
    assert build_rhythm(df, people, {})["fastest"]["a"]["when"] == "2024-01-01T13:00:00"
    df.loc[6, "body"] = "Vamos al asado"  # ninguna pregunta: el "a" corto más reciente (14 h), nunca la pared
    assert build_rhythm(df, people, {})["fastest"]["a"]["when"] == "2024-01-01T14:00:00"
    df.loc[[6, 8], "body"] = "x " * 50  # sin "a" corto: entre los largos, el más reciente
    assert build_rhythm(df, people, {})["fastest"]["a"]["when"] == "2024-01-01T16:00:00"


# ---------------------------------------------------------------- menciones
def test_android_fixture_media_kind_and_no_audios(people):
    import build_dataset
    from web.media import build_media

    df = build_dataset.build([(str(FORMATS / "android-es.txt"), "main")], people)
    df = df[~df["sender"].isin(["__grupo__", "__system__"])].reset_index(drop=True)
    plist = [{"name": n, "slug": n.lower()} for n in ["Ana", "Tomi", "Lucas", "Bruno", "Caro"]]
    m = build_media(df, plist)
    assert "media" in m["kinds"]["kinds"] and "audio" not in m["kinds"]["kinds"]
    assert sum(p["counts"]["media"] for p in m["kinds"]["byPerson"]) > 0
    assert m["audios"]["byPerson"] == []
    assert sum(m["audios"]["byHour"]) == 0 and m["audios"]["byYear"] == {"years": [], "n": []}


def test_mentions_shape(web_data):
    m = _load(web_data / "mentions.json")
    assert set(m) == {"slugs", "matrix", "mostMentioned", "topTagger", "perMil", "samples"}
    n = len(m["slugs"])
    assert set(m["slugs"]) == set(_profiled(web_data).values())
    assert len(m["matrix"]) == n and all(len(row) == n for row in m["matrix"])
    assert all(m["matrix"][i][i] == 0 for i in range(n))
    idx = {s: i for i, s in enumerate(m["slugs"])}
    # Caro y Tomi etiquetan una vez cada uno al Bruno.
    assert m["matrix"][idx["caro"]][idx["bruno"]] == 1 and m["matrix"][idx["tomi"]][idx["bruno"]] == 1
    assert sum(map(sum, m["matrix"])) == 2
    assert m["mostMentioned"] == {"slug": "bruno", "n": 2}
    assert m["topTagger"] == {"slug": "caro", "n": 1}  # empate con Tomi: por slug
    assert m["samples"]["tomi>bruno"] == [{"when": "2023-11-30T11:00:00",
                                          "text": "Bruno hoy cumple Lucas, a comprar torta"}]
    assert set(m["samples"]) == {"tomi>bruno", "caro>bruno"}
    assert {x["slug"] for x in m["perMil"]} == set(m["slugs"])


def test_mentions_parse_raw_tokens_once_per_message_and_target(people):
    from build_web_data import clean_text
    from web.mentions import build_mentions

    raw = [
        '@⁨Bruno "Brujo" Castro⁩ y @⁨Bruno\xa0"Brujo"\xa0Castro⁩ vení',  # dos veces el mismo: cuenta una
        "@⁨Ana Rivas⁩ @⁨Bruno \"Brujo\" Castro⁩ @⁨+54 9 11 5555⁩",  # dos con perfil y un número suelto
        "@⁨Tomi \"Tomate\" Suárez🍅⁩ me etiqueto solo",  # a sí mismo: no cuenta
        "Bruno sin arroba",  # nombre suelto, ya limpio: no es mención
        "@⁨Ana Rivas⁩ de alguien sin perfil",
    ]
    df = pd.DataFrame({
        "ts": pd.to_datetime(["2024-01-01 10:00", "2024-01-02 10:00", "2024-01-03 10:00", "2024-01-04 10:00",
                              "2024-01-05 10:00"]),
        "sender": ["Tomi", "Tomi", "Tomi", "Ana", "Ajeno"],
        "body": [clean_text(b, people) for b in raw],
    })
    plist = [{"name": n, "slug": n.lower()} for n in ["Tomi", "Ana", "Bruno"]]
    m = build_mentions(df, plist, pd.Series(raw, index=df.index), people, ES)
    idx = {s: i for i, s in enumerate(m["slugs"])}
    assert m["slugs"] == ["tomi", "ana", "bruno"]
    assert m["matrix"][idx["tomi"]] == [0, 1, 2]
    assert sum(m["matrix"][idx["ana"]]) == 0 and sum(m["matrix"][idx["bruno"]]) == 0
    assert m["mostMentioned"] == {"slug": "bruno", "n": 2} and m["topTagger"] == {"slug": "tomi", "n": 3}
    assert [s["when"][:10] for s in m["samples"]["tomi>bruno"]] == ["2024-01-02", "2024-01-01"]  # más reciente primero
    # Un número (o un nombre de afuera) no se publica: queda como "@alguien".
    assert m["samples"]["tomi>ana"][0]["text"] == "Ana Bruno @alguien" and "5555" not in str(m["samples"])
    en = build_mentions(df, plist, pd.Series(raw, index=df.index), people, get_lang("en"))
    assert en["samples"]["tomi>ana"][0]["text"] == "Ana Bruno @someone"
    assert {x["slug"]: x["perMil"] for x in m["perMil"]} == {"tomi": 1000.0, "ana": 0.0, "bruno": 0.0}


def test_plain_mentions_fallback(people):
    from web.mentions import build_mentions, plain_mentions

    assert plain_mentions("@Bruno venís?", people) == {"Bruno"}
    assert plain_mentions("@bruno y @TOMI, @Caro.", people) == {"Bruno", "Tomi", "Caro"}
    assert plain_mentions('@Bruno "Brujo" Castro vení', people) == {"Bruno"}  # nombre de contacto crudo
    assert plain_mentions("@brujo venís?", people) == set()  # un apodo no cuenta
    assert plain_mentions("@Brunos mail@Bruno.com", people) == set()  # sin límite de palabra / sin @ suelto
    # build_mentions: sin aisladores en ningún cuerpo, usa el texto plano.
    raw = ["@Bruno venís?", "@Ana y @Bruno vengan", "sin menciones", "@brujo no cuenta"]
    df = pd.DataFrame({"ts": pd.date_range("2024-01-01", periods=4, freq="D"),
                       "sender": ["Tomi", "Tomi", "Ana", "Tomi"], "body": raw})
    plist = [{"name": n, "slug": n.lower()} for n in ["Tomi", "Ana", "Bruno"]]
    m = build_mentions(df, plist, pd.Series(raw, index=df.index), people, ES)
    assert m["matrix"][0] == [0, 1, 2] and sum(m["matrix"][1]) == 0
    assert m["mostMentioned"] == {"slug": "bruno", "n": 2}
    # Con un aislador en algún cuerpo manda el formato iOS: el texto plano ya no cuenta.
    raw2 = [*raw[:3], "@\u2068Ana Rivas\u2069 hola"]
    m2 = build_mentions(df, plist, pd.Series(raw2, index=df.index), people, ES)
    assert m2["matrix"][0] == [0, 1, 0]
    # Sin ninguna mención: la forma de siempre, todo vacío.
    none = build_mentions(df.iloc[2:3], plist, pd.Series(["hola"], index=df.index[2:3]), people, ES)
    assert none["matrix"] == [[0] * 3] * 3 and none["samples"] == {} and none["mostMentioned"] is None
    assert none["topTagger"] is None


def test_plain_mention_samples_redact_numbers_and_outsiders(people):
    from web.mentions import build_mentions

    raw = ["@Bruno Castro llamá a @5491155555555 o a @Juan Perez", "@+54 9 11 5555-5555 y @brujo, hola @Bruno.",
           "@(011) 1234 hola @Bruno"]
    df = pd.DataFrame({"ts": pd.date_range("2024-01-01", periods=3, freq="D"), "sender": "Tomi", "body": raw})
    plist = [{"name": n, "slug": n.lower()} for n in ["Tomi", "Bruno"]]
    m = build_mentions(df, plist, pd.Series(raw, index=df.index), people, ES)
    assert m["matrix"][0] == [0, 3]
    texts = [x["text"] for x in m["samples"]["tomi>bruno"]]
    assert texts == ["@alguien hola Bruno", "@alguien y @alguien, hola Bruno.", "Bruno llamá a @alguien o a @alguien"]  # el más reciente primero
    blob = str(m["samples"])
    assert "Bruno" in blob and not any(x in blob for x in ("5555", "Castro", "Perez", "Juan", "brujo", "1234", "011"))
    en = build_mentions(df, plist, pd.Series(raw, index=df.index), people, get_lang("en"))
    assert "@someone" in en["samples"]["tomi>bruno"][1]["text"]


def test_mentions_samples_cap_at_three_and_clip(people):
    from web.mentions import SAMPLE_CHARS, build_mentions

    raw = ["@⁨Ana Rivas⁩ " + "x" * 400] + ["@⁨Ana Rivas⁩ hola"] * 4
    df = pd.DataFrame({"ts": pd.date_range("2024-01-01", periods=5, freq="D"), "sender": "Tomi", "body": raw})
    m = build_mentions(df, [{"name": "Tomi", "slug": "tomi"}, {"name": "Ana", "slug": "ana"}],
                       pd.Series(raw, index=df.index), people, ES)
    assert len(m["samples"]["tomi>ana"]) == 3 and m["matrix"][0][1] == 5
    clipped = build_mentions(df.iloc[:1], [{"name": "Tomi", "slug": "tomi"}, {"name": "Ana", "slug": "ana"}],
                             pd.Series(raw[:1]), people, ES)
    assert len(clipped["samples"]["tomi>ana"][0]["text"]) == SAMPLE_CHARS


def test_raw_bodies_aligned_by_msg_id(mini_parquet, people):
    from build_web_data import raw_bodies

    df = load_chat(str(mini_parquet), people)
    raw = raw_bodies(str(mini_parquet), df)
    assert raw.index.equals(df.index)
    row = df.index[df["body"].str.startswith("Bruno hoy cumple")][0]
    assert raw[row].startswith('@⁨Bruno "Brujo" Castro⁩ hoy cumple')


# ---------------------------------------------------------------- premios
def test_awards_shape_and_order(web_data):
    a = _load(web_data / "awards.json")
    slugs = set(_profiled(web_data).values())
    assert [x["id"] for x in a] == AWARD_IDS
    for x in a:
        assert set(x) == {"id", "title", "criterion", "winner", "runnersUp"}
        assert x["title"] and x["criterion"]
        assert len(x["runnersUp"]) <= 2  # menos de tres elegibles en el fixture: la lista se acorta
        if x["winner"] is None:
            assert x["runnersUp"] == []
            continue
        assert x["winner"]["slug"] in slugs
        assert set(x["winner"]) == ({"slug", "value", "unit", "text"} if x["id"] == "muletilla"
                                    else {"slug", "value", "unit"})
        keys = {"slug", "value", "text"} if x["id"] == "muletilla" else {"slug", "value"}
        assert all(set(r) == keys and r["slug"] in slugs for r in x["runnersUp"])
        assert x["winner"]["slug"] not in {r["slug"] for r in x["runnersUp"]}
        values = [x["winner"]["value"]] + [r["value"] for r in x["runnersUp"]]  # lo mostrado baja (o sube, el rápido)
        assert values == sorted(values, reverse=x["id"] != "fastest")


def test_awards_values_come_from_chapter_files(web_data):
    a = {x["id"]: x for x in _load(web_data / "awards.json")}
    g = _load(web_data / "global.json")
    c = _load(web_data / "census.json")
    m = _load(web_data / "mentions.json")
    lang = _load(web_data / "language.json")
    top = max((p for p in g["people"] if p["slug"] != "resto"), key=lambda p: p["msgs"])
    assert a["msgs"]["winner"] == {"slug": top["slug"], "value": top["msgs"], "unit": "mensajes"}
    # Nadie escribe entre las 6 y las 9 en el fixture: census igual nombra a alguien, con share 0, el premio no se entrega.
    assert c["earlyBird"]["share"] == 0 and a["early"]["winner"] is None
    assert a["owl"]["winner"]["slug"] == c["owl"]["slug"] == "lucas"
    assert a["owl"]["winner"]["value"] == round(100 * c["owl"]["share"], 1)
    assert a["mentioned"]["winner"] == {"slug": "bruno", "value": 2, "unit": "menciones"}
    assert a["mentioned"]["runnersUp"] == []  # nadie más fue etiquetado
    assert a["mentioned"]["winner"]["value"] == m["mostMentioned"]["n"]
    assert a["fastest"]["winner"] is None  # nadie llega a 500 respuestas en el fixture
    assert a["edited"]["winner"] is None  # nadie editó: un premio con 0 no se entrega
    assert a["deleted"]["winner"] == {"slug": "tomi", "value": a["deleted"]["winner"]["value"], "unit": "por mil"}
    # El fixture entero cae en el último año del export: la muletilla del año es la de Lenguaje.
    top_m = lang["top"]["muletilla"]
    assert a["muletilla"]["winner"] == {"slug": top_m["slug"], "value": top_m["ratio"], "unit": "x",
                                        "text": top_m["display"]}
    units = ["mensajes", "stickers", "audios", "por mil", "%", "%", "menciones", "s", "por mil", "por mil", "x", "veces"]
    singular = {"mensajes": "mensaje", "stickers": "sticker", "audios": "audio", "menciones": "mención",
                "veces": "vez"}  # un conteo de 1 va en singular
    assert [x["winner"]["unit"] for x in a.values() if x["winner"]] == [
        singular[u] if u in singular and a[i]["winner"]["value"] == 1 else u
        for i, u in zip(AWARD_IDS, units) if a[i]["winner"]]


def _award_inputs(n_replies=(600, 499, 900)):
    names = ["Tomi", "Ana", "Lucas"]
    people = [{"name": n, "slug": n.lower(), "msgs": 100 - i, "stickers": [5, 0, 0][i], "audios": [1, 2, 3][i]}
              for i, n in enumerate(names)]
    global_ = {"period": {"from": "2023-01-01", "to": "2024-06-30"},
               "people": people + [{"name": "Resto", "slug": "resto", "msgs": 999, "stickers": 999, "audios": 999}]}
    df = pd.DataFrame({"sender": ["Tomi", "Tomi", "Ana", "Lucas"], "hour": [7, 2, 7, 12], "body": "hola",
                       "kind": "text", "ts": pd.to_datetime(["2024-06-01"] * 4)})
    language = {
        "badwords": {"byPerson": [{"slug": "ana", "n": 3, "perMil": 30.0}, {"slug": "tomi", "n": 0, "perMil": 0.0}]},
    }
    media = {"deletedEdited": {"byPerson": [
        {"slug": "tomi", "deletedPerMil": 1.0, "editedPerMil": 0.0},
        {"slug": "ana", "deletedPerMil": 2.0, "editedPerMil": 0.0},
        {"slug": "lucas", "deletedPerMil": 2.0, "editedPerMil": 3.0}]}}
    mentions = {"slugs": ["tomi", "ana", "lucas"], "matrix": [[0, 4, 1], [2, 0, 0], [0, 0, 0]]}
    rhythm = {
        "latency": [{"slug": s, "medianToSec": 10.0, "medianFromSec": sec, "n": n}
                    for s, sec, n in zip(["tomi", "ana", "lucas"], [12.0, 3.0, 15.0], n_replies)],
        "starters": [{"slug": "ana", "n": 7}, {"slug": "tomi", "n": 0}, {"slug": "lucas", "n": 0}],
    }
    return df, global_, language, {}, media, mentions, rhythm


def test_award_eligibility_rules(people):
    from web.awards import build_awards

    a = {x["id"]: x for x in build_awards(*_award_inputs(), people, LEGACY, ES)}
    # Más mensajes: el resto nunca compite.
    assert a["msgs"]["winner"]["slug"] == "tomi" and [r["slug"] for r in a["msgs"]["runnersUp"]] == ["ana", "lucas"]
    # Con 0 no se entra: un solo elegible, sin finalistas.
    assert a["stickers"]["winner"] == {"slug": "tomi", "value": 5, "unit": "stickers"} and a["stickers"]["runnersUp"] == []
    assert a["badwords"]["runnersUp"] == [] and a["starters"]["runnersUp"] == []
    # El más rápido: Ana responde en 3 s pero tiene 499 respuestas; gana Tomi (12 s, 600).
    assert a["fastest"]["winner"] == {"slug": "tomi", "value": 12.0, "unit": "s"}
    assert a["fastest"]["runnersUp"] == [{"slug": "lucas", "value": 15.0}]
    # Empate en borrados por mil: por slug.
    assert [a["deleted"]["winner"]["slug"]] + [r["slug"] for r in a["deleted"]["runnersUp"]] == ["ana", "lucas", "tomi"]
    assert a["edited"]["winner"]["slug"] == "lucas" and a["edited"]["runnersUp"] == []
    # Madrugador (6-9 h) y búho (0-6 h), en porcentaje de sus mensajes.
    assert a["early"]["winner"] == {"slug": "ana", "value": 100.0, "unit": "%"}
    assert a["early"]["runnersUp"] == [{"slug": "tomi", "value": 50.0}]
    assert a["owl"]["winner"] == {"slug": "tomi", "value": 50.0, "unit": "%"} and a["owl"]["runnersUp"] == []
    # Más mencionado: suma de columnas (Ana 4, Tomi 2, Lucas 1).
    assert a["mentioned"]["winner"]["slug"] == "ana"
    assert a["mentioned"]["runnersUp"] == [{"slug": "tomi", "value": 2}, {"slug": "lucas", "value": 1}]
    # Sin frases repetidas en el último año, la muletilla del año no se entrega.
    assert a["muletilla"]["winner"] is None and a["muletilla"]["runnersUp"] == []


def test_award_fastest_without_eligible(people):
    from web.awards import build_awards

    a = {x["id"]: x for x in build_awards(*_award_inputs(n_replies=(10, 10, 10)), people, LEGACY, ES)}
    assert a["fastest"]["winner"] is None and a["fastest"]["runnersUp"] == []


def test_award_fastest_is_not_given_at_minute_resolution(people):
    from web.awards import awards_table, build_awards, fastest_winner

    a = build_awards(*_award_inputs(), people, LEGACY, ES, "minute")
    assert [x["id"] for x in a] == [x[0] for x in awards_table(LEGACY, ES) if x[0] != "fastest"]
    assert len(a) == 11 and fastest_winner(a) is None


def test_award_muletilla_of_the_last_year(people):
    from web.awards import build_awards

    rows = []
    day = pd.Timestamp("2022-01-01 10:00")
    for i in range(30):  # 2022, fuera de la ventana: el "riego las plantas" de Lucas no cuenta
        rows.append((day + pd.Timedelta(days=i), "Lucas", "riego las plantas"))
    day = pd.Timestamp("2024-01-10 10:00")
    for i in range(30):  # último año: Tomi dice "cocino a las 21" 30 veces, Ana "voy en bici" 12
        rows.append((day + pd.Timedelta(days=i), "Tomi", "cocino a las 21"))
        rows.append((day + pd.Timedelta(days=i, minutes=5), "Lucas", "dale"))
        rows.append((day + pd.Timedelta(days=i, minutes=7), "Ana", "voy en bici" if i < 12 else "dale"))
    df = pd.DataFrame(rows, columns=["ts", "sender", "body"])
    df["kind"] = "text"
    df["hour"] = df["ts"].dt.hour
    _, global_, language, census, media, mentions, rhythm = _award_inputs()
    global_["period"] = {"from": "2022-01-01", "to": "2024-06-30"}
    m = {x["id"]: x for x in build_awards(df, global_, language, census, media, mentions, rhythm, people, LEGACY, ES)}["muletilla"]
    assert m["winner"]["slug"] == "tomi" and m["winner"]["text"] == "cocino a las 21" and m["winner"]["unit"] == "x"
    assert m["winner"]["value"] > 0
    assert m["runnersUp"] == [{"slug": "ana", "value": m["runnersUp"][0]["value"], "text": "voy en bici"}]
    assert m["winner"]["value"] >= m["runnersUp"][0]["value"]  # ganador y finalistas, por razón
    # Con una ventana que alcanza 2022, "riego las plantas" de Lucas sí compite.
    global_["period"]["to"] = "2023-01-01"
    wide = {x["id"]: x for x in build_awards(df, global_, language, census, media, mentions, rhythm, people, LEGACY, ES)}["muletilla"]
    assert {"slug": "lucas", "text": "riego las plantas"} in [
        {"slug": e["slug"], "text": e["text"]} for e in [wide["winner"], *wide["runnersUp"]]]


# ---------------------------------------------------------------- facts
def test_facts_ledes(web_data):
    f = _load(web_data / "facts.json")
    r = _load(web_data / "rhythm.json")
    lang = _load(web_data / "language.json")
    assert f["awardsCount"] == 12
    top = lang["top"]["muletilla"]
    assert f["topMuletilla"] == {"slug": top["slug"], "phrase": top["phrase"], "own": top["own"],
                                 "others": top["others"]}
    assert f["mostMentioned"] == {"slug": "bruno", "n": 2}
    assert f["fastest"] is None  # nadie con 500 respuestas: el premio no se entrega
    assert f["startersTop"] == r["starters"][0] and f["killersTop"] == r["killers"][0]


def test_build_facts_new_fields_default_to_none(web_data):
    from build_web_data import build_facts

    g = _load(web_data / "global.json")
    f = build_facts(g, {}, thresholds=LEGACY, lang=ES)
    assert f["awardsCount"] == 0
    assert all(f[k] is None for k in ("topMuletilla", "mostMentioned", "fastest", "startersTop", "killersTop"))
    rhythm = {"starters": [{"slug": "tomi", "n": 0}], "killers": [], "latency": []}
    awards = [{"id": "fastest", "winner": {"slug": "tomi", "value": 2.0, "unit": "s"}, "runnersUp": []}]
    f = build_facts(g, {}, rhythm=rhythm, awards=awards, thresholds=LEGACY, lang=ES)
    assert f["fastest"] == {"slug": "tomi", "medianFromSec": 2.0}  # el ganador del premio
    assert f["startersTop"] is None and f["killersTop"] is None  # nadie arrancó nada


def test_facts_peak_is_the_heatmaps_busiest_cell(web_data):
    from build_web_data import build_facts

    g = _load(web_data / "global.json")
    hm = [[0] * 24 for _ in range(7)]  # filas: lunes..domingo; columnas: horas
    hm[0][22] = 10  # la celda más brillante: lunes 22 h
    hm[4][20] = hm[4][21] = hm[1][21] = 6  # el viernes es el día más movido (12) y las 21 la hora más movida (12)
    f = build_facts({**g, "heatmap": hm}, {}, thresholds=LEGACY, lang=ES)
    assert (f["peakDow"], f["peakHour"]) == (ES.dow[0], 22)
    hm[3][5] = 10  # empate: gana el día más temprano y, en ese día, la hora más temprana
    hm[0][3] = 10
    f = build_facts({**g, "heatmap": hm}, {}, thresholds=LEGACY, lang=ES)
    assert (f["peakDow"], f["peakHour"]) == (ES.dow[0], 3)


def test_award_unit_follows_the_winners_count():
    from web.awards import _award

    assert _award("stickers", "t", "c", ("sticker", "stickers"), [("ana", 1)])["winner"]["unit"] == "sticker"
    assert _award("stickers", "t", "c", ("sticker", "stickers"), [("ana", 2)])["winner"]["unit"] == "stickers"
    assert _award("early", "t", "c", "%", [("ana", 1)])["winner"]["unit"] == "%"
