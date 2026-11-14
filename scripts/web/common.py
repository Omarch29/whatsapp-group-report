"""Helpers compartidos por los módulos de capítulos (scripts/web/*.py).

No importa nada de build_web_data (evita el ciclo): quien necesite limpiar texto pasa su `text_fn` (o usa export_text,
si el cuerpo ya pasó por build_web_data.clean_text).
"""
from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path
from typing import TYPE_CHECKING, Callable

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wa.slugs import slug  # noqa: E402
from wa.text import APOSTROPHE_RE, EMOJI_RE, SKIN_TONE_RE, URL_RE, strip_accents  # noqa: E402

if TYPE_CHECKING:
    from wa.lang import Lang
    from wa.names import People

# Menciones: @⁨Nombre⁩ y el ⁨Nombre⁩ suelto (U+2068 ... U+2069).
MENTION_TOKEN_RE = re.compile("@?⁨[^⁩]*⁩")
MENTION_RE = re.compile("@⁨([^⁩]*)⁩")  # iOS: @⁨Nombre de contacto⁩; el grupo es el nombre crudo
ISOLATE = "\u2068"  # iOS envuelve cada mención en U+2068/U+2069; Android no
INVISIBLE_RE = re.compile("[\u200e\u2068\u2069]")  # LRM y las marcas de aislamiento de las menciones
EXPORT_HEADER_RE = re.compile(r"\n\[\d{1,2}/\d{1,2}/\d{2,4},")


class PlainMentions:
    """Menciones sin aisladores (Android), con el regex armado una sola vez. Un token es `@` + (a) un nombre de
    contacto crudo o corto de `people` (el más largo primero, sin distinguir mayúsculas, límite de palabra al final,
    más los apodos entre comillas y apellidos de contacto que le sigan: '@Lucas "Rulo" Benítez'), (b) un número de teléfono (tira de 6+ caracteres de
    [0-9()+-./ ] con 6+ dígitos) o (c) cualquier otro nombre (una palabra y las que sigan con mayúscula o entre
    comillas: '@Juan "Pepe" Perez'). Solo (a) es una mención conocida. Los espacios de los nombres aceptan también el espacio duro.
    Límite conocido: un ajeno en minúscula tras la primera palabra ("@juan perez") deja "perez" a la vista."""

    def __init__(self, people: People):
        self.by_name = {n.lower(): short for n, short in [*people.names.items(), *((x, x) for x in people.short_names())]}
        names = "|".join(_spaced(n) for n in sorted(self.by_name, key=len, reverse=True)) or "(?!)"
        surnames = "|".join(_spaced(n) for n in sorted(people.contact_surnames(), key=len, reverse=True))
        quoted = r'["“][^"“”\n]{1,40}["”]'  # el apodo entre comillas de un nombre de contacto: '"Rulo"'
        tail = rf"(?:\s+(?:{quoted}|(?i:{surnames})(?!\w)))*" if surnames else rf"(?:\s+{quoted})*"
        phone = "[0-9()+\\-./ \xa0]"
        self.regex = re.compile(
            rf"(?<!\w)@(?:(?P<known>(?i:{names}))(?!\w){tail}"
            rf"|(?P<phone>(?=(?:[()+\-./ \xa0]*\d){{6}}){phone}{{6,}}(?<![ \xa0]))"
            rf"|\w+(?:\s+(?:[A-ZÁÉÍÓÚÜÑ]\w*|{quoted}))*)"
        )

    def find(self, raw: str) -> set[str]:
        """Nombres cortos de las menciones conocidas de `raw`, sin repetir."""
        return {self.by_name[m.group("known").lower().replace("\xa0", " ")] for m in self.regex.finditer(raw)
                if m.group("known")}

    def redact(self, raw: str, unknown: str) -> str:
        """Menciones conocidas en nombre corto; teléfonos y todo otro @nombre (o apodo) como `unknown`."""
        def sub(m) -> str:
            known = m.group("known")
            return self.by_name[known.lower().replace("\xa0", " ")] if known else unknown

        return self.regex.sub(sub, raw) if "@" in raw else raw


def _spaced(name: str) -> str:
    return re.escape(name).replace("\\ ", "[ \xa0]")


_PLAIN: dict[int, tuple[People, PlainMentions]] = {}


def plain_mentions_of(people: People) -> PlainMentions:
    """El PlainMentions de `people`, armado una vez por objeto (el regex es caro y clean_text corre por mensaje)."""
    hit = _PLAIN.get(id(people))
    if hit is None or hit[0] is not people:
        hit = _PLAIN[id(people)] = (people, PlainMentions(people))
    return hit[1]


def has_isolates(bodies) -> bool:
    """¿El chat es un export iOS (alguna mención envuelta en U+2068)? Se decide una vez por chat, con sus cuerpos
    crudos: en un export iOS un "@Bruno" suelto es texto, no una mención."""
    return any(ISOLATE in str(b) for b in bodies)


def redact_mentions(text: str, people: People, lang: Lang, isolates: bool) -> str:
    """Las menciones de `text` sin nombres completos ni teléfonos. iOS (`isolates`): cada @⁨Nombre⁩ es el nombre
    corto de su contacto (People.canonical) si es alguien de `people` y lang.labels.unknown_mention si no. Android:
    PlainMentions (conocidos en nombre corto, todo otro @token como unknown_mention)."""
    unknown = lang.labels.unknown_mention
    if not isolates:
        return plain_mentions_of(people).redact(text, unknown)
    known = people.short_names() | ({people.me} if people.me else set())

    def name(m) -> str:
        short = people.canonical(m.group(1).replace("\xa0", " "))
        return short if short in known else unknown

    return MENTION_RE.sub(name, text)


def per_mil(n: int, total: int) -> float:
    """n por cada 1.000 de `total`, a un decimal; 0.0 si total es 0."""
    return round(1000 * n / total, 1) if total else 0.0


def ranked(series: pd.Series, slugs: dict[str, str], top: int | None = None) -> list[dict]:
    """[{"slug","n"}] de mayor a menor (empates por slug), solo nombres con perfil."""
    rows = [{"slug": slugs[name], "n": int(n)} for name, n in series.items() if name in slugs]
    rows.sort(key=lambda r: (-r["n"], r["slug"]))
    return rows[:top]


def ranked_per_mil(counts: pd.Series, totals: pd.Series, slugs: dict[str, str], min_msgs: int) -> list[dict]:
    """[{"slug","n","perMil"}] ordenado por perMil desc; solo con perfil y al menos `min_msgs` mensajes en `totals`."""
    rows = [
        {"slug": slugs[name], "n": int(n), "perMil": per_mil(int(n), int(totals.get(name, 0)))}
        for name, n in counts.items()
        if name in slugs and totals.get(name, 0) >= min_msgs
    ]
    rows.sort(key=lambda r: (-r["perMil"], -r["n"], r["slug"]))
    return rows


def _clean(s: str) -> str:
    """Sin URLs, menciones ni emojis, y con los apóstrofos tipográficos como '."""
    s = URL_RE.sub(" ", s)
    s = MENTION_TOKEN_RE.sub(" ", s)
    s = EMOJI_RE.sub(" ", SKIN_TONE_RE.sub("", s))
    return APOSTROPHE_RE.sub("'", s)


def norm_words(text: str, lang: Lang) -> list[str]:
    """Minúscula, sin acentos (la ñ se conserva), sin URLs, menciones ni emojis; las palabras son corridas de
    lang.word_chars ([a-z0-9ñ]; en inglés el apóstrofo también, solo entre letras: "don't"), lo demás separa."""
    return lang.norm_word_re.findall(_clean(strip_accents_keep_enie(text.lower())))


SURFACE_APOSTROPHE_RE = re.compile(r"[^\s']+(?:'[^\s']+)*")


def surface_words(text: str, lang: Lang) -> list[str] | None:
    """Las mismas palabras que norm_words(text, lang), una por una, pero como se escribieron: en minúscula y con
    acentos ("Qué ilusión" -> ["qué", "ilusión"]). None si no se alinean con norm_words (caso raro: caracteres que el
    sacado de acentos parte o junta distinto); quien llama usa entonces la forma normalizada."""
    s = _clean(text.lower())
    kept = []
    for c in s:
        n = strip_accents_keep_enie(c)
        kept.append(c if n == "" or lang.word_char_re.fullmatch(n) else " ")
    joined = "".join(kept)
    raw = SURFACE_APOSTROPHE_RE.findall(joined) if "'" in lang.word_chars else joined.split()
    words = [unicodedata.normalize("NFC", w) for w in raw]
    if [strip_accents_keep_enie(w) for w in words] != norm_words(text, lang):
        return None
    return words


def strip_accents_keep_enie(s: str) -> str:
    """strip_accents, pero la ñ sobrevive (NFD la parte en n + tilde combinante)."""
    return "ñ".join(strip_accents(part) for part in s.split("ñ"))


def export_text(s: str) -> str:
    """Texto de un cuerpo que ya pasó por clean_text (load_chat): sin marcas invisibles y cortado en el primer
    encabezado de export pegado ('\\n[14/3/25, 6:12...] Nombre:'). build_web_data.web_text = clean_text + esto."""
    return EXPORT_HEADER_RE.split(INVISIBLE_RE.sub("", s), maxsplit=1)[0]


def msg_ref(row, slugs: dict[str, str], text_fn: Callable[[str], str]) -> dict:
    """Referencia a un mensaje para el JSON: {"who": slug, "when": iso, "text": text_fn(body)}.

    `text_fn` es el limpiador de texto (build_web_data.web_text); se recibe por parámetro para no importar
    build_web_data desde aquí.
    """
    return {
        "who": slugs.get(row["sender"], slug(row["sender"])),
        "when": pd.Timestamp(row["ts"]).isoformat(),
        "text": text_fn(str(row["body"])),
    }
