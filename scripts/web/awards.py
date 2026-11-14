"""Capítulo Premios: doce premios, en el orden del spec (once con resolución de minutos: sin segundos, "el más
rápido" no distingue a nadie y no se entrega). Los valores salen de los JSON de los otros capítulos ya
construidos (global, language, media, mentions, rhythm), salvo la muletilla del año (ver abajo); el madrugador y
el búho necesitan el ranking entero, que
census.json no trae (solo el ganador), y se calculan de df con las mismas franjas de census (EARLY_HOURS 6-9 h,
OWL_HOURS 0-6 h), en porcentaje de los mensajes de cada uno con un decimal.

Elegibles: solo personas con perfil y con valor mayor que 0 (un premio con 0 no se entrega). El más rápido además
pide al menos th.fastest_min_replies respuestas y gana la mediana más baja. Ganador = el primero (empates por slug);
runnersUp = los dos siguientes, o menos si no hay tantos elegibles; sin elegibles, winner es None y runnersUp [].

La muletilla del año: web.language.muletillas sobre los mensajes de los últimos YEAR_MONTHS meses del export (desde
period.to menos 12 meses, inclusive; todas las personas cuentan para el resto; muletillas ya aplica el piso de
score). De cada persona, su frase de mayor razón; gana la mayor razón y los finalistas siguen por razón (los valores
mostrados bajan), value = ratio (unit "x"), text = frase, y los finalistas también llevan `text`. Sin ninguna frase en la ventana, winner None y runnersUp [].
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from web.census import EARLY_HOURS, OWL_HOURS  # noqa: E402
from wa.lang import Lang  # noqa: E402
from wa.names import People  # noqa: E402
from web.language import muletillas  # noqa: E402
from web.thresholds import Thresholds  # noqa: E402

RUNNERS_UP = 2
YEAR_MONTHS = 12


def awards_table(th: Thresholds, lang: Lang, time_resolution: str = "second") -> list[tuple[str, str, str, str | tuple[str, str]]]:
    """(id, título, criterio, unidad) de cada premio (unidad: texto o (singular, plural)) en el idioma de `lang` (wa.lang: labels.awards); el criterio del
    más rápido cita el mínimo real de th. Con time_resolution "minute" (Android) no hay premio al más rápido."""
    table = lang.labels.awards(th)
    return [a for a in table if a[0] != "fastest"] if time_resolution == "minute" else table


def _shares(df: pd.DataFrame, slugs: dict[str, str], hours: range) -> list[tuple[str, float]]:
    out = []
    for name, s in slugs.items():
        h = df.loc[df["sender"] == name, "hour"]
        if len(h):
            out.append((s, round(100 * float(h.isin(hours).mean()), 1)))
    return out


def _muletilla(df: pd.DataFrame, slugs: dict[str, str], end: str, people_names: People, th: Thresholds,
               lang: Lang) -> list[tuple]:
    """[(slug, ratio, frase)]: la frase de mayor razón de cada persona en el último año del export, como la escribe
    (`display`, con acentos)."""
    since = pd.Timestamp(end) - pd.DateOffset(months=YEAR_MONTHS)
    year = muletillas(df[pd.to_datetime(df["ts"]) >= since], slugs, people_names, th, lang)
    out = []
    for s, ms in year.items():
        if ms:
            best = max(ms, key=lambda m: m["ratio"])  # en empate, la de mayor score (primera en el orden de language)
            out.append((s, best["ratio"], best["display"]))
    return out


def _award(aid: str, title: str, criterion: str, unit: str | tuple[str, str], cands: list[tuple],
           lowest: bool = False) -> dict:
    """cands = [(slug, value)] o [(slug, value, text)]: con text, ganador y finalistas lo llevan. unit: texto, o
    (singular, plural) y entonces el ganador lleva el singular si su valor es 1 (winner.unit siempre es un texto)."""
    cands = [c for c in cands if c[1] > 0]
    cands.sort(key=lambda c: (c[1] if lowest else -c[1], c[0]))

    def entry(c: tuple, **unit_) -> dict:
        return {"slug": c[0], "value": c[1], **unit_, **({"text": c[2]} if len(c) > 2 else {})}

    if isinstance(unit, tuple):
        unit = unit[0] if cands and cands[0][1] == 1 else unit[1]
    winner = entry(cands[0], unit=unit) if cands else None
    return {
        "id": aid,
        "title": title,
        "criterion": criterion,
        "winner": winner,
        "runnersUp": [entry(c) for c in cands[1:1 + RUNNERS_UP]],
    }


def build_awards(df: pd.DataFrame, global_: dict, language: dict, census: dict, media: dict, mentions: dict,
                 rhythm: dict, people_names: People, th: Thresholds, lang: Lang,
                 time_resolution: str = "second") -> list[dict]:
    """awards.json. df = build_web_data.load_chat (madrugador, búho y muletilla del año); el resto, los dicts ya
    construidos de global.json, language.json, census.json, media.json, mentions.json y rhythm.json. census no se lee
    (trae solo los ganadores de madrugador y búho); queda en la firma junto a los demás capítulos. people_names =
    wa.names.People (la muletilla del año descarta nombres y apodos); th, los umbrales del reporte; lang (wa.lang), el
    idioma de títulos, criterios y unidades, y de las muletillas; time_resolution, global.json timeResolution
    (awards_table)."""
    from build_web_data import profiled  # import diferido (ciclo con build_web_data)

    slugs = profiled(global_["people"])
    mine = set(slugs.values())
    people = [p for p in global_["people"] if p["slug"] in mine]
    de = media["deletedEdited"]["byPerson"]
    received = [sum(col) for col in zip(*mentions["matrix"])] or [0] * len(mentions["slugs"])
    cands = {
        "msgs": [(p["slug"], p["msgs"]) for p in people],
        "stickers": [(p["slug"], p["stickers"]) for p in people],
        "audios": [(p["slug"], p["audios"]) for p in people],
        "badwords": [(r["slug"], r["perMil"]) for r in language["badwords"]["byPerson"] if r["slug"] in mine],
        "early": _shares(df, slugs, EARLY_HOURS),
        "owl": _shares(df, slugs, OWL_HOURS),
        "mentioned": [(s, int(n)) for s, n in zip(mentions["slugs"], received) if s in mine],
        "fastest": [(r["slug"], r["medianFromSec"]) for r in rhythm["latency"]
                    if r["slug"] in mine and r["n"] >= th.fastest_min_replies],
        "edited": [(r["slug"], r["editedPerMil"]) for r in de if r["slug"] in mine],
        "deleted": [(r["slug"], r["deletedPerMil"]) for r in de if r["slug"] in mine],
        "muletilla": _muletilla(df, slugs, global_["period"]["to"], people_names, th, lang),
        "starters": [(r["slug"], r["n"]) for r in rhythm["starters"] if r["slug"] in mine],
    }
    return [_award(aid, title, criterion, unit, cands[aid], lowest=aid == "fastest")
            for aid, title, criterion, unit in awards_table(th, lang, time_resolution)]


def fastest_winner(awards: list[dict]) -> dict | None:
    """{"slug","medianFromSec"} del ganador del premio al más rápido (la regla de th.fastest_min_replies vive en el
    premio), o None; para facts.json."""
    w = next((a["winner"] for a in awards if a["id"] == "fastest"), None)
    return None if w is None else {"slug": w["slug"], "medianFromSec": w["value"]}
