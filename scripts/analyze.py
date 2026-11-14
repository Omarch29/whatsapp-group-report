"""Resumen compacto del chat (summary.json) para que la skill le haga preguntas al usuario.

Uso:
    .venv/bin/python -I scripts/analyze.py --data data/messages.parquet --chat main \
        --people content/people.json --me Ana [--lang es] --out data/analysis/summary.json

Corre ANTES de que existan report.config.json y content/: si --people no existe, sigue sin nombres de contacto
(sin avisar) y los remitentes quedan con su nombre crudo.
"""
from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from group_report import MENTION_RE, departure_candidates, membership, peak_days  # noqa: E402
from wa.lang import Lang, get_lang  # noqa: E402
from wa.names import GROUP, QUOTED_RE, YOU, People, load_people_cli  # noqa: E402
from wa.parser import detect_format  # noqa: E402
from wa.text import tokens  # noqa: E402
from web.thresholds import Thresholds  # noqa: E402

PEAK_DAYS = 10
TOP_TERMS = 8
BODY_CHARS = 200
# Modo recomendado (la skill lo propone): "single" por debajo de cualquiera de los dos mínimos, "full" si no.
MODE_MIN_MSGS = 20_000
MODE_MIN_ACTIVE = 5


def quoted_nickname(raw: str) -> str | None:
    m = QUOTED_RE.search(raw)
    return next(g for g in m.groups() if g) if m else None


def _people_rows(content: pd.DataFrame) -> list[dict]:
    rows = []
    for short, g in content.groupby("sender"):
        if short == GROUP:
            continue
        raws = g["sender_raw"].str.strip()
        named = raws[~raws.isin(YOU)]  # "Tú" es el dueño visto desde su propio export: mejor su nombre de contacto
        raw = (named if len(named) else raws).mode().iloc[0]
        rows.append({"raw": raw, "short": short, "msgs": len(g), "first": g["ts"].min().date().isoformat(),
                     "last": g["ts"].max().date().isoformat(), "quoted_nickname": quoted_nickname(raw)})
    return sorted(rows, key=lambda p: (-p["msgs"], p["short"]))


def recommend_mode(msgs: int, active: int) -> str:
    """"single" (una sola página) para un chat chico o con pocos activos; "full" (capítulos) si no."""
    return "single" if msgs < MODE_MIN_MSGS or active < MODE_MIN_ACTIVE else "full"


def _top_terms(texts: pd.Series, lang: Lang) -> list[str]:
    counts: collections.Counter = collections.Counter()
    for body in texts:
        counts.update(tokens(MENTION_RE.sub("", body), lang))
    return [w for w, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_TERMS]]


def _sample(texts: pd.DataFrame, n: int, seed: int) -> list[dict]:
    """Hasta n mensajes de texto, proporcionales a los de cada año (al menos 1 por año), en orden cronológico."""
    per_year = texts.groupby("year").size()
    if per_year.empty:
        return []
    share = {y: n * c / per_year.sum() for y, c in per_year.items()}
    alloc = {y: min(c, max(1, int(share[y]))) for y, c in per_year.items()}
    while sum(alloc.values()) > n and max(alloc.values()) > 1:
        alloc[max(alloc, key=alloc.get)] -= 1  # el mínimo de 1 por año no puede pasarse del total pedido
    while sum(alloc.values()) < n and any(alloc[y] < per_year[y] for y in alloc):
        alloc[max((y for y in alloc if alloc[y] < per_year[y]), key=lambda y: share[y] - alloc[y])] += 1  # resto mayor
    picked = pd.concat([g.sample(alloc[y], random_state=seed) for y, g in texts.groupby("year")])
    picked = picked.sort_index().sort_values("ts", kind="stable").head(n)  # same minute: chat order
    return [{"ts": r.ts.isoformat(), "short": r.sender, "body": r.body[:BODY_CHARS]} for r in picked.itertuples()]


def summarize(df: pd.DataFrame, people: People, lang: Lang, sample_n: int = 300, seed: int = 7,
              source: str | None = None) -> dict:
    """df: las filas de UN chat (salida de build_dataset). lang: wa.lang.Lang (las palabras de los días pico).
    source: ruta del .txt, para detectar plataforma, idioma y orden de fecha ("locale" queda en None sin él)."""
    df = df.sort_values("ts", kind="stable").reset_index(drop=True)  # same minute: chat order
    df["sender"] = df["sender_raw"].map(people.canonical)  # con las personas de ahora, no las del momento de armar el parquet
    system = df[df["kind"] == "system"]
    content = df[~df["kind"].isin(["system", "pending"])]
    raws = df["sender_raw"].str.strip()
    speakers = set(content["sender_raw"].str.strip())
    # GROUP: los avisos sin firma de Android, cuando todavía no se sabe el nombre del grupo
    group_names = sorted(set(system["sender_raw"].str.strip()) - speakers - set(YOU) - set(people.names) - {GROUP})
    me_candidates = list(dict.fromkeys(people.canonical(r) for r in raws.unique() if r in YOU))
    first, last = df["ts"].min(), df["ts"].max()
    texts = df[df["kind"] == "text"]
    peaks = [
        {"date": p["date"], "msgs": p["msgs"], "top_terms": _top_terms(texts[texts["date"].astype(str) == p["date"]]["body"], lang)}
        for p in peak_days(df, lang, PEAK_DAYS)
    ]
    people_rows = _people_rows(content)
    # activos: los que llegan a la fracción mínima de los mensajes que pide un perfil (Thresholds.derived)
    th = Thresholds.derived(len(content))
    active = sum(p["msgs"] >= th.active_share * len(content) for p in people_rows)
    # con perfil: los que además llegan a los mensajes mínimos (lo que exige build_web_data.build_global)
    profiled = sum(p["msgs"] >= th.profile_msgs and p["msgs"] >= th.active_share * len(content) for p in people_rows)
    return {
        "locale": detect_format(source) if source else None,
        "size": {"msgs": len(content), "days": (last.normalize() - first.normalize()).days + 1,
                 "from": first.date().isoformat(), "to": last.date().isoformat()},
        "group_names": group_names,
        "me_candidates": me_candidates,
        "people": people_rows,
        "departure_candidates": [{"short": s, "reentries": n} for s, n in departure_candidates(membership(df, people, lang))],
        "has_polls": bool((df["kind"] == "poll").any()),
        "peak_days": peaks,
        "sample": _sample(texts, sample_n, seed),
        "active_people": active,
        "profiled_people": profiled,
        "recommended_mode": recommend_mode(len(content), active),
    }


def run(argv: list[str]) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/messages.parquet")
    ap.add_argument("--chat", default="main")
    ap.add_argument("--people", default="content/people.json")
    ap.add_argument("--me", default=None, help="nombre corto del dueño del export (pisa al de --people)")
    ap.add_argument("--source", default=None, help="ruta del .txt original, para detectar plataforma e idioma")
    ap.add_argument("--lang", choices=["es", "en"], default="es", help="idioma del chat (wa.lang)")
    ap.add_argument("--out", default="data/analysis/summary.json")
    args = ap.parse_args(argv)
    df = pd.read_parquet(args.data)
    df = df[df["chat"] == args.chat]
    if df.empty:
        raise SystemExit(f"no hay mensajes del chat '{args.chat}' en {args.data}")
    summary = summarize(df, load_people_cli(args.people, me=args.me, quiet=True), get_lang(args.lang), source=args.source)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"-> {out}", file=sys.stderr)


def main() -> None:
    run(sys.argv[1:])


if __name__ == "__main__":
    main()
