"""Elenco del chat ficticio y sus hábitos (independientes del idioma) + acceso al vocabulario de cada idioma.

Los hábitos son estructura: cuánto habla cada uno, a qué hora, cómo se ríe (por "ranura" de risa, que cada idioma
traduce a sus clases), qué multimedia manda, qué palabras del lore usa y su emoji. El vocabulario (plantillas de
mensajes, muletillas, lore, encuestas, quejas, eventos) vive en synth/vocab_es.py y synth/vocab_en.py con las mismas
claves e índices: la historia elige índices y cada idioma pone las palabras.
"""
from __future__ import annotations

from dataclasses import dataclass

TITLE = "Los del Parque 🌳"
GROUP_NAMES = ("Los del Asado", "Parque y birra 🍻", TITLE)  # al crearlo, primer cambio, segundo cambio (Caro)
ME = "Ana"
DEPARTER = "Bruno"

TOPICS = ("plans", "football", "work", "food", "shows", "weather", "music", "travel", "money", "pets", "gossip",
          "health")
EVENTS = ("asado", "mundial", "cumple")  # los tres días pico; ids estructurales (el idioma pone títulos y términos)
MEDIA_TYPES = ("image", "audio", "sticker", "video", "gif", "video_note", "document", "contact", "location")
# Ranuras de risa: 0 = la clase principal del idioma (jaja / haha), 1-3 = las otras clases de palabra, 4 = xd,
# 5 = emoji. vocab.LAUGHS[slot] da las formas de cada idioma.
LAUGH_SLOTS = 6
N_LORE = 12
N_QUOTES = 3
N_POLLS = 6
N_DOCS = 10  # nombres de documento por idioma (vocab.DOCS)


def _hours(night: float = 0.04, early: float = 0.3, day: float = 1.0, evening: float = 1.6) -> tuple[float, ...]:
    """Peso por hora (0-23): madrugada 0-5, temprano 6-8, día 9-18, noche 19-23."""
    out = []
    for h in range(24):
        if h < 6:
            out.append(night * (1.0 if h < 3 else 0.3))
        elif h < 9:
            out.append(early)
        elif h < 19:
            out.append(day * (0.8 if h in (9, 15, 16) else 1.0))
        else:
            out.append(evening * (0.7 if h == 23 else 1.0))
    return tuple(out)


@dataclass(frozen=True)
class Person:
    short: str
    raw: str  # nombre de contacto tal como lo muestra el export
    nickname: str | None
    activity: float  # peso relativo de mensajes
    hours: tuple[float, ...]  # peso por hora
    laughs: tuple[float, ...]  # peso por ranura de risa (LAUGH_SLOTS)
    media_rate: float  # fracción de sus mensajes que es multimedia
    media: dict[str, float]  # peso por tipo de multimedia
    lore: tuple[int, ...]  # palabras del lore (índices de vocab.LORE) que usa más
    emoji: str  # su emoji firma
    emoji_rate: float
    style: str  # cómo escribe: proper, caps, lower, dots, bang, plain
    female: bool = False  # concordancia de las plantillas en castellano ("aburrid[o|a]")
    reply: float = 1.0  # escala de lo que tarda en responder dentro de una charla (< 1: más rápido)


PEOPLE: tuple[Person, ...] = (
    Person("Ana", "Ana Rivas", None, 1.25, _hours(), (0.8, 0.0, 0.12, 0.05, 0.0, 0.03), 0.12,
           {"image": 5, "document": 3, "audio": 1, "sticker": 1, "location": 1}, (0, 7, 11), "🙌", 0.06,
           "proper", True),
    Person("Tomi", 'Tomi "Tomate" Suárez🍅', "Tomate", 1.6, _hours(evening=1.9),
           (0.88, 0.0, 0.05, 0.04, 0.0, 0.03), 0.14,
           {"image": 4, "video": 3, "location": 2, "audio": 2, "sticker": 1}, (0, 3, 9), "🔥", 0.1, "caps", reply=0.4),
    Person("Lucas", 'Lucas "Rulo" Benítez 🌚', "Rulo", 1.0, _hours(night=0.12),
           (0.7, 0.0, 0.05, 0.2, 0.0, 0.05), 0.16,
           {"audio": 8, "image": 2, "location": 2, "video": 1}, (1, 4, 9), "🌚", 0.08, "plain", reply=1.4),
    Person("Bruno", 'Bruno "Brujo" Castro', "Brujo", 1.1, _hours(), (0.75, 0.0, 0.15, 0.05, 0.05, 0.0), 0.08,
           {"image": 2, "sticker": 2, "audio": 2, "gif": 1}, (3, 5, 10), "🙄", 0.07, "dots"),
    Person("Caro", 'Caro "Carola" Méndez👝', "Carola", 1.15, _hours(), (0.25, 0.6, 0.1, 0.0, 0.0, 0.05), 0.18,
           {"sticker": 8, "image": 3, "gif": 1, "video": 1}, (0, 2, 8), "💅", 0.12, "bang", True, reply=0.7),
    Person("Dani", 'Dani "Dandy" Ferreyra', "Dandy", 0.8,
           _hours(night=0.0, early=4.0, day=0.9, evening=0.5), (0.7, 0.0, 0.15, 0.1, 0.0, 0.05), 0.1,
           {"image": 3, "contact": 2, "location": 1, "document": 1}, (4, 7, 11), "☀️", 0.1, "proper"),
    Person("Flor", 'Flor "Flo" Paredes', "Flo", 0.95, _hours(), (0.3, 0.0, 0.05, 0.05, 0.0, 0.6), 0.15,
           {"sticker": 5, "gif": 3, "image": 2, "audio": 1}, (2, 6, 8), "😂", 0.04, "bang", True),
    Person("Nico", 'Nico "Nicolino" Sosa', "Nicolino", 0.9,
           _hours(night=2.8, early=0.02, day=0.6, evening=1.7), (0.25, 0.0, 0.05, 0.05, 0.65, 0.0), 0.1,
           {"video_note": 4, "sticker": 3, "audio": 2, "image": 1}, (1, 5, 10), "🌙", 0.08, "lower"),
    Person("Juli", 'Juli "Jules" Ortega', "Jules", 0.65, _hours(), (0.55, 0.0, 0.3, 0.1, 0.0, 0.05), 0.12,
           {"gif": 4, "image": 3, "sticker": 1}, (2, 6, 8), "✨", 0.1, "dots", True),
)
BY_SHORT = {p.short: p for p in PEOPLE}
EARLY_BIRD, NIGHT_OWL = "Dani", "Nico"
GENERAL_EMOJI = ("🔥", "🙌", "😅", "👀", "🤦", "❤️", "😍", "🥲", "👏", "🍻", "⚽", "🌳", "💪", "🤔")


def lore_owners(i: int) -> tuple[str, ...]:
    return tuple(p.short for p in PEOPLE if i in p.lore)


def vocab(lang: str):
    """Módulo de vocabulario del idioma (synth.vocab_es / synth.vocab_en)."""
    if lang == "es":
        from synth import vocab_es as mod
    elif lang == "en":
        from synth import vocab_en as mod
    else:
        raise ValueError(f"idioma no soportado: {lang!r}")
    return mod
