import pandas as pd

from build_web_data import load_chat
from conftest import LEGACY
from wa.lang import get_lang
from web.language import MIN_OWN, TOP, _variant, is_candidate, muletillas, proper_nouns

ES = get_lang("es")


def test_muletillas_finds_signature_phrases(mini_parquet, people):
    df = load_chat(str(mini_parquet), people)
    out = muletillas(df, {"Tomi": "tomi", "Ana": "ana", "Lucas": "lucas"}, people, LEGACY, ES)
    assert out["tomi"][0]["phrase"] == "mira vos" and out["tomi"][0]["own"] >= 8
    assert any(m["phrase"] == "dale dale" for m in out["ana"])
    assert all(m["phrase"] != "no se" for m in out["lucas"])


def test_muletillas_never_returns_generic_or_names():
    for bad in ["no se", "que haces", "jaja si", "el bruno"]:
        assert not is_candidate(bad.split(), names={"bruno"}, lang=ES)


def test_muletillas_cap_and_fields(mini_parquet, people):
    df = load_chat(str(mini_parquet), people)
    out = muletillas(df, {"Tomi": "tomi"}, people, LEGACY, ES)
    assert len(out["tomi"]) <= 10
    assert set(out["tomi"][0]) == {
        "phrase", "display", "own", "others", "perMilOwn", "perMilOthers", "ratio", "firstMonth", "example",
    }


def test_is_candidate_structural_filters():
    names = {"tomi"}
    assert is_candidate(["mira", "vos"], names, ES)
    assert is_candidate(["dale", "dale"], names, ES)  # reduplicación: sobrevive aunque sean stopwords
    assert not is_candidate(["mira"], names, ES)  # muy corta
    assert not is_candidate("a b c d e f".split(), names, ES)  # muy larga
    assert not is_candidate(["mira", "de"], names, ES)  # termina en preposición
    assert not is_candidate(["lo", "que", "es"], names, ES)  # solo stopwords
    assert not is_candidate(["jajaja", "jajaja"], names, ES)  # risa
    assert not is_candidate(["mira", "tomi"], names, ES)  # nombre
    assert not is_candidate(["al", "parecer"], names, ES)  # "al" no abre
    assert not is_candidate(["ah", "muy"], names, ES)  # fragmento de "ah muy bien"
    assert not is_candidate(["mabel", "no"], {"mabel"}, ES) and not is_candidate(["decis", "q"], names, ES)
    assert not is_candidate(["1", "hora"], names, ES) and not is_candidate(["u", "d"], names, ES)
    assert not is_candidate(["30", "mil"], names, ES) and is_candidate(["cocino", "a", "las", "21"], names, ES)
    assert not is_candidate(["jaja", "na"], names, ES) and not is_candidate(["lo", "general"], names, ES)
    assert is_candidate(["te", "amo"], names, ES)
    # "q" se normaliza a "que"; "que" abre solo frases de dos palabras (exclamativas).
    assert is_candidate(["q", "bronca"], names, ES) and is_candidate(["que", "bronca"], names, ES)
    assert not is_candidate(["que", "bronca", "tengo"], names, ES) and not is_candidate(["q", "bronca", "tengo"], names, ES)
    # Reduplicaciones de relleno no pasan; "dale dale" sí.
    for bad in ["si si si", "ya ya", "eh eh", "che che", "nada nada", "ah ah ah", "no no no"]:
        assert not is_candidate(bad.split(), names, ES), bad
    assert all(not is_candidate(g.split(), names, ES) for g in ES.generic_phrases)


def _df(rows):
    df = pd.DataFrame(rows, columns=["ts", "sender", "body"])
    df["ts"] = pd.to_datetime(df["ts"])
    df["kind"] = "text"
    return df


def test_is_candidate_in_english():
    en, names = get_lang("en"), {"tomi"}
    assert is_candidate(["miss", "them"], names, en) and is_candidate(["miss", "you"], names, en)
    assert is_candidate(["love", "you"], names, en) and is_candidate(["forget", "it"], names, en)  # objetos al final
    assert not is_candidate(["so", "we"], names, en) and not is_candidate(["and", "she"], names, en) and is_candidate(["u", "rock"], names, en)  # u -> you
    assert is_candidate(["no", "cap"], names, en)
    assert not is_candidate(["of", "the"], names, en) and not is_candidate(["see", "the"], names, en)
    assert not is_candidate(["and", "then"], names, en)  # no abre en conjunción
    assert not is_candidate(["i", "dont", "know"], names, en) and not is_candidate(["no", "way"], names, en)
    assert not is_candidate(["yes", "yes"], names, en) and is_candidate(["bro", "bro"], names, en)
    assert not is_candidate(["lol", "ok"], names, en) and not is_candidate(["haha", "nice"], names, en)
    assert not is_candidate(["the", "end"], names, en)  # nada abre con artículo


def test_muletillas_in_english_keep_contractions(people):
    rows = [(f"2024-01-{d:02d} 10:00", "Tomi", f"honestly i don't care about {w}") for d, w in
            zip(range(1, 11), ["cats", "dogs", "rain", "trains", "boats", "math", "lunch", "work", "golf", "jazz"])]
    rows += [(f"2024-02-{d:02d} 10:00", "Ana", f"just a normal message number {d}") for d in range(1, 21)]
    out = muletillas(_df(rows), {"Tomi": "tomi", "Ana": "ana"}, people, LEGACY, get_lang("en"))["tomi"]
    assert out and out[0]["phrase"] == "honestly i don't care" and out[0]["display"] == "honestly i don't care"


def test_muletillas_in_english(people):
    rows = [(f"2024-01-{d:02d} 10:00", "Tomi", "bro honestly this rocks") for d in range(1, 11)]
    rows += [(f"2024-02-{d:02d} 10:00", "Ana", f"just a normal message number {d}") for d in range(1, 21)]
    phrases = [m["phrase"] for m in muletillas(_df(rows), {"Tomi": "tomi", "Ana": "ana"}, people, LEGACY,
                                               get_lang("en"))["tomi"]]
    assert phrases and all(p in "bro honestly this rocks" for p in phrases)


def test_muletillas_values_example_and_first_month(people):
    rows = [(f"2024-0{1 + i // 5}-0{1 + i % 5} 10:00", "Tomi", f"mirá vos che {i}") for i in range(MIN_OWN)]
    rows += [("2024-03-01 10:00", "Ana", "mirá vos")] + [("2024-03-02 10:00", "Ana", "hola")] * 99
    out = muletillas(_df(rows), {"Tomi": "tomi", "Ana": "ana"}, people, LEGACY, ES)
    top = out["tomi"][0]
    # "mira vos che" tiene el mismo conteo propio que "mira vos": gana la corta (subsunción).
    assert top["phrase"] == "mira vos" and all(m["phrase"] != "mira vos che" for m in out["tomi"])
    assert (top["own"], top["others"]) == (MIN_OWN, 1)
    assert top["perMilOwn"] == 1000.0 and top["perMilOthers"] == 10.0 and top["ratio"] == 100.0
    assert top["firstMonth"] == "2024-01"
    assert top["example"]["when"].startswith("2024-") and "mirá vos" in top["example"]["text"]
    assert out["ana"] == []


def test_muletillas_counts_once_per_message_and_ignores_media(people):
    rows = [("2024-01-01 10:00", "Tomi", "mirá vos mirá vos mirá vos")] * (MIN_OWN - 1)
    df = _df(rows + [("2024-01-02 10:00", "Tomi", "mirá vos")])
    df.loc[len(df) - 1, "kind"] = "image"
    assert muletillas(df, {"Tomi": "tomi"}, people, LEGACY, ES)["tomi"] == []


def test_muletillas_ignore_document_captions(people):
    # iOS: "presupuesto.pdf • ‎2 páginas ‎documento omitido" queda como kind document con caption "presupuesto.pdf •"
    rows = [(f"2024-01-{d:02d} 10:00", "Tomi", "presupuesto.pdf •") for d in range(1, 2 * MIN_OWN)]
    rows += [(f"2024-02-{d:02d} 10:00", "Ana", f"un mensaje normal número {d}") for d in range(1, 21)]
    df = _df(rows)
    df["caption"] = df["sender"] == "Tomi"
    df.loc[df["sender"] == "Tomi", "kind"] = "document"
    assert muletillas(df, {"Tomi": "tomi", "Ana": "ana"}, people, LEGACY, ES)["tomi"] == []


def test_muletillas_count_photo_captions_not_document_names(people):
    # Un pie de foto es texto escrito (cuenta); el de un documento de iOS es su nombre de archivo (no cuenta).
    rows = [(f"2024-01-{d:02d} 10:00", "Tomi", f"mirá vos che {d}") for d in range(1, MIN_OWN + 1)]
    rows += [(f"2024-02-{d:02d} 10:00", "Ana", f"un mensaje normal número {d}") for d in range(1, 21)]
    df = _df(rows)
    df["caption"] = df["sender"] == "Tomi"
    tomi = df["sender"] == "Tomi"
    df.loc[tomi, "kind"] = "image"
    slugs = {"Tomi": "tomi", "Ana": "ana"}
    assert [m["phrase"] for m in muletillas(df, slugs, people, LEGACY, ES)["tomi"]][:1] == ["mira vos"]
    df.loc[tomi, "kind"] = "document"
    assert muletillas(df, slugs, people, LEGACY, ES)["tomi"] == []


def test_muletillas_caps_at_top(people):
    rows = []
    for k in range(TOP + 3):
        rows += [("2024-01-01 10:00", "Tomi", f"frase{k} unica{k}")] * MIN_OWN
    rows += [("2024-01-01 10:00", "Ana", "hola")] * 10
    assert len(muletillas(_df(rows), {"Tomi": "tomi", "Ana": "ana"}, people, LEGACY, ES)["tomi"]) == TOP


def test_muletillas_overlapping_fragments_collapse(people):
    rows = [("2024-01-01 10:00", "Tomi", "harina huevo y azúcar")] * MIN_OWN
    rows += [("2024-01-01 10:00", "Ana", "hola")] * 10
    phrases = [m["phrase"] for m in muletillas(_df(rows), {"Tomi": "tomi", "Ana": "ana"}, people, LEGACY, ES)["tomi"]]
    assert phrases == ["harina huevo"]


def test_proper_nouns_by_mid_sentence_capitals():
    bodies = ["fuimos con Mabel al cine"] * LEGACY.proper_min_n + ["Cine y cine"] * LEGACY.proper_min_n
    assert proper_nouns(bodies, ES, LEGACY) == {"mabel"}


def test_proper_nouns_skip_stopwords_and_english_i():
    bodies = ["Yes I said that I was there with Mabel"] * LEGACY.proper_min_n
    assert proper_nouns(bodies, get_lang("en"), LEGACY) == {"mabel"}  # "I" siempre va con mayúscula: no es un nombre


def test_muletillas_in_english_survive_capital_i(people):
    rows = [(f"2024-01-{d:02d} 10:00", "Tomi", f"honestly I don't care about {w}") for d, w in
            zip(range(1, 11), ["cats", "dogs", "rain", "trains", "boats", "math", "lunch", "work", "golf", "jazz"])]
    rows += [(f"2024-02-{d:02d} 10:00", "Ana", "Yes I said that I was there") for d in range(1, 21)]
    phrases = [m["phrase"] for m in muletillas(_df(rows), {"Tomi": "tomi", "Ana": "ana"}, people, LEGACY,
                                               get_lang("en"))["tomi"]]
    assert "honestly i don't care" in phrases


def test_muletillas_drop_phrases_with_proper_nouns(people):
    rows = [("2024-01-01 10:00", "Tomi", "la vimos a Mabel")] * LEGACY.proper_min_n
    rows += [("2024-01-01 10:00", "Ana", "hola")] * 10
    assert muletillas(_df(rows), {"Tomi": "tomi", "Ana": "ana"}, people, LEGACY, ES)["tomi"] == []


def _filler(n=200):
    return [("2024-01-01 10:00", "Ana", "hola")] * n


def test_muletillas_q_counts_as_que(people):
    rows = [("2024-01-01 10:00", "Tomi", "Q bronca")] * 5 + [("2024-01-02 10:00", "Tomi", "qué bronca che")] * 5
    phrases = {m["phrase"]: m["own"] for m in muletillas(_df(rows + _filler()), {"Tomi": "tomi"}, people, LEGACY, ES)["tomi"]}
    assert phrases == {"que bronca": 10}


def test_muletillas_display_is_the_most_frequent_surface_form(people):
    rows = [("2024-01-01 10:00", "Tomi", "Qué ilusión")] * 3 + [("2024-01-02 10:00", "Tomi", "que ilusion")]
    rows += [("2024-01-03 10:00", "Tomi", "QUÉ ILUSIÓN che")] * 3 + [("2024-01-04 10:00", "Tomi", "q ilusion vos")] * 2
    top = muletillas(_df(rows + _filler()), {"Tomi": "tomi"}, people, LEGACY, ES)["tomi"][0]
    assert (top["phrase"], top["display"]) == ("que ilusion", "qué ilusión")


def test_muletillas_display_keeps_q_expanded_and_exclamative_at_start(people):
    rows = [("2024-01-01 10:00", "Tomi", "Q bronca")] * 5 + [("2024-01-02 10:00", "Tomi", "qué bronca che")] * 4
    rows += [("2024-01-03 10:00", "Tomi", "y qué bronca")] * 3  # no abre el mensaje: no cuenta
    top = muletillas(_df(rows + _filler()), {"Tomi": "tomi"}, people, LEGACY, ES)["tomi"][0]
    assert (top["phrase"], top["display"]) == ("que bronca", "que bronca")


def test_muletillas_survives_when_rest_says_it_more_in_total(people):
    # 10 de Tomi contra 11 del resto: el resto junto la dice más, pero por mil Tomi la dice muchísimo más.
    rows = [("2024-01-01 10:00", "Tomi", "mirá vos")] * 10
    rows += [("2024-01-01 10:00", "Ana", "mirá vos")] * 11 + _filler(5000)
    top = muletillas(_df(rows), {"Tomi": "tomi"}, people, LEGACY, ES)["tomi"][0]
    assert (top["phrase"], top["own"], top["others"]) == ("mira vos", 10, 11)


def test_muletillas_score_floor_drops_weak_phrases(people):
    # 80 por mil contra 14 (ratio 5.7, sobre MIN_RATIO), pero score = 5.7 * log(8) ~ 12, bajo MIN_SCORE.
    rows = [("2024-01-01 10:00", "Tomi", "mirá vos")] * 8 + [("2024-01-01 10:00", "Tomi", "hola")] * 92
    rows += [("2024-01-01 10:00", "Ana", "mirá vos")] * 7 + [("2024-01-01 10:00", "Ana", "hola")] * 493
    assert muletillas(_df(rows), {"Tomi": "tomi"}, people, LEGACY, ES)["tomi"] == []


def test_variant_numbers():
    assert _variant("cocino a las 21", "cocino a las 22") and not _variant("cocino a las 21", "llego a las 21")
    assert _variant("me la pinto", "me la pintaste") and not _variant("me la pinto", "me la pido")


def test_muletillas_suffix_fragment_loses_to_longer_phrase(people):
    rows = [("2024-01-01 10:00", "Tomi", f"palabra{i} ya fue la fiesta") for i in range(MIN_OWN)]
    phrases = [m["phrase"] for m in muletillas(_df(rows + _filler()), {"Tomi": "tomi"}, people, LEGACY, ES)["tomi"]]
    assert "ya fue la fiesta" in phrases and "fue la fiesta" not in phrases


def test_muletillas_reject_contact_surnames(people):
    rows = [("2024-01-01 10:00", "Tomi", "che castro")] * MIN_OWN
    assert muletillas(_df(rows + _filler()), {"Tomi": "tomi"}, people, LEGACY, ES)["tomi"] == []


def test_muletillas_exclamative_only_at_message_start(people):
    rows = [("2024-01-01 10:00", "Tomi", "tengo que buscar el auto")] * MIN_OWN
    phrases = [m["phrase"] for m in muletillas(_df(rows + _filler()), {"Tomi": "tomi"}, people, LEGACY, ES)["tomi"]]
    assert "que buscar" not in phrases


def test_muletillas_drop_left_fragments_of_blocked_phrases(people):
    rows = [("2024-01-01 10:00", "Tomi", f"palabra{i} el gato le roba la cena") for i in range(MIN_OWN)]
    phrases = [m["phrase"] for m in muletillas(_df(rows + _filler()), {"Tomi": "tomi"}, people, LEGACY, ES)["tomi"]]
    assert not any(p.startswith("gato") for p in phrases)


# ---------------------------------------------------------------- resto del capítulo Lenguaje
import json  # noqa: E402
import math  # noqa: E402

from build_web_data import profiled  # noqa: E402
from conftest import CONTENT, FIXTURE_BADWORDS, web_config  # noqa: E402
from wa.lang import get_lang  # noqa: E402
from web.language import (  # noqa: E402
    badword_hits, badwords, build_language, laughed, laughs, load_badwords, repeated_by_others, style,
)

LANGUAGE_KEYS = {"muletillas", "repeated", "laughed", "badwords", "style", "laughs", "top"}


def _msgs(rows):
    """rows: (ts, sender, body[, kind[, edited]]) -> df con las columnas de load_chat que usa el capítulo."""
    rows = [r + ("text", False)[len(r) - 3:] for r in rows]
    df = pd.DataFrame(rows, columns=["ts", "sender", "body", "kind", "edited"])
    df["ts"] = pd.to_datetime(df["ts"])
    df["n_chars"] = df["body"].str.len()
    df["caption"] = False
    return df.sort_values("ts", kind="stable").reset_index(drop=True)


SLUGS = {"Tomi": "tomi", "Ana": "ana", "Lucas": "lucas"}
QUOTE = "che esto es un zorzalito muy original que dije yo"


def test_repeated_by_others_counts_later_verbatim_copies(people):
    rows = [
        ("2024-01-01 09:00", "Ana", "un zorzalito muy original que"),  # ese 5-grama es de Ana: lo dijo antes
        ("2024-01-01 10:00", "Tomi", QUOTE),
        ("2024-01-02 10:00", "Tomi", "repito: esto es un zorzalito muy original"),  # la dueña no cuenta
        ("2024-01-03 10:00", "Ana", "como dice tomi esto es un zorzalito muy original"),
        ("2024-01-04 10:00", "Lucas", "ESTO ES UN ZORZALITO MUY ORIGINAL!!"),
        ("2024-01-05 10:00", "Ana", "esto es un zorzalito muy original jaja"),
        ("2024-01-06 10:00", "Tomi", "otra frase que solo repite una persona sola"),
        ("2024-01-07 10:00", "Ana", "otra frase que solo repite una persona sola"),
        ("2024-01-08 10:00", "Ana", "otra frase que solo repite una persona sola"),
        ("2024-01-09 10:00", "Ana", "otra frase que solo repite una persona sola"),
    ]
    out = repeated_by_others(_msgs(rows), SLUGS, people, LEGACY, lang=ES)
    assert set(out) == {"tomi", "ana", "lucas"}
    [top] = out["tomi"]  # la segunda frase la repitió una sola persona: no entra
    assert top == {"text": QUOTE, "when": "2024-01-01T10:00:00", "times": 3, "people": 2, "by": ["ana", "lucas"]}
    assert out["ana"] == [] and out["lucas"] == []


def test_repeated_by_others_needs_three_copies_and_five_words(people):
    rows = [("2024-01-01 10:00", "Tomi", QUOTE), ("2024-01-02 10:00", "Ana", "esto es un zorzalito muy original"),
            ("2024-01-03 10:00", "Lucas", "esto es un zorzalito muy original"),
            ("2024-01-04 10:00", "Ana", "es un zorzalito muy")]
    assert repeated_by_others(_msgs(rows), SLUGS, people, LEGACY, lang=ES)["tomi"] == []


def test_repeated_by_others_counts_photo_captions_not_document_names(people):
    rows = [("2024-01-01 10:00", "Tomi", QUOTE), ("2024-01-02 10:00", "Ana", "esto es un zorzalito muy original"),
            ("2024-01-03 10:00", "Lucas", "esto es un zorzalito muy original"),
            ("2024-01-04 10:00", "Ana", "esto es un zorzalito muy original jaja")]
    df = _msgs(rows)
    df.loc[1:, "caption"], df.loc[1:, "kind"] = True, "image"  # las copias, como pies de foto
    assert repeated_by_others(df, SLUGS, people, LEGACY, lang=ES)["tomi"][0]["times"] == 3
    df.loc[1:, "kind"] = "document"
    assert repeated_by_others(df, SLUGS, people, LEGACY, lang=ES)["tomi"] == []


def _laugh_rows(start, joke_by, laughers, gap_s=20):
    t0 = pd.Timestamp(start)
    rows = [(t0, joke_by, "esto es un chiste buenisimo")]
    rows += [(t0 + pd.Timedelta(seconds=gap_s * (k + 1)), who, "jajaja") for k, who in enumerate(laughers)]
    return rows


def test_laughed_uses_records_definition():
    rows = _laugh_rows("2024-01-01 10:00", "Tomi", ["Ana", "Lucas", "Ana", "Tomi", "Lucas"])
    rows += _laugh_rows("2024-02-01 10:00", "Tomi", ["Ana", "Lucas", "Ana", "Lucas", "Ana"])
    rows += _laugh_rows("2024-03-01 10:00", "Ana", ["Tomi", "Lucas", "Tomi", "Lucas"], gap_s=50)  # el 4° a los 200 s
    rows += [("2024-04-01 10:00", "Lucas", "corto"), ("2024-04-01 10:00:10", "Tomi", "jaja")]
    out = laughed(_msgs(rows), SLUGS, LEGACY, ES)
    assert out["tomi"] == {"when": "2024-02-01T10:00:00", "text": "esto es un chiste buenisimo", "laughs": 5,
                          "people": 2}
    assert out["ana"] is None and out["lucas"] is None


WORDS = {"boludo", "hijo de puta", "puta", "la concha"}


def test_badwords_counts_messages_terms_and_record():
    rows = [
        ("2024-01-01 10:00", "Tomi", "sos un Boludó"),
        ("2024-01-02 10:00", "Tomi", "hijo de puta"),  # una sola puteada, no dos
        ("2024-01-03 10:00", "Tomi", "pelotudos"),  # no está en la lista
        ("2024-01-04 10:00", "Ana", "boludo, hijo de puta, la concha, me quemé, puta madre"),
        ("2024-01-05 10:00", "Ana", "boludo la concha puta hijo de puta"),  # empata en 4: gana el primero
        ("2024-01-06 10:00", "Ana", "hola"),
        ("2024-01-07 10:00", "Lucas", "puta"),
    ]
    df = _msgs(rows)
    hits = badword_hits(df, WORDS, ES)
    assert hits.loc[1] == ("hijo de puta",)
    out = badwords(df, SLUGS, WORDS, ES)
    assert out["total"] == 5
    assert out["byPerson"][0] == {"slug": "lucas", "n": 1, "perMil": 1000.0}
    assert {r["slug"]: (r["n"], r["perMil"]) for r in out["byPerson"]} == {
        "lucas": (1, 1000.0), "tomi": (2, 666.7), "ana": (2, 666.7),
    }
    assert out["record"] == {"who": "ana", "when": "2024-01-04T10:00:00",
                             "text": "boludo, hijo de puta, la concha, me quemé, puta madre", "distinct": 4}


def test_badwords_without_hits():
    out = badwords(_msgs([("2024-01-01 10:00", "Tomi", "hola")]), SLUGS, WORDS, ES)
    assert out == {"byPerson": [{"slug": "tomi", "n": 0, "perMil": 0.0}], "total": 0, "record": None}


def test_load_badwords_file():
    words = load_badwords(FIXTURE_BADWORDS, ES)
    assert len(words) >= 50 and {"boludo", "hijo de puta", "la concha"} <= words
    assert all(w == w.strip().lower() and "  " not in w and not w.startswith("#") for w in words)


def test_base_badwords_are_normalized_and_in_the_fixture_list():
    from web.language import base_badwords

    es, en = base_badwords(get_lang("es")), base_badwords(get_lang("en"))
    assert len(es) >= 30 and len(en) >= 30 and "boludo" in es and "fuck" in en
    assert es <= load_badwords(FIXTURE_BADWORDS, ES)  # la lista del fixture arranca de la base, como las del synth
    assert all(w == " ".join(w.split()) and w == w.lower() for w in es | en)


def test_style_per_person():
    rows = [
        ("2024-01-01 10:00", "Tomi", "HOLA CHE!"),
        ("2024-01-01 10:01", "Tomi", "que tal?"),
        ("2024-01-01 10:02", "Tomi", "OK"),  # menos de 4 letras: no cuenta para mayúsculas
        ("2024-01-01 10:03", "Tomi", "editado", "text", True),
        ("2024-01-01 10:04", "Tomi", "", "deleted"),
        ("2024-01-01 10:05", "Ana", "hola"),
    ]
    out = {r["slug"]: r for r in style(_msgs(rows), {"Tomi": "tomi", "Ana": "ana"}, ES)}
    assert out["tomi"] == {"slug": "tomi", "avgChars": 6.5, "upperShare": 0.333, "exclPerMil": 200.0,
                          "questPerMil": 200.0, "editedPerMil": 200.0, "deletedPerMil": 200.0}
    assert out["ana"]["upperShare"] == 0.0 and out["ana"]["avgChars"] == 4.0


def test_style_ignores_urls_and_caps_laughs():
    rows = [
        ("2024-01-01 10:00", "Ana", "hola"),
        ("2024-01-01 10:01", "Ana", "mira esto https://youtu.be/abc?si=XY!"),  # el ? y el ! son del link
        ("2024-01-01 10:02", "Ana", "JAJAJAJA"),  # risa en mayúsculas: no es gritar
        ("2024-01-01 10:03", "Ana", "NO PUEDE SER"),
        ("2024-01-01 10:04", "Ana", "https://X.COM/ABCDEF"),  # sin letras fuera del link
    ]
    [out] = style(_msgs(rows), {"Ana": "ana"}, ES)
    assert (out["questPerMil"], out["exclPerMil"]) == (0.0, 0.0)
    assert out["upperShare"] == 0.333  # NO PUEDE SER de hola / mira esto / NO PUEDE SER


def test_laughs_mix_avg_and_record():
    rows = [
        ("2024-01-01 10:00", "Tomi", "jaja"),
        ("2024-01-01 10:01", "Tomi", "JAJAJAJ jaja"),
        ("2024-01-01 10:02", "Tomi", "jsjsjs"),
        ("2024-01-01 10:03", "Tomi", "jeje"),
        ("2024-01-01 10:04", "Tomi", "jiji"),
        ("2024-01-01 10:05", "Tomi", "xD"),
        ("2024-01-01 10:06", "Tomi", "me mato 😂😂"),
        ("2024-01-01 10:07", "Tomi", "🤣"),
        ("2024-01-01 10:08", "Tomi", "trabajo en jajuy"),  # no es risa
        ("2024-01-01 10:09", "Ana", "no puedo jajajajajajajaja"),  # no es solo risa, pero es el jaja más largo
        ("2024-01-01 10:10", "Lucas", "jajajajajajajaja"),  # empata en 8: gana el primero
    ]
    out = laughs(_msgs(rows), SLUGS, ES)
    by = {r["slug"]: r for r in out["byPerson"]}
    assert _mix(by["tomi"]) == {"jaja": 2, "jsjs": 1, "jeje": 1, "jiji": 1, "emoji": 2, "xd": 1}
    assert by["tomi"]["avgJa"] == round((2 + 3 + 2) / 3, 1)
    assert _mix(by["ana"])["jaja"] == 1 and by["ana"]["avgJa"] == 8.0  # cualquier texto con risa cuenta
    assert out["record"] == {"who": "ana", "when": "2024-01-01T10:09:00", "text": "no puedo jajajajajajajaja",
                             "length": 8}


def test_laughs_classify_every_text_once():
    rows = [
        ("2024-01-01 10:00", "Tomi", "me mato jajaja"),
        ("2024-01-01 10:01", "Tomi", "me mato 😂"),
        ("2024-01-01 10:02", "Tomi", "jsjs 😂 jaja"),  # una vez, por la primera palabra de risa
        ("2024-01-01 10:03", "Tomi", "kkkk lol"),  # risa sin clase de LAUGH_KINDS
        ("2024-01-01 10:04", "Tomi", "😂", "image"),  # solo textos
    ]
    [tomi] = laughs(_msgs(rows), {"Tomi": "tomi"}, ES)["byPerson"]
    assert _mix(tomi) == {"jaja": 1, "jsjs": 1, "jeje": 0, "jiji": 0, "emoji": 1, "xd": 0}
    assert tomi["avgJa"] == round((3 + 2) / 2, 1)


def _mix(person: dict) -> dict:
    return {m["key"]: m["n"] for m in person["mix"]}


def test_laughs_mix_is_a_list_in_lang_order():
    rows = [("2024-01-01 10:00", "Tomi", "jaja"), ("2024-01-01 10:01", "Tomi", "😂")]
    out = laughs(_msgs(rows), {"Tomi": "tomi"}, get_lang("es"))
    assert [m["key"] for m in out["byPerson"][0]["mix"]] == ["jaja", "jsjs", "jeje", "jiji", "xd", "emoji"]
    assert out["byPerson"][0]["mix"][0] == {"key": "jaja", "label": "jaja", "n": 1}
    assert out["byPerson"][0]["mix"][-1] == {"key": "emoji", "label": "😂", "n": 1}


def test_laughs_in_english():
    rows = [
        ("2024-01-01 10:00", "Tomi", "hahaha"),
        ("2024-01-01 10:01", "Tomi", "HAHA that was great"),
        ("2024-01-01 10:02", "Tomi", "he said lol"),  # "he" no es risa: cuenta el lol
        ("2024-01-01 10:03", "Tomi", "lmaooo"),
        ("2024-01-01 10:04", "Tomi", "hehehe"),
        ("2024-01-01 10:05", "Tomi", "xD"),
        ("2024-01-01 10:06", "Tomi", "jajaja"),  # en inglés no es risa
        ("2024-01-01 10:07", "Ana", "hahahahahahaha"),
    ]
    out = laughs(_msgs(rows), {"Tomi": "tomi", "Ana": "ana"}, get_lang("en"))
    by = {r["slug"]: r for r in out["byPerson"]}
    assert [m["key"] for m in by["tomi"]["mix"]] == ["haha", "hehe", "lol", "lmao", "xd", "emoji"]
    assert _mix(by["tomi"]) == {"haha": 2, "hehe": 1, "lol": 1, "lmao": 1, "xd": 1, "emoji": 0}
    assert by["tomi"]["avgJa"] == round((3 + 2) / 2, 1)  # "ha" por palabra haha
    assert out["record"]["who"] == "ana" and out["record"]["length"] == 7


def test_badwords_record_text_is_clipped():
    body = "boludo puta " + "x" * 400
    out = badwords(_msgs([("2024-01-01 10:00", "Tomi", body)]), {"Tomi": "tomi"}, WORDS, ES)
    assert out["record"]["text"] == body[:300] and out["record"]["distinct"] == 2


def test_build_language_top_picks_across_people(mini_parquet, people):
    df = load_chat(str(mini_parquet), people)
    plist = [{"name": n, "slug": s} for n, s in SLUGS.items()]
    out = build_language(df, plist, people, load_badwords(FIXTURE_BADWORDS, ES), LEGACY, lang=ES)
    assert set(out) == LANGUAGE_KEYS and set(out["top"]) == {"muletilla", "repeated"}
    firsts = [{**ms[0], "slug": s} for s, ms in out["muletillas"].items() if ms]
    assert firsts and out["top"]["muletilla"] == max(firsts, key=lambda m: m["ratio"] * math.log(m["own"]))
    repeated = [{**r, "slug": s} for s, rs in out["repeated"].items() for r in rs]
    assert out["top"]["repeated"] == (max(repeated, key=lambda r: r["times"]) if repeated else None)


def _lang(web_data):
    path = web_data / "language.json"
    return json.loads(path.read_text(encoding="utf-8"))


def test_language_json_shape(web_data):
    lang = _lang(web_data)
    g = json.loads((web_data / "global.json").read_text(encoding="utf-8"))
    slugs = set(profiled(g["people"]).values())
    assert set(lang) == LANGUAGE_KEYS
    assert all(r["perMil"] >= 0 for r in lang["badwords"]["byPerson"])
    assert sorted(r["slug"] for r in lang["style"]) == sorted(slugs)
    assert lang["laughs"]["record"]["length"] >= 4
    assert set(lang["laughed"]) <= slugs
    texts = [m["example"]["text"] for ms in lang["muletillas"].values() for m in ms]
    texts += [r["text"] for rs in lang["repeated"].values() for r in rs]
    texts += [r["text"] for r in lang["laughed"].values() if r]
    assert texts and all("⁨" not in t for t in texts)


def test_run_prints_badword_review(mini_parquet, mini_out, tmp_path, capsys):
    from build_web_data import run

    run(["--config", str(web_config(tmp_path)), "--content", str(CONTENT), "--data", str(mini_parquet),
         "--analysis", str(mini_out), "--out", str(tmp_path / "web"), "--min-msgs", "1"])
    assert "badwords.txt" in capsys.readouterr().err


NOTICE = 'Tomi "Tomate" Suárez🍅'


def test_repeated_by_others_drops_stock_phrases_and_lists(people):
    rows = [
        ("2024-01-01 10:00", "Tomi", "y encima no zorzaleo la puerta de noche"),
        ("2024-01-01 11:00", "Tomi", "Asado miércoles:\n1) Tomi\n2) Ana"),
        ("2024-01-01 12:00", "Tomi", f"{NOTICE} restableció el enlace de invitación de este grupo"),
    ]
    for k, who in enumerate(["Ana", "Lucas", "Ana"]):
        rows.append((f"2024-01-0{k + 2} 10:00", who, "yo tampoco zorzaleo la puerta de noche"))
        rows.append((f"2024-01-0{k + 2} 11:00", who, "Asado miércoles:\n1) Tomi\n2) Ana\n3) Lucas"))
        rows.append((f"2024-01-0{k + 2} 12:00", who, "quien restableció el enlace de invitación de este grupo?"))
    df = _msgs(rows)
    assert repeated_by_others(df, SLUGS, people, LEGACY, lang=ES)["tomi"][0]["text"] == "y encima no zorzaleo la puerta de noche"
    assert len(repeated_by_others(df, SLUGS, people, LEGACY, lang=ES)["tomi"]) == 1  # ni la lista de anotados ni el aviso pegado son frases
    assert repeated_by_others(df, SLUGS, people, LEGACY, background=["si no zorzaleo la puerta de noche me muero"], lang=ES)["tomi"] == []


def test_repeated_by_others_drops_common_word_phrases_only_without_background(people):
    rows = [("2024-01-01 10:00", "Tomi", "y encima no abro la puerta de noche")]
    rows += [(f"2024-01-0{k + 2} 10:00", who, "yo tampoco abro la puerta de noche") for k, who in enumerate(["Ana", "Lucas", "Ana"])]
    assert repeated_by_others(_msgs(rows), SLUGS, people, LEGACY, lang=ES)["tomi"] == []
    rows = [(ts, who, body.replace("abro", "zorzaleo")) for ts, who, body in rows]  # con una palabra rara ya es de ellos
    assert len(repeated_by_others(_msgs(rows), SLUGS, people, LEGACY, lang=ES)["tomi"]) == 1
    # con chats de fondo manda el fondo: la frase de palabras corrientes que el fondo no dice se conserva
    common = [(ts, who, body.replace("zorzaleo", "abro")) for ts, who, body in rows]
    other_bg = ["una tarde de pulpos y trenes viejos"]
    assert len(repeated_by_others(_msgs(common), SLUGS, people, LEGACY, other_bg, lang=ES)["tomi"]) == 1
    same_bg = ["si no abro la puerta de noche me muero"]
    assert repeated_by_others(_msgs(common), SLUGS, people, LEGACY, same_bg, lang=ES)["tomi"] == []


def test_load_background_is_other_chats_before_the_main_chat(tmp_path):
    from build_web_data import load_background

    df = pd.DataFrame({
        "chat": ["bg0", "bg0", "bg0", "main"],
        "ts": pd.to_datetime(["2023-01-01", "2023-01-02", "2024-01-01", "2023-01-01"]),
        "body": ["uno dos tres cuatro cinco", "corto", "uno dos tres cuatro seis", "a b c d e"],
        "kind": "text",
    })
    df["n_words"] = df["body"].str.split().str.len()
    df.to_parquet(tmp_path / "m.parquet", index=False)
    assert load_background(str(tmp_path / "m.parquet"), "2023-09-01").tolist() == ["uno dos tres cuatro cinco"]
