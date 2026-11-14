"""Capítulo Menciones.

Una mención es un token @⁨Nombre de contacto⁩ del cuerpo crudo del export. load_chat ya los reemplaza por el nombre
corto (clean_text), así que se leen del cuerpo sin limpiar (build_web_data.raw_bodies, alineado por msg_id). El
nombre pasa por People.canonical (con el espacio duro normalizado, como clean_text) y cuenta si es de alguien con
perfil. Se cuenta una vez por (mensaje, destinatario): etiquetar dos veces al mismo en un mensaje es una mención.
Las menciones a uno mismo y las que manda alguien sin perfil no cuentan.

- slugs: personas con perfil, en el orden de global.json; matrix[i][j] = menciones de slugs[i] a slugs[j]
  (diagonal en 0).
- mostMentioned: mayor suma de columna; topTagger: mayor suma de fila (empates por slug); None si nadie mencionó a
  nadie.
- perMil: menciones hechas (las de la matriz) cada 1.000 mensajes propios, de mayor a menor.
- samples: "deSlug>aSlug" -> hasta SAMPLES mensajes, el más reciente primero, {"when","text"} con text =
  export_text del cuerpo crudo recortado a SAMPLE_CHARS, con cada mención de un contacto conocido (clave de
  People.names) en nombre corto y las demás (números de teléfono, nombres completos de gente de afuera) como
  lang.labels.unknown_mention ("@alguien" / "@someone"). Solo pares con al menos una mención.

Android no envuelve las menciones en aisladores: si ningún cuerpo del chat trae U+2068 se leen como texto plano
(plain_mentions, web.common.PlainMentions): `@` + nombre de contacto crudo o corto de People (más sus apellidos), sin
apodos. En las muestras (y en todo texto publicado: build_web_data.clean_text usa el mismo web.common.redact_mentions),
los teléfonos y todo otro `@nombre` (con las palabras en mayúscula que le sigan) salen como unknown_mention.
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wa.lang import Lang  # noqa: E402
from wa.names import People  # noqa: E402
from web.common import (  # noqa: E402
    MENTION_RE, export_text, has_isolates, per_mil, plain_mentions_of, redact_mentions,
)

SAMPLES = 3
SAMPLE_CHARS = 300


def mentioned(raw: str, people: People) -> set[str]:
    """Nombres cortos (canonical) de los @⁨…⁩ de un cuerpo crudo, sin repetir."""
    return {people.canonical(m.replace("\xa0", " ")) for m in MENTION_RE.findall(raw)}


def plain_mentions(raw: str, people: People) -> set[str]:
    """Nombres cortos de los @Nombre de un cuerpo sin aisladores (Android): un @ seguido de un nombre de contacto
    crudo o corto de `people`. Los apodos no cuentan."""
    return plain_mentions_of(people).find(raw)


def sample_text(raw: str, people: People, lang: Lang, isolates: bool = True) -> str:
    """Texto de una muestra: menciones conocidas en nombre corto, las demás como lang.labels.unknown_mention
    (web.common.redact_mentions); después export_text, recortado a SAMPLE_CHARS."""
    return export_text(redact_mentions(raw, people, lang, isolates))[:SAMPLE_CHARS]


def _top(sums: list[int], slugs: list[str]) -> dict | None:
    best = min(range(len(slugs)), key=lambda i: (-sums[i], slugs[i]), default=None)
    return None if best is None or not sums[best] else {"slug": slugs[best], "n": int(sums[best])}


def build_mentions(df: pd.DataFrame, people_list: list[dict], raw: pd.Series, people: People, lang: Lang) -> dict:
    """mentions.json. df = build_web_data.load_chat; people_list = entradas de global.json (cuentan las con perfil);
    raw = cuerpos sin limpiar alineados a df.index (build_web_data.raw_bodies); people = wa.names.People; lang =
    wa.lang.Lang (la etiqueta de las menciones a desconocidos)."""
    from build_web_data import profiled  # import diferido (ciclo con build_web_data)

    slugs = profiled(people_list)
    order = list(slugs.values())
    idx = {name: i for i, name in enumerate(slugs)}
    matrix = [[0] * len(order) for _ in order]
    hits: dict[str, list[tuple]] = defaultdict(list)
    bodies = raw.astype(str)
    # Un solo formato por chat: iOS envuelve cada mención en U+2068/U+2069, Android no. Si algún cuerpo trae un
    # aislador es un export iOS y el texto plano no cuenta (un "@Bruno" suelto ahí es texto, no una mención).
    isolates = has_isolates(bodies)
    find = (lambda body: mentioned(body, people)) if isolates else plain_mentions_of(people).find
    has = bodies.str.contains("@⁨" if isolates else "@", regex=False)
    for i in df.index[has.reindex(df.index, fill_value=False).to_numpy()]:
        sender = df.at[i, "sender"]
        if sender not in idx:
            continue
        for target in find(str(raw[i])):
            if target in idx and target != sender:
                matrix[idx[sender]][idx[target]] += 1
                hits[f"{slugs[sender]}>{slugs[target]}"].append((pd.Timestamp(df.at[i, "ts"]), i))

    samples = {}
    for key, rows in sorted(hits.items()):  # orden fijo: mentioned() devuelve un set (orden por hash)
        rows.sort(key=lambda r: r[0], reverse=True)
        samples[key] = [{"when": ts.isoformat(), "text": sample_text(str(raw[i]), people, lang, isolates)}
                        for ts, i in rows[:SAMPLES]]

    made = [sum(row) for row in matrix]
    received = [sum(col) for col in zip(*matrix)]
    totals = df["sender"].value_counts()
    per = [{"slug": s, "n": made[k], "perMil": per_mil(made[k], int(totals.get(name, 0)))}
           for k, (name, s) in enumerate(slugs.items())]
    per.sort(key=lambda r: (-r["perMil"], -r["n"], r["slug"]))
    return {
        "slugs": order,
        "matrix": matrix,
        "mostMentioned": _top(received, order),
        "topTagger": _top(made, order),
        "perMil": per,
        "samples": samples,
    }
