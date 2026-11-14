"""Recursos por idioma del chat: stopwords, risas, muletillas, puteadas base, días, meses y etiquetas de la web.

get_lang(code) es la única entrada: devuelve el Lang de "es" (castellano rioplatense, los valores de siempre) o
"en" (inglés). Los módulos reciben el objeto Lang; ninguno importa constantes de un idioma directamente.

- word_re: una palabra para wa.text.tokens; word_chars: los caracteres de palabra de web.common.norm_words (rango de
  clase de regex; con "'" el apóstrofo es de la palabra, solo entre letras: "don't" es una palabra en inglés).
- stopwords: palabras que no cuentan como contenido (wa.text.tokens, las muletillas y las citas de web.language).
- laugh_re: una palabra que es risa (wa.text.is_laugh); laugh_kinds: las clases de risa de web.language.laughs
  (clave, etiqueta, regex de palabra entera), la primera es la de avgJa (laugh_unit cuenta sus repeticiones, "ja" o
  "ha"); laugh_emoji: los emojis de risa; laugh_hint: regex barata que toda risa cumple (prefiltro).
- filler_redup, generic_phrases, edge, start_block, end_block, abbreviations, one_char_ok, exclamative: los filtros
  estructurales de las muletillas (web.language.is_candidate).
- badwords_base: puteadas genéricas del idioma (sin apodos de nadie); content/badwords.txt arranca de ellas
  (synth.render las escribe ahí) y build_web_data cuenta solo las del archivo.
- dow (lunes primero) y months (enero primero).
- labels: textos que el pipeline escribe en los JSON de la web; departures: regex del capítulo de salidas.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import cached_property
from typing import TYPE_CHECKING, Callable

from wa.text import strip_accents

if TYPE_CHECKING:
    from web.thresholds import Thresholds

CODES = ("es", "en")


@dataclass(frozen=True, eq=False)
class Labels:
    rest: str  # nombre de la entrada "resto" de global.json
    unknown_mention: str  # mención a alguien que no está en people.json
    unnamed_rename: str  # cambio de nombre del grupo cuyo aviso no trae el nombre nuevo
    new_photo: str  # hito de la línea de tiempo del censo
    msgs: Callable[[int], str]  # "2.300 mensajes" / "2,300 messages"
    returns: Callable[[int], str]  # "3 vueltas" / "3 returns"
    awards: Callable[["Thresholds"], list[tuple[str, str, str, str | tuple[str, str]]]]  # (id, título, criterio, unidad); unidad: texto o (singular, plural)
    fmt_int: Callable[[int], str]  # "2.300" / "2,300"


@dataclass(frozen=True, eq=False)
class DeparturesPatterns:
    accuse: str  # otros hablando del miembro celoso / enojado
    complain: str  # quejas de exclusión del miembro
    quote_templates: tuple[str, ...]  # citas atribuidas; {names} = alternancia de sus alias
    complaint_chip: tuple[str, str]  # (regex, etiqueta) del chip de quejas


@dataclass(frozen=True, eq=False, repr=False)
class Lang:
    code: str
    word_re: re.Pattern
    word_chars: str
    stopwords: frozenset[str]
    laugh_re: re.Pattern
    laugh_kinds: tuple[tuple[str, str, re.Pattern], ...]
    laugh_emoji: tuple[str, ...]
    laugh_unit: re.Pattern
    laugh_hint: str
    filler_redup: frozenset[str]
    generic_phrases: frozenset[str]
    edge: frozenset[str]
    start_block: frozenset[str]
    end_block: frozenset[str]
    abbreviations: dict[str, str]
    one_char_ok: frozenset[str]
    exclamative: str | None  # palabra que abre exclamativas de dos palabras ("que bronca"); None si no hay
    badwords_base: frozenset[str]
    dow: tuple[str, ...]
    months: tuple[str, ...]
    labels: Labels
    departures: DeparturesPatterns

    def __repr__(self) -> str:
        return f"Lang({self.code!r})"

    @cached_property
    def stopwords_plain(self) -> frozenset[str]:
        """Stopwords sin acentos (la lista mezcla formas con y sin tilde)."""
        return frozenset(strip_accents(w) for w in self.stopwords)

    @cached_property
    def norm_word_re(self) -> re.Pattern:
        """Una palabra de norm_words: corridas de word_chars; con apóstrofo, solo entre caracteres de palabra."""
        chars = self.word_chars.replace("'", "")
        if "'" in self.word_chars:
            return re.compile(f"[{chars}]+(?:'[{chars}]+)*")
        return re.compile(f"[{chars}]+")

    @cached_property
    def word_char_re(self) -> re.Pattern:
        """Caracteres de palabra (sin acentos) de norm_words, apóstrofo incluido si el idioma lo tiene."""
        return re.compile(f"[{self.word_chars}]+")

    def laugh_kind(self, token: str) -> str | None:
        """Clave de la primera clase de laugh_kinds que es el token entero, o None."""
        return next((key for key, _, rx in self.laugh_kinds if rx.match(token)), None)


_CACHE: dict[str, Lang] = {}


def get_lang(code: str) -> Lang:
    """El Lang de `code` ("es" o "en"); ValueError para cualquier otro."""
    if code not in CODES:
        raise ValueError(f"idioma no soportado: {code!r} (hay {', '.join(CODES)})")
    if code not in _CACHE:
        if code == "es":
            from wa.lang import es as mod
        else:
            from wa.lang import en as mod
        _CACHE[code] = mod.LANG
    return _CACHE[code]
