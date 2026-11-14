"""Fondo de comparación para el lore y las frases hechas: chats `background` si los hay, si no la frecuencia de la lengua."""
from __future__ import annotations

import re
from collections import Counter
from functools import lru_cache

import wordfreq
from wa.lang import get_lang
from wa.text import strip_accents

COMMON_ZIPF = 3.5  # escala Zipf de wordfreq: >= 3.5 es una palabra de uso corriente (aprox. una cada 300 mil palabras)
BACKGROUND_USES = 3  # con chats de fondo, una palabra dicha tantas veces allí ya no es del grupo


ELONGATION_RE = re.compile(r"(.)\1{2,}")  # la misma letra 3 o más veces seguidas: "nooo", "holaaa"


@lru_cache(maxsize=None)
def word_is_common(word: str, lang: str) -> bool:
    """`lang` es un código de wordfreq ("es" o "en")."""
    return wordfreq.zipf_frequency(word, lang) >= COMMON_ZIPF


def _is_common_any_accent(word: str, lang: str) -> bool:
    """Común con o sin tilde: "esta" sin tilde cuenta como "está"; la forma con tilde sigue valiendo por sí sola."""
    return word_is_common(word, lang) or word_is_common(strip_accents(word), lang)


def lore_filter(counter: Counter, lang: str, bg_counter: Counter | None) -> Counter:
    """Deja las palabras de `counter` propias del grupo. Nunca entran las elongaciones ("nooo") ni las risas de la
    lengua ("jajaj", laugh_re). Con `bg_counter` (los chats de fondo), las que ahí aparecen menos de BACKGROUND_USES
    veces; sin él, las que no son de uso corriente en la lengua, con o sin acentos."""
    laugh = get_lang(lang).laugh_re
    own = {w: n for w, n in counter.items() if not ELONGATION_RE.search(w) and not laugh.match(w)}
    if bg_counter is None:
        return Counter({w: n for w, n in own.items() if not _is_common_any_accent(w, lang)})
    return Counter({w: n for w, n in own.items() if bg_counter[w] < BACKGROUND_USES})
