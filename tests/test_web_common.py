import pandas as pd

from wa.lang import get_lang
from web.common import msg_ref, norm_words, per_mil, ranked, ranked_per_mil, surface_words

ES, EN = get_lang("es"), get_lang("en")


def test_per_mil_rounding_and_zero():
    assert per_mil(5, 2000) == 2.5 and per_mil(1, 0) == 0.0


def test_norm_words_strips_accents_urls_mentions_emojis():
    assert norm_words("Mirá vos!! https://x.com @⁨Bruno Castro⁩ 😂", ES) == ["mira", "vos"]


def test_norm_words_drops_bare_mention_and_zwj_emojis():
    assert norm_words("Hola ⁨Tomi⁩ 👨‍👩‍👧 3 veces", ES) == ["hola", "3", "veces"]


def test_norm_words_enie_survives():
    assert norm_words("Ñandú", ES) == ["ñandu"]


def test_ranked_sorts_desc_filters_unprofiled_and_tops():
    s = pd.Series({"Tomi": 3, "Zoe": 7, "Otro": 99, "Ana": 3})
    slugs = {"Tomi": "tomi", "Zoe": "zoe", "Ana": "ana"}
    assert ranked(s, slugs) == [{"slug": "zoe", "n": 7}, {"slug": "ana", "n": 3}, {"slug": "tomi", "n": 3}]
    assert ranked(s, slugs, top=1) == [{"slug": "zoe", "n": 7}]


def test_ranked_per_mil_filters_small_people():
    counts = pd.Series({"Tomi": 10, "Zoe": 9})
    totals = pd.Series({"Tomi": 5000, "Zoe": 500})
    out = ranked_per_mil(counts, totals, {"Tomi": "tomi", "Zoe": "zoe"}, min_msgs=1000)
    assert out == [{"slug": "tomi", "n": 10, "perMil": 2.0}]


def test_msg_ref_uses_slug_iso_and_text_fn():
    row = {"sender": "Tomi", "ts": pd.Timestamp("2024-05-01 10:30:00"), "body": "hola"}
    assert msg_ref(row, {"Tomi": "tomi"}, str.upper) == {"who": "tomi", "when": "2024-05-01T10:30:00", "text": "HOLA"}
    row["sender"] = "Un Tipo"
    assert msg_ref(row, {}, str)["who"] == "un-tipo"


def test_surface_words_align_with_norm_words():
    text = "¿Qué ILUSIÓN, Ñoño? https://x.com/a 😂 @⁨Tomi⁩ cañón"
    assert surface_words(text, ES) == ["qué", "ilusión", "ñoño", "cañón"]
    assert len(surface_words(text, ES)) == len(norm_words(text, ES))
    decomposed = "qué ilusión"  # acentos combinantes: se recomponen
    assert surface_words(decomposed, ES) == ["qué", "ilusión"]


def test_norm_words_keep_inner_apostrophes_in_english():
    assert norm_words("I don’t care, it's FINE 'ok'", EN) == ["i", "don't", "care", "it's", "fine", "ok"]
    assert norm_words("I don't care", ES) == ["i", "don", "t", "care"]  # en castellano el apóstrofo separa


def test_surface_words_align_in_english():
    text = "Café? I don’t care 'ok'"
    assert surface_words(text, EN) == ["café", "i", "don't", "care", "ok"]
    assert [w for w in norm_words(text, EN)] == ["cafe", "i", "don't", "care", "ok"]


def test_global_platform_and_resolution(web_data):
    import json

    g = json.loads((web_data / "global.json").read_text(encoding="utf-8"))
    assert (g["platform"], g["timeResolution"]) == ("ios", "second")
    assert all(p["media"] == 0 for p in g["people"])


def test_build_global_publishes_android_resolution(mini_parquet, people):
    from build_web_data import build_global, load_chat
    from web.thresholds import Thresholds

    g = build_global(load_chat(str(mini_parquet), people), Thresholds.legacy(), "t", ES, "android", "minute")
    assert (g["platform"], g["timeResolution"]) == ("android", "minute")
