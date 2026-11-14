"""Capítulo Censo.

- timeline: hitos del grupo ordenados por `when` (ISO, fecha y hora): cambios de nombre (group_report.membership,
  ev == "nombre", con el nombre nuevo y quien lo cambió), cambios de foto (filas con sys_event == "photo_changed",
  quien lo hizo es sys_by), la entrada de cada persona con perfil (su primer mensaje), las salidas (ev "salió" o
  "quitó") de las personas con perfil salvo el `departer` (el miembro que se fue y volvió: va en su marcador), los
  10 días pico con más mensajes (peak_days.json), los eventos titulados (events.json ya construido) y un
  único marcador del `departer` ("N vueltas", en su primera re-entrada o al inicio del export si no hay).
- names: el nombre del grupo que más duró y el que menos, en días con un decimal (hay nombres que duraron horas).
  `seconds` es la duración exacta (el copy dice "51 segundos" si no llega a un día). Cada nombre dura hasta el
  cambio siguiente; el actual, hasta el final del export, y por eso no compite por el más
  corto (sigue vigente). Sin cambios de nombre, ambos son None; con uno solo, ambos son el mismo.
- tenure: por persona, del primer al último mensaje, con los huecos de más de 30 días entre días activos.
  absence: el hueco más largo de todos (None si nadie tuvo uno).
- byYear: mensajes por año y persona. hourOfEach: la hora con más mensajes de cada uno y su share; earlyBird: mayor
  share entre las 6 y las 9 h; owl: mayor share entre las 0 y las 6 h.

Las filas de sistema solo dan los hitos; los conteos usan los mensajes (sin sistema ni '__grupo__').
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wa.lang import Lang  # noqa: E402
from wa.names import People  # noqa: E402

GAP_DAYS = 30
PEAKS_TOP = 10
LEAVE_EVENTS = ("salió", "quitó")  # se fue o lo sacaron
EARLY_HOURS = range(6, 9)  # madrugador: 6 a 9 h
OWL_HOURS = range(0, 6)  # búho: 0 a 6 h
EVENTS_HREF = "/eventos/#rail"


def _iso(ts) -> str:
    return pd.Timestamp(ts).isoformat()


def _item(when, kind: str, label: str, slug_: str | None = None, href: str | None = None) -> dict:
    return {"when": _iso(when), "kind": kind, "label": label, "slug": slug_, "href": href}


def _messages(df_all: pd.DataFrame) -> pd.DataFrame:
    return df_all[~df_all["is_system"] & (df_all["sender"] != "__grupo__")]


def _name_changes(ev: pd.DataFrame) -> list[tuple[pd.Timestamp, str, str]]:
    """[(ts, nombre nuevo, quién)] en orden; quién es "" si el aviso no lo dice."""
    return [(e.ts, e.quien, "" if e.por_c == "-" else e.por_c) for e in ev[ev["ev"] == "nombre"].sort_values("ts", kind="stable").itertuples()]


def _names(changes: list[tuple], end: pd.Timestamp) -> dict:
    if not changes:
        return {"longest": None, "shortest": None}
    spans = []
    for i, (ts, label, _) in enumerate(changes):
        to = changes[i + 1][0] if i + 1 < len(changes) else end
        seconds = int((to - ts).total_seconds())
        spans.append({"label": label, "days": round(seconds / 86400, 1), "seconds": seconds, "from": _iso(ts),
                      "to": _iso(to)})
    finished = spans[:-1] or spans
    longest = max(spans, key=lambda s: s["seconds"])  # en empate, el primero
    shortest = min(finished, key=lambda s: s["seconds"])
    return {"longest": longest, "shortest": shortest}


def _tenure(msgs: pd.DataFrame, slugs: dict[str, str]) -> list[dict]:
    out = []
    for name, s in slugs.items():
        days = pd.Series(sorted(set(pd.to_datetime(msgs.loc[msgs["sender"] == name, "ts"]).dt.date)))
        if days.empty:
            continue
        gaps = []
        for a, b in zip(days[:-1], days[1:]):
            if (b - a).days > GAP_DAYS:
                gaps.append({"from": a.isoformat(), "to": b.isoformat(), "days": int((b - a).days)})
        out.append({"slug": s, "from": days.iloc[0].isoformat(), "to": days.iloc[-1].isoformat(), "gaps": gaps})
    return out


def _absence(tenure: list[dict]) -> dict | None:
    best = None
    for t in tenure:
        for g in t["gaps"]:
            if best is None or g["days"] > best["days"]:
                best = {"slug": t["slug"], **g}
    return best


def _share_leader(msgs: pd.DataFrame, slugs: dict[str, str], hours: range) -> dict | None:
    best = None
    for name, s in slugs.items():
        h = msgs.loc[msgs["sender"] == name, "hour"]
        if len(h):
            share = round(float(h.isin(hours).mean()), 3)
            if best is None or share > best["share"]:
                best = {"slug": s, "share": share}
    return best


def build_census(df_all: pd.DataFrame, people: list[dict], events: list[dict], peaks: list[dict],
                 departures: int, departer: str | None, people_names: People, lang: Lang) -> dict:
    """census.json. df_all = build_web_data.load_all (con filas de sistema); people = entradas de global.json;
    events = events.json ya construido (title, originDate); peaks = peak_days.json de group_report;
    departures = cantidad de re-entradas de `departer` (departures.csv); departer = nombre corto o None (sin marcador);
    people_names = wa.names.People; lang = wa.lang.Lang (las etiquetas de la línea de tiempo)."""
    from build_web_data import profiled  # import diferido (ciclo con build_web_data)
    from group_report import canonical_or_sentinel, membership

    slugs = profiled(people)
    df_all = df_all.sort_values("ts", kind="stable")
    msgs = _messages(df_all)
    ev = membership(df_all, people_names, lang)
    start, end = pd.Timestamp(df_all["ts"].min()), pd.Timestamp(df_all["ts"].max())

    timeline = []
    changes = _name_changes(ev)
    timeline += [_item(ts, "name", label, slugs.get(who)) for ts, label, who in changes]
    for r in df_all[df_all["sys_event"] == "photo_changed"].itertuples():
        timeline.append(_item(r.ts, "photo", lang.labels.new_photo, slugs.get(canonical_or_sentinel(r.sys_by, people_names))))
    for name, s in slugs.items():
        mine = msgs[msgs["sender"] == name]
        if len(mine):
            timeline.append(_item(mine["ts"].iloc[0], "join", name, s, f"/p/{s}/"))
    for e in ev[ev["ev"].isin(LEAVE_EVENTS) & ev["quien_c"].isin(slugs) & (ev["quien_c"] != departer)].itertuples():
        timeline.append(_item(e.ts, "leave", e.quien_c, slugs[e.quien_c], f"/p/{slugs[e.quien_c]}/"))
    for p in sorted(peaks, key=lambda p: (-p["msgs"], p["date"]))[:PEAKS_TOP]:
        timeline.append(_item(p["date"], "peak", lang.labels.msgs(p["msgs"])))  # 2.300 mensajes
    for e in events:
        timeline.append(_item(e["originDate"], "event", e["title"], None, EVENTS_HREF))
    if departer is not None:
        # Primera re-entrada: misma definición que group_report.departer_reentries (añadió o link).
        back = ev.loc[(ev["quien_c"] == departer) & ev["ev"].isin(["añadió", "link"]), "ts"]
        timeline.append(_item(back.min() if len(back) else start, "departures", lang.labels.returns(departures),
                              slugs.get(departer), "/salidas/"))
    timeline.sort(key=lambda t: t["when"])

    tenure = _tenure(msgs, slugs)

    years = list(range(start.year, end.year + 1))
    mine = msgs[msgs["sender"].isin(slugs)]
    by_year = mine.groupby([pd.to_datetime(mine["ts"]).dt.year, "sender"]).size()
    by_year = by_year.unstack(fill_value=0).reindex(index=years, columns=list(slugs), fill_value=0).astype(int)

    hour_of_each = []
    for name, s in slugs.items():
        h = msgs.loc[msgs["sender"] == name, "hour"].astype(int)
        if len(h):
            counts = h.value_counts()
            top = int(counts[counts == counts.max()].index.min())  # en empate, la hora más temprana
            hour_of_each.append({"slug": s, "hour": top, "share": round(float(counts[top] / len(h)), 3)})

    return {
        "timeline": timeline,
        "names": _names(changes, end),
        "tenure": tenure,
        "absence": _absence(tenure),
        "byYear": {"years": [str(y) for y in years], "series": {slugs[n]: by_year[n].tolist() for n in slugs}},
        "hourOfEach": hour_of_each,
        "earlyBird": _share_leader(msgs, slugs, EARLY_HOURS),
        "owl": _share_leader(msgs, slugs, OWL_HOURS),
    }

