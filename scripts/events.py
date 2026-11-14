"""Eventos del grupo: lista curada con título, origen, repercusión y referencias posteriores.

Cada evento se define en content/events.json (id, título, regex de términos, ventana de
fechas, nota y, opcional, saga). El script busca el día de origen (día con más coincidencias
dentro de la ventana), mide la repercusión ese día y cuenta cuántas veces y en cuántos días
distintos se volvió a nombrar después (referencias). Salida: events.json y events.md en --out.

Uso:
    uv run scripts/events.py --events content/events.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

MENTION_RE = re.compile(r"@\u2068[^\u2069]*\u2069")

REQUIRED_KEYS = ("id", "title", "terms", "from", "to", "note")


@dataclass(frozen=True)
class EventDef:
    id: str
    title: str
    terms: str
    start: str
    end: str
    note: str
    saga: bool = False


def _iso_date(value, eid: str, key: str) -> date:
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError) as e:
        raise ValueError(f"evento {eid!r}: '{key}' debe ser una fecha AAAA-MM-DD, no {value!r}") from e


def load_events(path: Path) -> list[EventDef]:
    path = Path(path)
    try:
        items = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as e:
        raise ValueError(f"{path}: no es JSON válido ({e})") from e
    if not isinstance(items, list) or not all(isinstance(item, dict) for item in items):
        raise ValueError(f"{path}: debe ser una lista de eventos (objetos con {', '.join(REQUIRED_KEYS)})")
    evs = []
    for i, item in enumerate(items):
        eid = item.get("id", f"#{i}")
        missing = [k for k in REQUIRED_KEYS if k not in item]
        if missing:
            raise ValueError(f"evento {eid!r}: faltan claves {', '.join(missing)}")
        start, end = _iso_date(item["from"], eid, "from"), _iso_date(item["to"], eid, "to")
        if start > end:
            raise ValueError(f"evento {eid!r}: la ventana empieza ({item['from']}) después de terminar ({item['to']})")
        try:
            re.compile(item["terms"])
        except (TypeError, re.error) as e:
            raise ValueError(f"evento {eid!r}: 'terms' no es una regex válida: {e}") from e
        evs.append(EventDef(item["id"], item["title"], item["terms"], item["from"], item["to"], item["note"], bool(item.get("saga", False))))
    return evs


def run(argv: list[str]) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/messages.parquet")
    ap.add_argument("--chat", default="main")
    ap.add_argument("--out", default="data/analysis")
    ap.add_argument("--events", default="content/events.json")
    args = ap.parse_args(argv)
    events_path = Path(args.events)
    if not events_path.is_file():
        raise SystemExit(f"no encuentro el archivo de eventos: {events_path}")
    event_defs = load_events(events_path)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    df = pd.read_parquet(args.data)
    df = df[(df["chat"] == args.chat)].sort_values("ts", kind="stable").reset_index(drop=True)
    df["sender"] = df["sender"].astype(str)
    t = df[(df["kind"] == "text") & (df["sender"] != "Meta AI")].copy()
    t["clean"] = t["body"].str.replace(MENTION_RE, "", regex=True)
    daily = df.groupby("date").size()

    results = []
    for e in event_defs:
        eid, title, note = e.id, e.title, e.note
        rx = re.compile(e.terms, re.IGNORECASE)  # compilado: str.contains avisa por los grupos de captura
        hit = t[t["clean"].map(lambda c: rx.search(c) is not None)]
        win = hit[(hit["ts"] >= e.start) & (hit["ts"] <= pd.Timestamp(e.end) + pd.Timedelta(days=1))]
        if win.empty:
            results.append({"id": eid, "title": title, "note": note, "error": "sin coincidencias en la ventana"})
            continue
        origin = win.groupby("date").size().idxmax()
        od = pd.Timestamp(origin)
        day_msgs = int(daily.get(origin, 0))
        day_hits = win[win["date"] == origin]
        later = hit[hit["ts"] > od + pd.Timedelta(days=3)]
        before = hit[hit["ts"] < od - pd.Timedelta(days=3)]
        sample = day_hits.sort_values("n_chars", ascending=False, kind="stable").head(5)
        refs = later.sample(min(4, len(later)), random_state=1).sort_values("ts", kind="stable") if len(later) else later
        results.append(
            {
                "id": eid,
                "title": title,
                "kind": "saga" if e.saga else "evento",
                "note": note,
                "origin_date": str(origin),
                "origin_day_msgs": day_msgs,
                "origin_day_hits": int(len(day_hits)),
                "origin_day_top_senders": df[df["date"] == origin]["sender"].value_counts().head(3).to_dict(),
                "window_hits": int(len(win)),
                "later_mentions": int(len(later)),
                "later_days": int(later["date"].nunique()),
                "later_months": int(later["ts"].dt.to_period("M").nunique()),
                "earlier_mentions": int(len(before)),
                "top_referencers": later["sender"].value_counts().head(4).to_dict(),
                "last_mention": str(later["ts"].max().date()) if len(later) else None,
                "sample_origin": [f"{r['ts']:%H:%M} {r['sender']}: {r['body'][:160]}" for _, r in sample.iterrows()],
                "sample_later": [f"{r['ts']:%Y-%m-%d} {r['sender']}: {r['body'][:160]}" for _, r in refs.iterrows()],
            }
        )

    (out / "events.json").write_text(json.dumps(results, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    L = ["# Eventos del grupo\n", "Ordenados por días distintos en que se los volvió a nombrar después del origen.\n"]
    ok = [r for r in results if "error" not in r]
    ok.sort(key=lambda r: -r["later_days"])
    L.append("| # | Evento | Tipo | Origen | Msgs ese día | Veces nombrado después | Días distintos | Meses | Última mención |")
    L.append("|--:|---|---|---|--:|--:|--:|--:|---|")
    for i, r in enumerate(ok, 1):
        L.append(f"| {i} | {r['title']} | {r['kind']} | {r['origin_date']} | {r['origin_day_msgs']} | {r['later_mentions']} | {r['later_days']} | {r['later_months']} | {r['last_mention']} |")
    for r in ok:
        L.append(f"\n## {r['title']}\n")
        L.append(f"_{r['note']}_  ")
        L.append(f"Origen {r['origin_date']} ({r['origin_day_msgs']} mensajes ese día, {r['origin_day_hits']} sobre el tema; más activos: {r['origin_day_top_senders']}). "
                 f"Después se nombró {r['later_mentions']} veces en {r['later_days']} días distintos; quién más lo recuerda: {r['top_referencers']}.\n")
        L.append("Ese día:\n")
        for s in r["sample_origin"]:
            L.append(f"> {s}")
        if r["sample_later"]:
            L.append("\nReferencias posteriores:\n")
            for s in r["sample_later"]:
                L.append(f"> {s}")
    for r in results:
        if "error" in r:
            L.append(f"\n## {r['title']}\n\n_{r['error']}_")
    (out / "events.md").write_text("\n".join(L), encoding="utf-8")
    print(f"-> {out}/events.md ({len(ok)} eventos)", file=sys.stderr)


def main() -> None:
    run(sys.argv[1:])


if __name__ == "__main__":
    main()
