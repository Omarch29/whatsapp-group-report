"""Capítulo Multimedia.

- kinds: qué manda cada uno, por `kind` del parquet. `kinds` lista los tipos presentes salvo el texto, del más
  común al menos común; en byPerson, `counts` y `perMil` traen todos los tipos (texto incluido, así suman los
  mensajes de la persona).
- audios: por persona (con por mil), por hora del día y por año (todo el grupo). Sin audios en el chat (Android
  los entrega como "media"): byPerson [], byHour 24 ceros y byYear {"years": [], "n": []}.
- En Android el tipo "media" (adjunto sin tipo) entra en `kinds` como cualquier otro.
- links: URLs (`https?://...`) en el cuerpo, contadas una por URL. Dominios normalizados (normalize_domain);
  `favorite` es el dominio que más manda cada persona.
- deletedEdited: borrados (kind "deleted") y editados (columna `edited`) por persona; recordDay es el día con más
  borrados de todo el grupo (None si no hay).
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from web.common import per_mil  # noqa: E402

LINK_RE = re.compile(r"https?://[^\s]+")
SCHEME_RE = re.compile(r"^[a-z][a-z0-9+.-]*://")
HOST_END_RE = re.compile(r"[/?#:]")
# Mismo sitio con otro dominio: x.com es twitter.com, youtu.be es youtube.com y los cortos de TikTok (vm., vt.)
# son tiktok.com.
DOMAIN_ALIASES = {
    "x.com": "twitter.com",
    "youtu.be": "youtube.com",
    "vm.tiktok.com": "tiktok.com",
    "vt.tiktok.com": "tiktok.com",
}
STRIP_PREFIXES = ("www.", "m.")
DOMAINS_TOP = 20


def normalize_domain(url: str) -> str:
    """'https://www.instagram.com/p/1' -> 'instagram.com': sin esquema, sin 'www.' ni 'm.', con alias."""
    host = HOST_END_RE.split(SCHEME_RE.sub("", url.strip().lower()), maxsplit=1)[0]
    for prefix in STRIP_PREFIXES:
        if host.startswith(prefix):
            host = host[len(prefix):]
    return DOMAIN_ALIASES.get(host, host)


def _kinds(df: pd.DataFrame, slugs: dict[str, str]) -> dict:
    kind = df["kind"].astype(str)
    totals = kind[kind != "text"].value_counts()
    names = sorted(totals.index, key=lambda k: (-int(totals[k]), k))
    all_kinds = ["text", *names] if (kind == "text").any() else names
    by_person = []
    for name, s in slugs.items():
        counts = kind[df["sender"] == name].value_counts()
        n = int(counts.sum())
        if not n:
            continue
        c = {k: int(counts.get(k, 0)) for k in all_kinds}
        by_person.append({"slug": s, "counts": c, "perMil": {k: per_mil(v, n) for k, v in c.items()}})
    return {"kinds": names, "byPerson": by_person}


def _audios(df: pd.DataFrame, slugs: dict[str, str]) -> dict:
    audio = df[df["kind"].astype(str) == "audio"]
    if audio.empty:  # Android no distingue los audios (todo es "media"): vacío de la misma forma, sin años inventados
        return {"byPerson": [], "byHour": [0] * 24, "byYear": {"years": [], "n": []}}
    totals = df["sender"].value_counts()
    counts = audio["sender"].value_counts()
    by_person = [
        {"slug": s, "n": int(counts.get(name, 0)), "perMil": per_mil(int(counts.get(name, 0)), int(totals.get(name, 0)))}
        for name, s in slugs.items()
        if counts.get(name, 0)
    ]
    by_person.sort(key=lambda r: (-r["n"], r["slug"]))
    by_hour = audio["hour"].astype(int).value_counts().reindex(range(24), fill_value=0)
    ts = pd.to_datetime(df["ts"])
    years = list(range(ts.min().year, ts.max().year + 1)) if len(df) else []
    by_year = pd.to_datetime(audio["ts"]).dt.year.value_counts().reindex(years, fill_value=0)
    return {
        "byPerson": by_person,
        "byHour": [int(n) for n in by_hour],
        "byYear": {"years": [str(y) for y in years], "n": [int(n) for n in by_year]},
    }


def _links(df: pd.DataFrame, slugs: dict[str, str]) -> dict:
    per_person: dict[str, Counter] = {}
    domains: Counter = Counter()
    for sender, body in zip(df["sender"], df["body"].astype(str)):
        urls = LINK_RE.findall(body)
        if not urls:
            continue
        d = Counter(normalize_domain(u) for u in urls)
        domains.update(d)
        per_person.setdefault(sender, Counter()).update(d)
    by_person = [{"slug": s, "n": sum(per_person[name].values())} for name, s in slugs.items() if name in per_person]
    by_person.sort(key=lambda r: (-r["n"], r["slug"]))
    favorite = []
    for name, s in slugs.items():
        if name in per_person:
            domain, n = min(per_person[name].items(), key=lambda kv: (-kv[1], kv[0]))
            favorite.append({"slug": s, "domain": domain, "n": int(n)})
    top = sorted(domains.items(), key=lambda kv: (-kv[1], kv[0]))[:DOMAINS_TOP]
    return {"byPerson": by_person, "domains": [{"domain": d, "n": int(n)} for d, n in top], "favorite": favorite}


def _deleted_edited(df: pd.DataFrame, slugs: dict[str, str]) -> dict:
    deleted = df["kind"].astype(str) == "deleted"
    edited = df["edited"].astype(bool)
    by_person = []
    for name, s in slugs.items():
        mine = df["sender"] == name
        n, d, e = int(mine.sum()), int((mine & deleted).sum()), int((mine & edited).sum())
        if n:
            by_person.append({"slug": s, "deleted": d, "edited": e, "deletedPerMil": per_mil(d, n),
                              "editedPerMil": per_mil(e, n)})
    days = df.loc[deleted, "date"].astype(str).value_counts()
    record = None
    if len(days):
        date = min(days[days == days.max()].index)  # en empate, el primero
        record = {"date": date, "n": int(days[date])}
    return {"byPerson": by_person, "recordDay": record}


def build_media(df: pd.DataFrame, people: list[dict]) -> dict:
    """media.json. df = build_web_data.load_chat; people = entradas de global.json (cuentan las con perfil)."""
    from build_web_data import profiled  # import diferido (ciclo con build_web_data)

    slugs = profiled(people)
    return {
        "kinds": _kinds(df, slugs),
        "audios": _audios(df, slugs),
        "links": _links(df, slugs),
        "deletedEdited": _deleted_edited(df, slugs),
    }
