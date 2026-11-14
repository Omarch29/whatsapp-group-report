from pathlib import Path

import pytest
from conftest import ROOT

from wa.locales import LOCALES, UnknownFormat, detect, infer_date_order

FORMATS = ROOT / "tests" / "fixtures" / "formats"
NB = "\u202f"


def read_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines(keepends=True)


@pytest.mark.parametrize("name,platform,lang,order", [
    ("ios-es", "ios", "es", "dmy"), ("ios-en", "ios", "en", "mdy"), ("android-es", "android", "es", "dmy"),
    ("android-en", "android", "en", "mdy"), ("ios-es-24h", "ios", "es", "dmy"),
])
def test_detect_each_fixture(name, platform, lang, order):
    loc, date_order = detect(read_lines(FORMATS / f"{name}.txt"))
    assert (loc.platform, loc.lang, date_order) == (platform, lang, order)


def test_four_locales_only_ios_es_verified():
    assert set(LOCALES) == {("ios", "es"), ("ios", "en"), ("android", "es"), ("android", "en")}
    assert [k for k, loc in LOCALES.items() if loc.verified] == [("ios", "es")]
    assert all((loc.platform, loc.lang) == k for k, loc in LOCALES.items())


def test_unknown_format_names_first_lines():
    with pytest.raises(UnknownFormat, match="Primeras líneas") as e:
        detect(["hola\n", "esto no es un export\n", "tampoco\n"])
    assert "hola\nesto no es un export" in str(e.value) and isinstance(e.value, ValueError)


@pytest.mark.parametrize("fmt,media", [("[{d}/11/26, 14:{d:02d}:09] {who}: {text}", "\u200eimagen omitida"),
                                       ("{d}/11/26, 14:{d:02d} - {who}: {text}", "<Multimedia omitido>")])
def test_24h_export_in_another_language_is_unknown(fmt, media):
    """Hora de 24 h y solo texto (ningún aviso de la app): nada dice que sea castellano o inglés."""
    texts = ["ciao a tutti", "come state?", "stasera pizza", "va bene", "a che ora?", "alle otto", "perfetto",
             "porto io il vino", "grazie mille", "a dopo"]
    lines = [fmt.format(d=d, who=("Marco", "Giulia")[d % 2], text=t) + "\n" for d, t in enumerate(texts, 1)]
    with pytest.raises(UnknownFormat, match=r"\(es\) e inglés \(en\)"):
        detect(lines)
    # con un aviso de la app en castellano, el idioma queda dicho
    loc, _ = detect([*lines, fmt.format(d=11, who="Marco", text=media) + "\n"])
    assert loc.lang == "es"


def test_two_headers_are_not_enough():
    with pytest.raises(UnknownFormat):
        detect(["[1/2/26, 10:00:00 a. m.] Ana: hola"] * 2)


def test_detect_reads_only_the_first_50_lines():
    with pytest.raises(UnknownFormat):
        detect(["basura"] * 50 + ["[13/2/26, 10:00:00 a. m.] Ana: hola"] * 10)


def test_ambiguous_order_defaults_to_dmy():
    assert detect(["[1/2/26, 10:00:00 a. m.] Ana: hola"] * 3)[1] == "ambiguous"


def test_second_number_over_12_means_mdy():
    loc, order = detect(["1/2/26, 10:00 AM - Ana: hi", "1/2/26, 10:01 AM - Ana: yo", "1/14/26, 9:00 PM - Tomi: ok"])
    assert (loc.platform, loc.lang, order) == ("android", "en", "mdy")


def test_infer_date_order_on_a_given_locale():
    lines = ["[1/2/26, 10:00:00] Ana: hola", "[25/2/26, 10:00:00] Ana: hola"]
    assert infer_date_order(lines, LOCALES[("ios", "es")]) == "dmy"
    assert infer_date_order(lines[:1], LOCALES[("ios", "es")]) == "ambiguous"


@pytest.mark.parametrize("line,platform,lang", [
    (f"[13/11/26, 2:05:09{NB}p.{NB}m.] Ana: hola", "ios", "es"),
    ("‎[13/11/26, 2:05:09 p. m.] Ana: ‎imagen omitida", "ios", "es"),
    ("[13/11/2026, 14:05:09] Ana: hola", "ios", "es"),
    (f"[11/13/26, 2:05:09{NB}PM] Ana: hi", "ios", "en"),
    ("[11/13/26, 2:05:09 PM] Ana: hi", "ios", "en"),
    ("13/11/26, 2:05 p. m. - Ana: hola", "android", "es"),
    (f"13/11/26, 2:05{NB}p.{NB}m. - Ana: hola", "android", "es"),
    ("13/11/26 14:05 - Ana: hola", "android", "es"),
    ("13/11/26, 14:05 - Ana: hola", "android", "es"),
    ("11/13/26, 2:05 PM - Ana: hi", "android", "en"),
    (f"11/13/26, 2:05{NB}PM - Ana: hi", "android", "en"),
    ("11/13/26, 14:05 - Ana: hi", "android", "en"),
])
def test_header_variants(line, platform, lang):
    assert LOCALES[(platform, lang)].header.match(line)
    other_platform = "android" if platform == "ios" else "ios"
    assert not LOCALES[(other_platform, lang)].header.match(line)


def test_24h_english_export_is_english_by_its_content():
    """Sin "a. m."/"PM" la cabecera no dice el idioma: desempatan los textos de la app (multimedia, sistema...)."""
    lines = ["[13/11/26, 14:05:09] Ana: ‎image omitted", "[13/11/26, 14:06:00] Tomi: hi",
             "‎[13/11/26, 14:07:00] Los del Parque 🌳: ‎Bruno left", "[13/11/26, 14:08:00] Caro: ok"]
    loc, order = detect(lines)
    assert (loc.platform, loc.lang, order) == ("ios", "en", "dmy")
    android = ["13/11/26 14:05 - Ana: <Media omitted>", "13/11/26 14:06 - Bruno left", "13/11/26 14:07 - Tomi: hi"]
    assert (detect(android)[0].platform, detect(android)[0].lang) == ("android", "en")
