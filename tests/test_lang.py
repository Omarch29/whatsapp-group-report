import re

import pytest

from wa.lang import DeparturesPatterns, Labels, Lang, get_lang
from wa.text import is_laugh, tokens
from web.thresholds import Thresholds


def test_both_langs_complete():
    for code in ("es", "en"):
        L = get_lang(code)
        assert isinstance(L, Lang) and isinstance(L.labels, Labels) and isinstance(L.departures, DeparturesPatterns)
        assert L.code == code
        assert len(L.stopwords) > 100 and len(L.badwords_base) >= 30 and len(L.dow) == 7 and len(L.months) == 12
        assert [k for k, _, _ in L.laugh_kinds][:1] == (["jaja"] if code == "es" else ["haha"])
        assert L.labels.msgs(2300) == ("2.300 mensajes" if code == "es" else "2,300 messages")
        assert L.labels.fmt_int(2300) == ("2.300" if code == "es" else "2,300")
        assert len(L.labels.awards(Thresholds.legacy())) == 12
        assert len(L.departures.quote_templates) >= 3 and len(L.departures.complaint_chip) == 2
        assert all(w == w.lower() and w.strip() == w for w in L.badwords_base)


def test_get_lang_is_a_singleton():
    assert get_lang("es") is get_lang("es") and get_lang("en") is not get_lang("es")


def test_es_labels():
    L = get_lang("es")
    assert (L.labels.rest, L.labels.unknown_mention, L.labels.new_photo) == ("Resto", "@alguien", "Nueva foto")
    assert L.labels.returns(3) == "3 vueltas" and L.labels.msgs(12) == "12 mensajes"
    assert L.dow[0] == "lunes" and L.dow[-1] == "domingo" and L.months[0] == "enero"
    assert L.departures.complaint_chip == (r"no me invit", 'veces escribió "No me invitó"')
    assert [k for k, _, _ in L.laugh_kinds] == ["jaja", "jsjs", "jeje", "jiji", "xd"]


def test_en_labels():
    L = get_lang("en")
    assert (L.labels.rest, L.labels.unknown_mention) == ("Others", "@someone")
    assert L.labels.returns(1234) == "1,234 returns" and L.labels.msgs(7) == "7 messages"
    assert L.dow[0] == "Monday" and L.dow[-1] == "Sunday" and L.months[-1] == "December"
    titles = [t for _, t, _, _ in L.labels.awards(Thresholds.legacy())]
    assert titles[0] == "Most messages" and "Conversation starter" in titles
    assert "500" in {a[0]: a[2] for a in L.labels.awards(Thresholds.legacy())}["fastest"]
    assert [k for k, _, _ in L.laugh_kinds] == ["haha", "hehe", "lol", "lmao", "xd"]
    chip, label = L.departures.complaint_chip
    assert re.search(chip, "you didnt invite me") and re.search(chip, "you did not invite me")
    assert label == 'times wrote "didn\'t invite me"'


def test_en_laughs_classify():
    L = get_lang("en")
    assert is_laugh("hahaha lol", L) and not is_laugh("hola", L)
    assert all(is_laugh(w, L) for w in ("haha", "HAHAHA", "hehe", "lol", "lmao", "lmfao", "rofl", "xD"))
    assert not is_laugh("he", L) and not is_laugh("hello", L)
    assert tokens("the dog is hahaha great", L) == ["dog", "great"]
    assert tokens("im sure you dont know lmao", L) == ["sure", "know"]


def test_es_unchanged():
    L = get_lang("es")
    assert tokens("che dale jajaja vamos al río", L) == ["río"]  # "vamos" es stopword de siempre
    assert tokens("Che, mirá esto https://x.com/abc jajaj", L) == ["mirá"]
    assert tokens("che dale", L, keep_stop=True) == ["che", "dale"]
    assert is_laugh("jajaja JSJS", L) is False and is_laugh("jajaja xD lol", L) and not is_laugh("", L)


def test_get_lang_rejects_unknown():
    with pytest.raises(ValueError):
        get_lang("pt")


def test_en_apostrophes_are_word_characters():
    L = get_lang("en")
    assert tokens("i don't know what's up", L) == ["know"]  # todas stopwords salvo know
    assert tokens("don't touch my zorzalito", L) == ["touch", "zorzalito"]
    assert tokens("I DON’T care, it’s fine", L) == ["care", "fine"]  # el apóstrofo tipográfico de iOS también
    assert tokens("'quoted' words", L) == ["quoted", "words"]  # comillas simples no son parte de la palabra
    assert {"don't", "dont", "it's", "its", "i'm", "im", "can't", "cant", "won't", "wont"} <= L.stopwords


def test_es_word_re_unchanged():
    L = get_lang("es")
    assert L.word_re.pattern == "[a-záéíóúüñ]+" and L.word_chars == "a-z0-9ñ"
    assert tokens("no me digás 'eso' che", L) == ["digás"]


def test_en_departure_patterns_accept_curly_apostrophes():
    pats = get_lang("en").departures
    for body in ("you didn’t invite me again", "you didn't invite me again", "you didnt invite me again"):
        assert re.search(pats.complain, body) and re.search(pats.complaint_chip[0], body), body


def test_en_haha_kind_needs_a_repeated_ha():
    L = get_lang("en")
    assert L.laugh_kind("haha") == "haha" and L.laugh_kind("ahaha") == "haha" and L.laugh_kind("ha") == "haha"
    assert L.laugh_kind("aha") is None and L.laugh_kind("ahah") is None and not is_laugh("aha", L)


def test_en_extra_stopwords_and_end_block():
    L = get_lang("en")
    assert {"idk", "omg", "lemme", "kinda", "yall", "aint", "into", "something", "anything", "nothing", "gonna",
            "wanna"} <= L.stopwords
    assert {"we", "they", "he", "she"} <= L.end_block and not {"you", "it", "me", "them"} & L.end_block
