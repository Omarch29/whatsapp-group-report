"""Utilidades de texto: tokenización, risas y emojis. Las stopwords y la forma de las risas son del idioma del chat
(wa.lang.Lang, que se pasa a tokens e is_laugh)."""
from __future__ import annotations

import re
import unicodedata
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from wa.lang import Lang

URL_RE = re.compile(r"https?://\S+")
APOSTROPHE_RE = re.compile("[’‘ʼ]")  # apóstrofos tipográficos (iOS escribe ’): cuentan como '

# Emojis: rangos principales (sin selectores de variación ni modificadores de tono)
EMOJI_RE = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF\U00002B00-\U00002BFF\U0001F900-\U0001F9FF]"
)
SKIN_TONE_RE = re.compile("[\U0001F3FB-\U0001F3FF️‍]")


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def tokens(text: str, lang: Lang, keep_stop: bool = False) -> list[str]:
    """Palabras (lang.word_re) de 3 o más letras de `text` en minúscula, sin links, risas ni (salvo keep_stop)
    stopwords de `lang`."""
    text = APOSTROPHE_RE.sub("'", URL_RE.sub(" ", text.lower()))
    out = []
    for w in lang.word_re.findall(text):
        if lang.laugh_re.match(w):
            continue
        if not keep_stop and (w in lang.stopwords or strip_accents(w) in lang.stopwords):
            continue
        if len(w) < 3:
            continue
        out.append(w)
    return out


def emojis(text: str) -> list[str]:
    return EMOJI_RE.findall(SKIN_TONE_RE.sub("", text))


def is_laugh(text: str, lang: Lang) -> bool:
    """Todas las palabras (separadas por espacios) son risa en `lang`."""
    t = text.strip().lower()
    return bool(t) and all(lang.laugh_re.match(w) for w in t.split())
