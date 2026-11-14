"""Récords del grupo: cada métrica agregada acompañada del caso concreto (quién, cuándo, qué dijo).

Uso:
    .venv/bin/python -I scripts/records.py [--chat main] [--out data/analysis] [--lang es]
Genera records.json y records.md.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wa.lang import get_lang  # noqa: E402
from wa.text import is_laugh  # noqa: E402
from web.thresholds import Thresholds  # noqa: E402

SKIP = {"Meta AI", "__grupo__"}


def msg(r) -> dict:
    return {"who": r["sender"], "when": str(r["ts"]), "text": str(r["body"])[:600], "chars": int(r["n_chars"])}


def run(argv: list[str]) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/messages.parquet")
    ap.add_argument("--chat", default="main")
    ap.add_argument("--out", default="data/analysis")
    ap.add_argument("--thresholds", choices=["derived", "legacy"], default="derived",
                    help="derived: umbrales según el tamaño del chat; legacy: los valores fijos del reporte original")
    ap.add_argument("--lang", choices=["es", "en"], default="es", help="idioma del chat (qué es una risa; wa.lang)")
    args = ap.parse_args(argv)
    lang = get_lang(args.lang)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    df = pd.read_parquet(args.data)
    df = df[(df["chat"] == args.chat) & (~df["is_system"])].sort_values("ts", kind="stable").reset_index(drop=True)
    df["sender"] = df["sender"].astype(str)
    df = df[~df["sender"].isin(SKIP)].reset_index(drop=True)
    th = Thresholds.legacy() if args.thresholds == "legacy" else Thresholds.derived(len(df))
    t = df[df["kind"] == "text"]
    R: dict = {}

    # Largo de mensaje
    longest = t.loc[t["n_chars"].idxmax()]
    R["message_length"] = {
        "avg_chars_group": round(float(t["n_chars"].mean()), 1),
        "avg_chars_by_person": t.groupby("sender")["n_chars"].mean().round(1).sort_values(ascending=False, kind="stable").to_dict(),
        "record": msg(longest),
        "record_by_person": {
            s: msg(g.loc[g["n_chars"].idxmax()]) for s, g in t.groupby("sender") if len(g) > th.record_min_group // 5
        },
    }

    # Mensajes por día
    daily = df.groupby("date").size()
    top_day = daily.idxmax()
    R["messages_per_day"] = {
        "avg_group": round(float(daily.mean()), 1),
        "record": {"date": str(top_day), "msgs": int(daily.max()), "by": df[df["date"] == top_day]["sender"].value_counts().head(5).to_dict()},
        "record_by_person": {},
    }
    for s, g in df.groupby("sender"):
        if len(g) < th.record_min_group:
            continue
        d = g.groupby("date").size()
        R["messages_per_day"]["record_by_person"][s] = {"date": str(d.idxmax()), "msgs": int(d.max()), "avg_active_day": round(float(d.mean()), 1)}

    # Rachas y silencios
    streaks = {}
    for s, g in df.groupby("sender"):
        if len(g) < th.record_min_group:
            continue
        days = pd.to_datetime(pd.Series(sorted(g["date"].unique())))
        gaps = days.diff().dt.days.fillna(1)
        sid = (gaps > 1).cumsum()
        # tie on length: the earliest streak wins (streaks are built in date order and the sort is stable)
        st = days.groupby(sid).agg(["min", "max", "count"]).sort_values("count", ascending=False, kind="stable").iloc[0]
        i = gaps.idxmax()
        streaks[s] = {
            "longest_streak_days": int(st["count"]), "streak_from": str(st["min"].date()), "streak_to": str(st["max"].date()),
            "longest_silence_days": int(gaps.max()), "silence_from": str(days[i - 1].date()) if i > 0 else None, "silence_to": str(days[i].date()),
            "active_days": int(len(days)),
        }
    R["streaks"] = streaks

    # Mensaje que más risas provocó (risas de otros en los 3 minutos siguientes)
    ts = df["ts"].values
    snd = df["sender"].values
    laugh = np.zeros(len(df), bool)
    laugh_only = t["body"].map(lambda b: is_laugh(b, lang))
    laugh[t.index[laugh_only.values]] = True
    cand = t[(t["n_chars"] >= 12) & ~laugh_only]
    best = []
    for i in cand.index:
        j = i + 1
        n = 0
        people = set()
        while j < len(df) and (ts[j] - ts[i]) <= np.timedelta64(180, "s"):
            if snd[j] != snd[i] and laugh[j]:
                n += 1
                people.add(snd[j])
            j += 1
        if n >= th.funny_min_laughs:
            best.append((n, len(people), i))
    best.sort(reverse=True)
    R["funniest"] = {
        "method": "mensajes de >=12 chars seguidos de risas de otras personas en 3 minutos",
        "top": [dict(msg(df.loc[i]), laughs=n, people=p) for n, p, i in best[:15]],
    }
    by_person_fun: dict = {}
    for n, p, i in best:
        s = df.loc[i, "sender"]
        if s not in by_person_fun:
            by_person_fun[s] = dict(msg(df.loc[i]), laughs=n, people=p)
    R["funniest"]["record_by_person"] = by_person_fun

    # Mensaje con más respuestas (mensajes de otros en los 5 minutos siguientes, antes de que el autor vuelva a hablar)
    resp = []
    for i in cand.index:
        j = i + 1
        n = 0
        people = set()
        while j < len(df) and (ts[j] - ts[i]) <= np.timedelta64(300, "s"):
            if snd[j] == snd[i]:
                break
            n += 1
            people.add(snd[j])
            j += 1
        if n >= 8:
            resp.append((n, len(people), i))
    resp.sort(reverse=True)
    R["most_replied"] = {
        "method": "respuestas de otros en 5 minutos antes de que el autor volviera a escribir",
        "top": [dict(msg(df.loc[i]), replies=n, people=p) for n, p, i in resp[:15]],
    }

    # Audios, fotos, stickers, encuestas: total y día récord por persona
    media = {}
    for kind in ["audio", "image", "sticker", "video", "poll", "deleted"]:
        g = df[df["kind"] == kind]
        if g.empty:
            continue
        per = g.groupby("sender").size().sort_values(ascending=False, kind="stable")
        dday = g.groupby(["sender", "date"]).size().sort_values(ascending=False, kind="stable")
        media[kind] = {
            "total": int(len(g)),
            "by_person": per.head(10).to_dict(),
            "record_day": {"who": dday.index[0][0], "date": str(dday.index[0][1]), "count": int(dday.iloc[0])},
        }
    R["media"] = media

    # Madrugada: quién y cuál fue el mensaje más tarde (más cerca de las 5 am)
    late = t[t["hour"].isin([3, 4, 5])].copy()
    late["key"] = late["hour"] * 60 + late["ts"].dt.minute
    R["latest_night"] = {
        "share_by_person": df.groupby("sender")["hour"].apply(lambda h: round(float(h.isin([0, 1, 2, 3, 4, 5]).mean()), 3)).sort_values(ascending=False, kind="stable").head(10).to_dict(),
        "record": msg(late.loc[late["key"].idxmax()]) if len(late) else None,
    }

    # Mensaje más editado / borrados: ya en media; agregamos la encuesta con más votos
    polls = df[df["kind"] == "poll"].copy()
    if len(polls):
        polls["votes"] = polls["body"].str.extractall(r"(?m)^OPTION: .* \((\d+)\)$")[0].astype(int).groupby(level=0).sum()
        top_poll = polls.loc[polls["votes"].idxmax()]
        R["polls"] = {"total": int(len(polls)), "by_person": polls["sender"].value_counts().head(8).to_dict(), "most_voted": dict(msg(top_poll), votes=int(top_poll["votes"]))}

    (out / "records.json").write_text(json.dumps(R, ensure_ascii=False, indent=1, default=str), encoding="utf-8")

    L = ["# Récords del grupo\n"]
    L.append(f"## Largo de mensaje\nPromedio del grupo: {R['message_length']['avg_chars_group']} caracteres.\n")
    L.append(f"Récord: **{longest['sender']}**, {longest['ts']:%Y-%m-%d}, {int(longest['n_chars'])} caracteres:\n\n> {str(longest['body'])[:700]}\n")
    L.append("Promedio por persona: " + ", ".join(f"{k} {v}" for k, v in list(R["message_length"]["avg_chars_by_person"].items())[:12]) + "\n")
    L.append(f"## Mensajes por día\nPromedio del grupo: {R['messages_per_day']['avg_group']} por día. Récord: {R['messages_per_day']['record']}\n")
    L.append("## Rachas\n")
    for s, v in sorted(streaks.items(), key=lambda x: -x[1]["longest_streak_days"]):
        L.append(f"- {s}: racha {v['longest_streak_days']} días ({v['streak_from']} → {v['streak_to']}); silencio máximo {v['longest_silence_days']} días ({v['silence_from']} → {v['silence_to']}); {v['active_days']} días activos")
    L.append("\n## Mensajes que más risas provocaron\n")
    for m in R["funniest"]["top"]:
        L.append(f"- {m['laughs']} risas de {m['people']} personas · {m['when'][:16]} **{m['who']}**: {m['text'][:200]}")
    L.append("\n## Mensajes con más respuestas inmediatas\n")
    for m in R["most_replied"]["top"][:10]:
        L.append(f"- {m['replies']} respuestas de {m['people']} personas · {m['when'][:16]} **{m['who']}**: {m['text'][:200]}")
    L.append("\n## Multimedia\n")
    for k, v in media.items():
        L.append(f"- {k}: {v['total']} en total. Top: {dict(list(v['by_person'].items())[:5])}. Día récord: {v['record_day']}")
    if "polls" in R:
        L.append(f"\n## Encuestas\nTotal {R['polls']['total']}. Por persona: {R['polls']['by_person']}. Más votada ({R['polls']['most_voted']['votes']} votos, {R['polls']['most_voted']['who']}):\n\n> {R['polls']['most_voted']['text'][:400]}")
    L.append(f"\n## Madrugada\nPorcentaje de mensajes entre 0 y 5h: {R['latest_night']['share_by_person']}\n\nEl mensaje más tarde: {R['latest_night']['record']}")
    (out / "records.md").write_text("\n".join(L), encoding="utf-8")
    print(f"-> {out}/records.md", file=sys.stderr)


def main() -> None:
    run(sys.argv[1:])


if __name__ == "__main__":
    main()
