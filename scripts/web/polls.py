"""Capítulo Encuestas.

Cada encuesta (kind "poll") se lee con build_web_data.parse_poll y sale con la forma de pollSchema
({"question","options":[{"label","votes"}],"who","when","totalVotes"}).

- byPerson: encuestas por persona con perfil; total: todas (las del resto incluidas). El `who` de una encuesta de
  alguien sin perfil es "resto".
- mostVoted: top 10 por votos.
- unanimous: entre las de al menos th.poll_min_votes votos, top 10 por share de la opción ganadora (desempata: más votos).
- divided: entre las de al menos th.poll_min_votes votos y 2 opciones, top 10 por menor diferencia de votos entre la primera y la
  segunda opción (desempata: más votos).
En todos los rankings, a igualdad, la más vieja primero.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from web.common import ranked  # noqa: E402
from web.thresholds import Thresholds  # noqa: E402

TOP = 10


def _top_share(p: dict) -> float:
    return max(o["votes"] for o in p["options"]) / p["totalVotes"]


def _margin(p: dict) -> int:
    a, b = sorted((o["votes"] for o in p["options"]), reverse=True)[:2]
    return a - b


def build_polls(df: pd.DataFrame, people: list[dict], th: Thresholds) -> dict:
    """polls.json. df = build_web_data.load_chat; people = entradas de global.json (cuentan las con perfil)."""
    from build_web_data import parse_poll, profiled  # import diferido (ciclo con build_web_data)

    slugs = profiled(people)
    rows = df[df["kind"].astype(str) == "poll"].sort_values("ts", kind="stable")
    polls = []
    for sender, ts, body in zip(rows["sender"], rows["ts"], rows["body"].astype(str)):
        question, options = parse_poll(body)
        polls.append({
            "question": question,
            "options": options,
            "who": slugs.get(sender, "resto"),  # sin perfil: nunca el nombre (o el teléfono) del contacto
            "when": pd.Timestamp(ts).isoformat(),
            "totalVotes": sum(o["votes"] for o in options),
        })
    # sorted es estable: a igualdad queda el orden cronológico.
    voted = [p for p in polls if p["totalVotes"] >= th.poll_min_votes]
    return {
        "byPerson": ranked(rows["sender"].value_counts(), slugs),
        "total": len(polls),
        "mostVoted": sorted(polls, key=lambda p: -p["totalVotes"])[:TOP],
        "unanimous": sorted(voted, key=lambda p: (-_top_share(p), -p["totalVotes"]))[:TOP],
        "divided": sorted(
            (p for p in voted if len(p["options"]) >= 2), key=lambda p: (_margin(p), -p["totalVotes"])
        )[:TOP],
    }
