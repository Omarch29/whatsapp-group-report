"""Umbrales de "cuánto es suficiente" del reporte: perfiles, premios, récords, frases y puteadas.

`legacy()` son los valores fijos con los que se armó el reporte original (un chat de ~1M mensajes); `derived(total)` los
escala con el tamaño del chat para que uno chico (cientos o pocos miles de mensajes) también tenga perfiles y premios.
"""
from __future__ import annotations

from dataclasses import dataclass


def clamp(x: float, lo: float, hi: float) -> int:
    return int(min(hi, max(lo, x)))


@dataclass(frozen=True)
class Thresholds:
    profile_msgs: int  # mensajes mínimos para tener perfil propio
    active_share: float  # ...y esta fracción mínima de los mensajes del chat
    fastest_min_replies: int  # respuestas mínimas para el premio al más rápido
    poll_min_votes: int  # votos mínimos para que una encuesta cuente como unánime o dividida
    signature_min_own: int  # veces mínimas que uno manda un emoji para que sea su emoji firma
    quote_min_times: int  # copias mínimas de otros para que una frase sea una cita
    funny_min_laughs: int  # risas mínimas de otros para el mensaje más gracioso de una persona
    record_min_group: int  # mensajes mínimos de una persona para tener récords propios (records)
    proper_min_n: int  # veces mínimas que se ve una palabra a mitad de oración para llamarla nombre propio

    @classmethod
    def legacy(cls) -> Thresholds:
        return cls(profile_msgs=5000, active_share=0.0, fastest_min_replies=500,
                   poll_min_votes=5, signature_min_own=20, quote_min_times=3, funny_min_laughs=4,
                   record_min_group=500, proper_min_n=30)

    @classmethod
    def derived(cls, total_msgs: int) -> Thresholds:
        big = total_msgs >= 50_000
        return cls(
            profile_msgs=200,
            active_share=0.01,
            fastest_min_replies=clamp(total_msgs / 1200, 20, 500),
            poll_min_votes=3,
            signature_min_own=clamp(total_msgs / 30000, 5, 20),
            quote_min_times=3 if big else 2,
            funny_min_laughs=4 if big else 3,
            record_min_group=clamp(total_msgs / 1200, 30, 500),
            proper_min_n=clamp(total_msgs / 20000, 8, 30),
        )
