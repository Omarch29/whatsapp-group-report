"""Buscador de mensajes con contexto.

Uso:
    .venv/bin/python -I scripts/search.py "mi vieja" --sender Ana --context 2 --limit 40
    .venv/bin/python -I scripts/search.py "cumple" --sender Ana --year 2019 --kind text
    .venv/bin/python -I scripts/search.py "Ana" --not-sender Ana --sample 30   # qué dicen de mí
"""
from __future__ import annotations

import argparse

import pandas as pd


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pattern", help="regex (case-insensitive)")
    ap.add_argument("--data", default="data/messages.parquet")
    ap.add_argument("--sender")
    ap.add_argument("--not-sender")
    ap.add_argument("--chat")
    ap.add_argument("--year", type=int)
    ap.add_argument("--kind", default="text")
    ap.add_argument("--context", type=int, default=0, help="mensajes antes/después")
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--sample", type=int, default=0, help="muestra aleatoria en vez de los primeros N")
    ap.add_argument("--count-only", action="store_true")
    ap.add_argument("--by-year", action="store_true")
    args = ap.parse_args()

    df = pd.read_parquet(args.data)
    df["sender"] = df["sender"].astype(str)
    mask = df["body"].str.contains(args.pattern, case=False, regex=True, na=False)
    if args.kind and args.kind != "any":
        mask &= df["kind"] == args.kind
    if args.sender:
        mask &= df["sender"] == args.sender
    if args.not_sender:
        mask &= df["sender"] != args.not_sender
    if args.chat:
        mask &= df["chat"] == args.chat
    if args.year:
        mask &= df["year"] == args.year
    hits = df[mask]
    print(f"# {len(hits):,} coincidencias")
    if args.by_year:
        print(hits.groupby("year").size().to_string())
    if args.count_only:
        print(hits["sender"].value_counts().head(15).to_string())
        return
    if args.sample and len(hits) > args.sample:
        hits = hits.sample(args.sample, random_state=7).sort_values("ts", kind="stable")
    else:
        hits = hits.head(args.limit)
    for idx in hits.index:
        lo, hi = max(0, idx - args.context), idx + args.context
        block = df.loc[lo:hi]
        print("---")
        for i, r in block.iterrows():
            mark = ">>" if i == idx else "  "
            body = r["body"].replace("\n", " ⏎ ")
            if r["kind"] != "text":
                body = f"[{r['kind']}] {body}"
            print(f"{mark} {r['ts']:%Y-%m-%d %H:%M} {r['chat']:<6} {r['sender']:<10} {body[:300]}")


if __name__ == "__main__":
    main()
