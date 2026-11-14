"""Convierte los exports .txt de WhatsApp a un Parquet único.

Uso:
    .venv/bin/python -I scripts/build_dataset.py "_chat 2.txt:bg0" "_chat.txt:main" -o data/messages.parquet

Cada argumento es RUTA:ETIQUETA. La etiqueta identifica el chat en la columna `chat`.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wa.locales import UnknownFormat  # noqa: E402
from wa.names import GROUP, People, load_people_cli  # noqa: E402
from wa.parser import OWNER, SYSTEM_SENDER, parse_file  # noqa: E402


def build(inputs: list[tuple[str, str]], people: People) -> pd.DataFrame:
    """Un parquet con los mensajes de todos los exports (cada uno con su formato detectado). Los avisos sin firma
    (Android) quedan a nombre del grupo; el dueño ("__you__" en los eventos) es people.me, o "?" si no se sabe."""
    group = next(iter(sorted(people.group_senders)), GROUP)
    me = people.me or "?"
    rows = []
    for path, label in inputs:
        n = 0
        try:
            for m in parse_file(path):
                raw = group if m.sender == SYSTEM_SENDER else m.sender
                who = me if m.sys_who == OWNER else m.sys_who
                by = me if m.sys_by == OWNER else m.sys_by
                rows.append((label, m.ts, raw, people.canonical(raw), m.body, m.kind, m.edited, m.caption,
                             m.sys_event, who, by))
                n += 1
        except UnknownFormat as e:
            raise UnknownFormat(f"{path}: {e}") from e  # which of the exports it was
        print(f"{label}: {n:,} mensajes", file=sys.stderr)
    df = pd.DataFrame(rows, columns=["chat", "ts", "sender_raw", "sender", "body", "kind", "edited", "caption",
                                     "sys_event", "sys_who", "sys_by"])
    df["chat"] = df["chat"].astype("category")
    df["sender"] = df["sender"].astype("category")
    df["kind"] = df["kind"].astype("category")
    df["is_system"] = df["kind"].isin(["system", "pending"])
    df["date"] = df["ts"].dt.date
    df["year"] = df["ts"].dt.year.astype("int16")
    df["hour"] = df["ts"].dt.hour.astype("int8")
    df["dow"] = df["ts"].dt.day_of_week.astype("int8")  # 0 = lunes
    df["n_chars"] = df["body"].str.len().astype("int32")
    df["n_words"] = df["body"].str.split().str.len().fillna(0).astype("int32")
    df = df.sort_values(["chat", "ts"], kind="stable").reset_index(drop=True)
    df["msg_id"] = df.index.astype("int32")
    return df


def run(argv: list[str]) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+", help="RUTA:ETIQUETA")
    ap.add_argument("-o", "--output", default="data/messages.parquet")
    ap.add_argument("--people", default="content/people.json", help="nombres de contacto -> nombres cortos")
    ap.add_argument("--me", default=None, help="nombre corto del dueño del export (pisa al del archivo)")
    args = ap.parse_args(argv)
    inputs = []
    for item in args.inputs:
        path, _, label = item.rpartition(":")
        inputs.append((path, label))
    df = build(inputs, load_people_cli(args.people, me=args.me))
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(args.output, index=False)
    print(f"-> {args.output}: {len(df):,} filas", file=sys.stderr)
    print(df.groupby("chat", observed=True)["kind"].value_counts().unstack(fill_value=0).to_string(), file=sys.stderr)


def main() -> None:
    run(sys.argv[1:])


if __name__ == "__main__":
    main()
