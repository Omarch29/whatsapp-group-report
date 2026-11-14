from collections import Counter

import group_report
import pandas as pd
from wa.background import lore_filter, word_is_common
from wa.lang import get_lang

ES = get_lang("es")


def test_common_words_are_filtered_without_background():
    c = Counter({"hola": 50, "zorzalito": 40})
    assert set(lore_filter(c, "es", None)) == {"zorzalito"}


def test_lore_filter_drops_elongations():
    c = Counter({"nooo": 50, "zorzalito": 40, "jajaj": 30})
    assert set(lore_filter(c, "es", None)) == {"zorzalito"}
    assert set(lore_filter(c, "es", Counter())) == {"zorzalito"}  # también con chats de fondo


def test_lore_filter_common_check_ignores_accents():
    c = Counter({"tambien": 50, "zorzalito": 40})  # "también" sin tilde: común igual
    assert set(lore_filter(c, "es", None)) == {"zorzalito"}


def test_background_counter_wins_when_present():
    c = Counter({"zorzalito": 40, "pepino": 30})
    assert set(lore_filter(c, "es", Counter({"pepino": 5}))) == {"zorzalito"}


def test_with_background_a_common_word_is_kept_if_the_background_never_says_it():
    c = Counter({"hola": 50, "pepino": 30})
    assert set(lore_filter(c, "es", Counter({"pepino": 3, "hola": 2}))) == {"hola"}


def test_word_is_common_depends_on_the_language():
    assert word_is_common("hola", "es") and not word_is_common("hola", "en")
    assert word_is_common("the", "en") and not word_is_common("zorzalito", "es")


def test_fixture_lore_without_background(mini_parquet):
    _, main = group_report.load(str(mini_parquet), "main")
    lore = group_report.lore_terms(main, ES, None, min_uses=2)
    words = set(lore["palabra"])
    assert "brujo" in words  # inventada del grupo: 9 usos, 4 personas
    assert "feliz" not in words  # 5 usos, 5 personas, pero es una palabra corriente del español


def test_lore_with_background_chat_uses_the_background_not_the_language(mini_parquet):
    full, main = group_report.load(str(mini_parquet), "main")
    bg = main[main["kind"] == "text"].assign(chat="bg0", ts=main["ts"] - pd.Timedelta(days=365))
    lore = group_report.lore_terms(main, ES, bg, min_uses=2)
    assert lore.empty  # todo lo que dice el grupo ya lo decía el fondo
    other = bg.assign(body="otra cosa distinta")
    words = set(group_report.lore_terms(main, ES, other, min_uses=2)["palabra"])
    assert {"brujo", "feliz"} <= words  # ahora el fondo no usa "feliz": entra aunque sea corriente


def test_background_rows_are_other_chats_before_the_main_chat(mini_parquet):
    full, main = group_report.load(str(mini_parquet), "main")
    assert group_report.background_rows(full, "main") is None  # el fixture no tiene chats de fondo
    start = main["ts"].min()
    extra = pd.concat([
        full.assign(chat="bg0", ts=start - pd.Timedelta(days=1)),
        full.assign(chat="bg1", ts=start + pd.Timedelta(days=1)),
    ])
    both = pd.concat([full, extra], ignore_index=True)
    bg = group_report.background_rows(both, "main")
    assert set(bg["chat"]) == {"bg0"} and set(bg["kind"]) == {"text"}
