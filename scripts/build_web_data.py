"""Datos JSON para la web del informe (web/data por defecto).

Uso:
    uv run python -I scripts/build_web_data.py [--config report.config.json] [--content content]
                                               [--data data/messages.parquet] [--analysis data/analysis]
                                               [--out web/data] [--thresholds derived|legacy] [--min-msgs N]
El config da título, idioma, `me`, `departer` y `verifiedOn`; content/ trae people.json y badwords.txt (la lista que
cuenta, entera: arranca de las puteadas base del idioma, wa.lang, y se edita a gusto). Las etiquetas que van en los JSON salen del idioma (wa.lang.get_lang).
Genera global.json, facts.json, people/<slug>.json, events.json, records.json, lore.json, departures.json,
language.json, census.json, media.json, emojis.json, polls.json, rhythm.json, mentions.json y awards.json.
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import profile as prof  # noqa: E402
from config import ConfigError, load_config  # noqa: E402
from web import awards as awards_mod, census, emojis, language, media, mentions, polls, rhythm  # noqa: E402
from web.common import INVISIBLE_RE, export_text, has_isolates, redact_mentions  # noqa: E402
from web.thresholds import Thresholds  # noqa: E402
from wa.lang import Lang, get_lang  # noqa: E402
from wa.names import People, PeopleError, load_people  # noqa: E402
from wa.parser import detect_format  # noqa: E402
from wa.slugs import slug  # noqa: E402
from wa.text import strip_accents  # noqa: E402

SKIP = {"Meta AI", "__grupo__"}
CHAT = "main"
N_COLORS = 12
FIRST_MSG_CHARS = 200
KIND_FIELDS = {
    "text": "text",
    "audios": "audio",
    "images": "image",
    "stickers": "sticker",
    "videos": "video",
    "polls": "poll",
    "deleted": "deleted",
    "media": "media",  # Android: el export no distingue el tipo del adjunto (0 en iOS)
}
LORE_TOP = 60
LORE_MIN_REPLIES = 5
COMPLAINTS_TOP = 10
PROTAGONISTS = 3
LORE_COLUMNS = ["palabra", "usos", "personas", "dias", "primer_uso", "acuño", "primer_mensaje", "mas_usa",
                "responde_a", "responde_a_n"]
REENTRY_COLUMNS = ["reentry", "last_msg_before", "first_msg_after", "how", "added_by", "out_hours", "back_minutes"]

POLL_OPTION_RE = re.compile(r"^OPTION: (.*) \((\d+)\)$")  # formato canónico del parser, en todo idioma


def clean_text(s: str, people: People, lang: Lang | None = None, isolates: bool = True) -> str:
    """Menciones sin nombres completos ni teléfonos (web.common.redact_mentions: las de contactos de `people` en
    nombre corto, las demás como lang.labels.unknown_mention); quita marcas invisibles; nada más. `isolates`: el chat
    es iOS (chat_has_isolates, una vez por corrida); si no, las menciones son @Nombre en texto plano (Android).
    Sin `lang`, castellano."""
    return INVISIBLE_RE.sub("", redact_mentions(s, people, lang or get_lang("es"), isolates))


def web_text(s: str, people: People, lang: Lang | None = None, isolates: bool = True) -> str:
    """clean_text y además corta en el primer encabezado de export pegado ('\\n[14/3/25, 6:12...] Nombre:')."""
    return export_text(clean_text(s, people, lang, isolates))


def chat_has_isolates(path: str) -> bool:
    """¿Las menciones del chat del informe vienen en aisladores U+2068 (iOS)? Se decide una vez, con los cuerpos crudos
    del parquet; sin ninguno, clean_text lee las menciones como texto plano (Android)."""
    df = pd.read_parquet(path, columns=["chat", "body"])
    return has_isolates(df.loc[df["chat"] == CHAT, "body"])


def iso(ts) -> str:
    return pd.Timestamp(ts).isoformat()


def full_text(df: pd.DataFrame | None, who: str, when, fallback: str, people: People, lang: Lang | None = None,
              isolates: bool = True) -> str:
    """Texto completo (records y profile lo truncan) del mensaje de `who` en `when`, buscado en df (load_chat);
    sin df o sin coincidencia, el fallback. Siempre pasa por web_text."""
    if df is not None:
        rows = df[(df["sender"] == who) & (df["ts"] == pd.Timestamp(when))]
        if len(rows):
            return web_text(str(rows.loc[rows["n_chars"].idxmax(), "body"]), people, lang, isolates)
    return web_text(fallback, people, lang, isolates)


def heatmap(df: pd.DataFrame) -> list[list[int]]:
    """Matriz 7x24: fila = día de la semana (0 = lunes), columna = hora."""
    m = df.groupby(["dow", "hour"]).size().unstack(fill_value=0)
    m = m.reindex(index=range(7), columns=range(24), fill_value=0)
    return m.astype(int).values.tolist()


def month_axis(df: pd.DataFrame) -> pd.PeriodIndex:
    return pd.period_range(df["ts"].min().to_period("M"), df["ts"].max().to_period("M"), freq="M")


def monthly_counts(df: pd.DataFrame, names: list[str]) -> pd.DataFrame:
    """Mensajes por mes (filas) y persona (columnas), sobre el eje completo de meses."""
    t = df[df["sender"].isin(names)]
    m = t.groupby([t["ts"].dt.to_period("M"), "sender"]).size().unstack(fill_value=0)
    return m.reindex(index=month_axis(df), columns=names, fill_value=0).astype(int)


def conversation_counts(df: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    """Quién arranca (tras > 3h de silencio) y quién mata (último antes de > 3h) conversaciones."""
    d = df.sort_values("ts", kind="stable")
    gap_before = d["ts"].diff()
    gap_after = -d["ts"].diff(-1)
    gap = pd.Timedelta(hours=3)
    return (
        d.loc[gap_before > gap, "sender"].value_counts(),
        d.loc[gap_after > gap, "sender"].value_counts(),
    )


def load_chat(path: str, people: People, lang: Lang | None = None, isolates: bool = True) -> pd.DataFrame:
    df = pd.read_parquet(path)
    df = df[(df["chat"] == CHAT) & (~df["is_system"])].copy()
    df["sender"] = df["sender"].astype(str)
    df = df[~df["sender"].isin(SKIP)].sort_values("ts", kind="stable").reset_index(drop=True)
    df["body"] = df["body"].map(lambda b: clean_text(b, people, lang, isolates))
    return df


def raw_bodies(path: str, df: pd.DataFrame) -> pd.Series:
    """Cuerpos sin clean_text (con los @⁨Nombre⁩ intactos) de las filas de df (load_chat), alineados a df.index
    por msg_id; solo para contar menciones."""
    raw = pd.read_parquet(path, columns=["msg_id", "body"]).set_index("msg_id")["body"]
    return pd.Series(df["msg_id"].map(raw).fillna("").astype(str).to_numpy(), index=df.index)


def load_all(path: str, people: People, lang: Lang | None = None, isolates: bool = True) -> pd.DataFrame:
    """Como load_chat pero conserva las filas de sistema (sender '__grupo__' incluido); solo para el censo."""
    df = pd.read_parquet(path)
    df = df[df["chat"] == CHAT].copy()
    df["sender"] = df["sender"].astype(str)
    df = df[df["sender"] != "Meta AI"].sort_values("ts", kind="stable").reset_index(drop=True)
    df["body"] = df["body"].map(lambda b: clean_text(b, people, lang, isolates))
    return df


def load_background(path: str, before) -> pd.Series:
    """Textos de los chats de fondo (todos los que no son CHAT) anteriores a `before` (el primer mensaje del chat
    del informe), de al menos language.QUOTE_N palabras: el habla previa, para no tomar frases hechas por citas.
    Vacío si no hay chats de fondo."""
    df = pd.read_parquet(path, columns=["chat", "ts", "body", "kind", "n_words"])
    keep = (df["chat"] != CHAT) & (df["kind"] == "text") & (df["ts"] < pd.Timestamp(before))
    keep &= df["n_words"] >= language.QUOTE_N
    return df.loc[keep, "body"].astype(str).reset_index(drop=True)


def _person_entry(name: str, g: pd.DataFrame, color: int, slug_: str | None = None) -> dict:
    kinds = g["kind"].astype(str).value_counts()
    # el primer mensaje con texto (los adjuntos tienen cuerpo vacío); si no hay, el primero a secas
    with_text = g[g["body"].str.strip() != ""]
    first = (with_text if len(with_text) else g).iloc[0]
    entry = {"slug": slug_ or slug(name), "name": name, "colorIndex": color, "msgs": int(len(g))}
    entry.update({field: int(kinds.get(kind, 0)) for field, kind in KIND_FIELDS.items()})
    entry["firstMessage"] = {"when": iso(first["ts"]), "text": str(first["body"])[:FIRST_MSG_CHARS]}
    return entry


def build_global(df: pd.DataFrame, th: Thresholds, title: str, lang: Lang, platform: str = "ios",
                 time_resolution: str = "second", mode: str = "full", gate: bool = True) -> dict:
    """global.json. Tiene perfil quien manda al menos th.profile_msgs mensajes y th.active_share del total del chat.
    El resto va en una entrada con slug "resto" y nombre lang.labels.rest; "lang" es lang.code. "platform"
    ("ios"|"android") y "timeResolution" ("second"|"minute": Android no guarda segundos) vienen de detect_format.
    "mode" ("single"|"full") y "gate" (bool) vienen de report.config.json."""
    counts = df["sender"].value_counts()
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    total = len(df)
    profiled = [s for s, n in ranked if n >= th.profile_msgs and n / total >= th.active_share]
    slugs = {s: slug(s) for s in profiled}

    people = [
        _person_entry(s, df[df["sender"] == s], i if i < N_COLORS else -1) for i, s in enumerate(profiled)
    ]
    rest = df[~df["sender"].isin(profiled)]
    if len(rest):
        people.append(_person_entry(lang.labels.rest, rest, -1, "resto"))

    monthly = monthly_counts(df, profiled)

    rm = prof.reply_matrix(df)
    rm = rm[rm["sender"].isin(profiled) & rm["replies_to"].isin(profiled)]
    a, b = rm["sender"].map(slugs), rm["replies_to"].map(slugs)
    pairs = pd.DataFrame({"a": a.where(a < b, b), "b": b.where(a < b, a)}).value_counts()
    edges = [{"a": x, "b": y, "w": int(w)} for (x, y), w in pairs.items()]
    edges.sort(key=lambda e: (-e["w"], e["a"], e["b"]))

    starts, kills = conversation_counts(df)

    return {
        "title": title,
        "lang": lang.code,
        "platform": platform,
        "timeResolution": time_resolution,
        "mode": mode,
        "gate": gate,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "period": {"from": df["ts"].min().date().isoformat(), "to": df["ts"].max().date().isoformat()},
        "totals": {"msgs": int(len(df)), "daysActive": int(df["date"].nunique()), "people": int(len(counts))},
        "people": people,
        "monthly": {
            "months": [str(p) for p in monthly.index],
            "series": {slugs[s]: monthly[s].tolist() for s in profiled},
        },
        "heatmap": heatmap(df),
        "edges": edges,
        "starters": {slugs[s]: int(starts.get(s, 0)) for s in profiled},
        "killers": {slugs[s]: int(kills.get(s, 0)) for s in profiled},
    }


def _ranked(counter: dict, slugs: dict[str, str]) -> list[dict]:
    return [{"slug": slugs[name], "n": int(n)} for name, n in counter.items() if name in slugs]


def profiled(people: list[dict]) -> dict[str, str]:
    """Nombre -> slug de las personas con perfil (entradas de global.json salvo 'resto')."""
    return {p["name"]: p["slug"] for p in people if p["slug"] != "resto"}


def build_person(df: pd.DataFrame, slug_: str, people: list[dict], people_names: People, lang: Lang,
                 isolates: bool = True) -> dict:
    """people: entradas de global.json; solo cuentan las que tienen perfil (no 'resto'). lang: wa.lang.Lang (las
    palabras firma usan sus stopwords). isolates: chat_has_isolates (cómo limpiar las menciones del récord)."""
    slugs = profiled(people)
    name = next(n for n, s in slugs.items() if s == slug_)
    p = prof.profile(df, name, lang)

    monthly = monthly_counts(df, list(slugs))
    ranks = monthly.cumsum().rank(axis=1, method="min", ascending=False)[name].astype(int)
    longest = p["longest_message"]

    return {
        "slug": slug_,
        "name": name,
        "msgs": p["total_msgs"],
        "activeDays": p["active_days"],
        "rankByMonth": ranks.tolist(),
        "monthly": monthly[name].tolist(),
        "heatmap": heatmap(df[df["sender"] == name]),
        "repliesTo": _ranked(p["replies_to"], slugs),
        "repliedBy": _ranked(p["replied_by"], slugs),
        "signatureWords": [{"w": w, "n": int(n), "ratio": float(r)} for w, n, r in p["signature_words"]],
        "emojis": [{"e": e, "n": int(n)} for e, n in p["top_emojis"]],
        "kinds": {str(k): int(v) for k, v in p["kinds"].items() if v},
        "records": {
            "longest": {
                "value": longest["chars"],
                "record": {
                    "who": slug_, "when": iso(longest["ts"]), "text": full_text(df, name, longest["ts"], longest["body"], people_names, lang, isolates),
                },
            },
            "busiestDay": p["busiest_day"],
            "streak": p["longest_streak"],
            "silence": p["longest_silence"],
            "lateNightShare": p["late_night_share"],
        },
    }


def _departer_peak_months(analysis: Path | None) -> list[dict]:
    path = analysis / "departures.csv" if analysis else None
    if path is None or not path.exists():
        return []
    try:
        r = pd.read_csv(path, parse_dates=["reentry"])
    except pd.errors.EmptyDataError:
        return []
    if r.empty:
        return []
    by_month = r.groupby(r["reentry"].dt.to_period("M")).size()
    top = by_month[by_month == by_month.max()]
    return [{"month": str(m), "n": int(n)} for m, n in top.items()]


def _top_n(rows: list[dict]) -> dict | None:
    """El primero de un ranking [{"slug","n"}] ya ordenado, si llega a 1."""
    return {"slug": rows[0]["slug"], "n": rows[0]["n"]} if rows and rows[0]["n"] > 0 else None


def build_facts(global_: dict, people_files: dict[str, dict], analysis: Path | None = None, *,
                departer: str | None = None, language: dict | None = None, census: dict | None = None, mentions: dict | None = None,
                rhythm: dict | None = None, awards: list[dict] | None = None, thresholds: Thresholds,
                lang: Lang) -> dict:
    """Números de los ledes. Los capítulos son opcionales: sin ellos, sus campos son None (awardsCount 0).
    census se acepta para los ledes que lo necesiten; hoy no aporta campos. Sin `departer` (nombre corto), los campos
    departer* son None / None / []. `thresholds` son los umbrales del reporte: la web cita sus números. peakDow y peakHour
    son el día (de lang.dow) y la hora de la celda más cargada del heatmap del grupo, un solo momento (empate: el día
    más temprano y, en él, la hora más temprana); no son el día más movido y la hora más movida por separado."""
    months = global_["monthly"]["months"]
    series = pd.DataFrame(global_["monthly"]["series"], index=months)
    overtake = months_to_top = None
    dslug = slug(departer) if departer else None
    if dslug in people_files:
        cum = series.cumsum()
        others = cum.drop(columns=dslug)
        on_top = cum[dslug] > (others.max(axis=1) if len(others.columns) else -1)
        if on_top.any():
            overtake = on_top.idxmax()
            first_active = next(i for i, n in enumerate(people_files[dslug]["monthly"]) if n)
            months_to_top = months.index(overtake) - first_active

    cells = pd.DataFrame(global_["heatmap"]).to_numpy()  # filas: días (lunes primero); columnas: horas
    peak_dow, peak_hour = divmod(int(cells.argmax()), cells.shape[1])  # argmax: la primera celda máxima, fila a fila
    return {
        "departerOvertakeMonth": overtake,
        "departerMonthsToTop": months_to_top,
        "peakDow": lang.dow[peak_dow],
        "peakHour": peak_hour,
        "departerPeakMonths": _departer_peak_months(analysis) if dslug else [],
        "totalMsgs": global_["totals"]["msgs"],
        "daysActive": global_["totals"]["daysActive"],
        "awardsCount": len(awards or []),
        "topMuletilla": _top_muletilla(language),
        "mostMentioned": (mentions or {}).get("mostMentioned"),
        "fastest": awards_mod.fastest_winner(awards or []),
        "startersTop": _top_n(rhythm["starters"]) if rhythm else None,
        "killersTop": _top_n(rhythm["killers"]) if rhythm else None,
        "thresholds": _effective_thresholds(thresholds, global_["totals"]["msgs"]),
    }


def _effective_thresholds(th: Thresholds, total_msgs: int) -> dict:
    """Los mínimos que el pipeline aplicó de verdad. profileMsgs es lo que hizo falta para tener perfil: el piso en
    mensajes o, si es mayor, active_share del chat (build_global exige las dos cosas)."""
    share_min = math.ceil(round(th.active_share * total_msgs, 9))
    return {
        "profileMsgs": max(th.profile_msgs, share_min),
        "fastestMinReplies": th.fastest_min_replies,
        "pollMinVotes": th.poll_min_votes,
        "signatureMinOwn": th.signature_min_own,
        "quoteMinTimes": th.quote_min_times,
        "funnyMinLaughs": th.funny_min_laughs,
        "recordMinGroup": th.record_min_group,
        "properMinN": th.proper_min_n,
    }


def _top_muletilla(language: dict | None) -> dict | None:
    top = ((language or {}).get("top") or {}).get("muletilla")
    return None if top is None else {k: top[k] for k in ("slug", "phrase", "own", "others")}


def _record(r: dict, people_names: People, lang: Lang | None = None, isolates: bool = True) -> dict:
    return {"who": slug(r["who"]), "when": iso(r["when"]), "text": web_text(r["text"], people_names, lang, isolates)}


def _top_profiled(counter: dict, slugs: dict[str, str]) -> str | None:
    return next((slugs[name] for name, _ in sorted(counter.items(), key=lambda kv: -kv[1]) if name in slugs), None)


def build_events(events: list[dict], people: list[dict], people_names: People, lang: Lang | None = None,
                 isolates: bool = True) -> list[dict]:
    slugs = profiled(people)
    out = []
    for e in events:
        if "error" in e:
            continue
        senders = sorted(e["origin_day_top_senders"].items(), key=lambda kv: -kv[1])
        out.append({
            "id": e["id"],
            "title": e["title"],
            "kind": e["kind"],
            "originDate": e["origin_date"],
            "originMsgs": int(e["origin_day_msgs"]),
            "laterDays": int(e["later_days"]),
            "laterMentions": int(e["later_mentions"]),
            "note": e["note"],
            "sampleOrigin": [web_text(x, people_names, lang, isolates) for x in e["sample_origin"]],
            "sampleLater": [web_text(x, people_names, lang, isolates) for x in e["sample_later"]],
            "topReferencers": [slugs[n] for n in e["top_referencers"] if n in slugs],
            "protagonists": [slugs[n] for n, _ in senders if n in slugs][:PROTAGONISTS],
        })
    out.sort(key=lambda e: (-e["laterDays"], -e["laterMentions"], e["id"]))
    return out


def _quotes(top: list[dict], slugs: dict[str, str], metric: str, people_names: People, lang: Lang,
            isolates: bool) -> list[dict]:
    return [
        {**_record(q, people_names, lang, isolates), metric: int(q[metric]), "people": int(q["people"])}
        for q in top
        if q["who"] in slugs
    ]


def parse_poll(text: str) -> tuple[str, list[dict]]:
    """'POLL:\\n<pregunta>\\nOPTION: <label> (<n>)...' (el formato canónico del parser) -> (pregunta, opciones).
    `text` ya pasó por clean_text (load_chat, o _poll para los de records.json)."""
    question, options = "", []
    for line in export_text(text).splitlines()[1:]:
        m = POLL_OPTION_RE.match(line.strip())
        if m:
            options.append({"label": m.group(1), "votes": int(m.group(2))})
        elif not options and not question:
            question = line.strip()
    return question, options


def _poll(polls: dict | None, people_names: People, lang: Lang, isolates: bool) -> dict | None:
    if not polls:  # records no escribe "polls" si el chat no tiene encuestas
        return None
    voted = polls["most_voted"]
    question, options = parse_poll(clean_text(voted["text"], people_names, lang, isolates))
    return {
        "question": question,
        "options": options,
        "who": slug(voted["who"]),
        "when": iso(voted["when"]),
        "totalVotes": sum(o["votes"] for o in options),
    }


def _latest_night(night: dict, df: pd.DataFrame | None, people_names: People, lang: Lang,
                  isolates: bool) -> dict | None:
    """La share es la del dueño del récord; share_by_person solo trae el top 10, si no está se calcula de df
    con la misma definición que records (mensajes entre las 0 y las 5)."""
    record = night.get("record")
    if record is None:
        return None
    who = record["who"]
    share = night["share_by_person"].get(who)
    if share is None:
        share = round(float(df.loc[df["sender"] == who, "hour"].isin(range(6)).mean()), 3)
    return {"value": share, "record": _record(record, people_names, lang, isolates)}


def build_records(records: dict, people: list[dict], people_names: People, df: pd.DataFrame | None = None, *,
                  lang: Lang, isolates: bool = True) -> dict:
    """df (load_chat) da el texto completo del mensaje más largo (records.json lo trunca) y la share de madrugada
    si su dueño no está en share_by_person; sin df se usa lo que trae records.json. lang: wa.lang.Lang (el texto
    "N mensajes" del día récord)."""
    slugs = profiled(people)
    ml, mpd, night = records["message_length"], records["messages_per_day"], records["latest_night"]

    day = mpd["record"]
    media = {
        kind: {
            "total": int(m["total"]),
            "byPerson": _ranked(m["by_person"], slugs),
            "recordDay": {"who": slug(m["record_day"]["who"]), "date": m["record_day"]["date"],
                          "n": int(m["record_day"]["count"])},
        }
        for kind, m in records["media"].items()
    }

    longest = ml["record"]
    return {
        "messageLength": {
            "value": ml["avg_chars_group"],
            "record": {**_record(longest, people_names, lang, isolates),
                       "text": full_text(df, longest["who"], longest["when"], longest["text"], people_names, lang,
                                         isolates)},
        },
        "messagesPerDay": {
            "value": mpd["avg_group"],
            "record": {
                "who": _top_profiled(day["by"], slugs), "when": day["date"], "text": lang.labels.msgs(int(day["msgs"])),
                "msgs": int(day["msgs"]),
            },
        },
        "funniest": _quotes(records["funniest"]["top"], slugs, "laughs", people_names, lang, isolates),
        "mostReplied": _quotes(records["most_replied"]["top"], slugs, "replies", people_names, lang, isolates),
        "media": media,
        "poll": _poll(records.get("polls"), people_names, lang, isolates),
        "latestNight": _latest_night(night, df, people_names, lang, isolates),
    }


def _name_words(people_names: People, nicknames: dict | None) -> set[str]:
    """Palabras que son nombres, no lore (en minúscula y sin acentos): apellidos de contacto, aliases de people.json,
    nombres cortos y cada palabra de los apodos de nicknames.json ("El Brujo" -> "el", "brujo")."""
    words = set(people_names.contact_surnames()) | set(people_names.aliases)
    names = [*people_names.short_names(), *((nicknames or {}).values())]
    words |= {w for n in names if isinstance(n, str) for w in re.findall(r"\w+", n.lower())}
    return {strip_accents(w.lower()) for w in words}


def build_lore(lore: pd.DataFrame, people: list[dict], people_names: People, nicknames: dict | None = None) -> list[dict]:
    """lore.json: los LORE_TOP términos más usados, sin los de SKIP ni los que son nombres (_name_words)."""
    slugs = profiled(people)
    names = _name_words(people_names, nicknames)
    is_name = lore["palabra"].astype(str).map(lambda w: strip_accents(w.lower()) in names).astype(bool)
    lore = lore[~lore["acuño"].isin(SKIP) & ~is_name]
    top = lore.sort_values(["usos", "palabra"], ascending=[False, True], kind="stable").head(LORE_TOP)
    return [
        {
            "w": t.palabra,
            "n": int(t.usos),
            "people": int(t.personas),
            "days": int(t.dias),
            "firstUse": t.primer_uso,
            "coinedBy": slug(t.acuño),
            "refersTo": slugs.get(t.responde_a) if t.responde_a_n >= LORE_MIN_REPLIES else None,
        }
        for t in top.itertuples()
    ]


def build_departures(reentries: pd.DataFrame, scenes: dict, quotes: dict, people: list[dict],
                     people_names: People, departer: str | None, lang: Lang, isolates: bool = True) -> dict:
    """departures.json: el capítulo de salidas de `departer` (nombre corto). Sin departer, `person` es None y el resto
    tiene la misma forma y tipos que con departer, todo vacío (la web usa un único esquema). complaintLabel es la
    etiqueta del chip de quejas del idioma (lang.departures.complaint_chip) y complaintCount cuántas quejas casan
    con él (scenes['complaint_chip'])."""
    if departer is None:
        reentries, scenes, quotes = pd.DataFrame(columns=REENTRY_COLUMNS), {}, {}
    slugs = profiled(people)
    when = pd.to_datetime(reentries["reentry"], errors="coerce")
    reentries, when = reentries[when.notna()], when[when.notna()]
    hours = reentries["out_hours"].dropna().astype(float)
    months = when.dt.to_period("M")
    by_month = reentries.groupby(months).size().sort_index()
    added = reentries["added_by"].value_counts().to_dict()
    complaints = sorted((scenes.get("top_complaints") or {}).items(), key=lambda kv: -kv[1])[:COMPLAINTS_TOP]
    return {
        "person": None if departer is None else {"slug": slug(departer), "name": departer},
        "reentries": int(len(reentries)),
        "byMonth": [{"month": str(m), "n": int(n)} for m, n in by_month.items()],
        "medianOutHours": round(float(hours.median()), 1) if len(hours) else 0.0,
        "under10Min": int((hours < 1 / 6).sum()),
        "over1Day": int((hours > 24).sum()),
        "maxDays": round(float(hours.max()) / 24, 1) if len(hours) else 0.0,
        "addedBy": _ranked(added, slugs),
        "scenes": {
            "days": int(scenes.get("scene_days", 0)),
            "withExit": int(scenes.get("scene_days_with_exit", 0)),
            "byYear": {str(y): int(n) for y, n in (scenes.get("by_year") or {}).items()},
        },
        "complaints": [{"text": web_text(t, people_names, lang, isolates), "n": int(n)} for t, n in complaints],
        "complaintLabel": lang.departures.complaint_chip[1],
        "complaintCount": int(scenes.get("complaint_chip", 0)),
        "quotesRepeated": [
            {"text": web_text(q["phrase"], people_names, lang, isolates), "when": iso(q["ts"]), "times": int(q["times"]),
             "people": int(q["people"])}
            for q in quotes.get("repeated", [])
        ],
        "quotesAttributed": [
            {"text": web_text(q["quote"], people_names, lang, isolates), "by": slug(q["by"]), "when": iso(q["ts"])}
            for q in quotes.get("attributed", [])
            if q["by"] not in SKIP
        ],
    }


def read_json(path: Path, default=None):
    """Sin default, el archivo es obligatorio; con default, uno ausente o vacío (0 bytes) devuelve el default."""
    if default is not None and (not path.exists() or path.stat().st_size == 0):
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def read_csv(path: Path, columns: list[str], **kw) -> pd.DataFrame:
    try:
        return pd.read_csv(path, **kw)
    except (FileNotFoundError, pd.errors.EmptyDataError):
        return pd.DataFrame(columns=columns)


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8", newline="\n")


# Frases cualitativas de la copia de la web (lista fija: los números salen siempre de facts.json).
COPY_REVIEW_KEYS = ", ".join(
    [
        "heatmap.lede", "pairs.lede", "events.lede", "records.lede", "dictionary.lede", "hero.bubbles",
        # criterios con números de método y afirmaciones cualitativas de los capítulos nuevos
        "census.timelineCriterion",
        "language.muletillasCriterion", "language.repeatedCriterion", "language.laughedCriterion",
        "language.badwordsCriterion", "language.styleCriterion", "language.laughsCriterion",
        "media.recordsCriterion", "media.linksCriterion", "media.deletedCriterion",
        "emojis.topCriterion", "emojis.signatureCriterion", "emojis.byYearCriterion",
        "rhythm.startersCriterion", "rhythm.latencyCriterion", "rhythm.streaksCriterion",
        "mentions.matrixCriterion", "awards.criterion", "profile.awardsCriterion",
    ]
)


def copy_review_message(verified_on: str, export_end: str) -> str:
    """Recordatorio de revisión de la copia (verifiedOn del config contra el fin del export); nunca lanza."""
    if verified_on >= export_end:
        return f"Copy verified on {verified_on} (export ends {export_end}): OK."
    return (
        f"Copy review: the copy was verified on {verified_on} but the export now ends on {export_end}.\n"
        f"Re-read the qualitative phrases ({COPY_REVIEW_KEYS}) and bump verifiedOn in report.config.json."
    )


BADWORDS_REVIEW_TOP = 30


def badword_review_message(hits: pd.Series, path: Path) -> str:
    """Las BADWORDS_REVIEW_TOP puteadas con más mensajes, para revisar `path` (badwords.txt) antes del deploy."""
    top = language.badword_terms(hits).most_common(BADWORDS_REVIEW_TOP)
    lines = [f"  {n:>6}  {w}" for w, n in top] or ["  (ninguna)"]
    return f"Badwords review ({path}), top {BADWORDS_REVIEW_TOP} by messages:\n" + "\n".join(lines)


def run(argv: list[str]) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="report.config.json")
    ap.add_argument("--content", default="content", help="carpeta con people.json, badwords.txt, etc.")
    ap.add_argument("--data", default="data/messages.parquet")
    ap.add_argument("--analysis", default="data/analysis")
    ap.add_argument("--out", default="web/data")
    ap.add_argument("--thresholds", choices=["derived", "legacy"], default="derived",
                    help="derived: umbrales según el tamaño del chat; legacy: los valores fijos del reporte original")
    ap.add_argument("--min-msgs", type=int, default=None, help="pisa el mínimo de mensajes para tener perfil")
    args = ap.parse_args(argv)
    out = Path(args.out)
    content = Path(args.content)

    try:
        cfg = load_config(Path(args.config))
        names = load_people(content / "people.json", me=cfg.me)
        cfg.check_people(names.short_names())
    except (ConfigError, PeopleError) as e:
        raise SystemExit(str(e)) from e
    badwords_txt = content / "badwords.txt"
    if not badwords_txt.exists():
        raise SystemExit(f"falta {badwords_txt}")

    lang = get_lang(cfg.lang)
    isolates = chat_has_isolates(args.data)  # iOS: menciones en U+2068; Android: @Nombre en texto plano
    df = load_chat(args.data, names, lang, isolates)
    th = Thresholds.legacy() if args.thresholds == "legacy" else Thresholds.derived(len(df))
    if args.min_msgs is not None:
        th = dataclasses.replace(th, profile_msgs=args.min_msgs)
    platform = detect_format(cfg.chat)["platform"]
    g = build_global(df, th, cfg.title, lang, platform, "minute" if platform == "android" else "second",
                     cfg.mode, cfg.gate)
    profiled = {f"{p['slug']}.json" for p in g["people"] if p["slug"] != "resto"}
    for old in (out / "people").glob("*.json"):  # perfiles de una corrida anterior (otro chat, otro umbral)
        if old.name not in profiled:
            old.unlink()
    people_files = {}
    for p in g["people"]:
        if p["slug"] == "resto":
            continue
        people_files[p["slug"]] = build_person(df, p["slug"], g["people"], names, lang, isolates)
        write_json(out / "people" / f"{p['slug']}.json", people_files[p["slug"]])
    write_json(out / "global.json", g)
    analysis = Path(args.analysis)

    events = build_events(read_json(analysis / "events.json", []), g["people"], names, lang, isolates)
    write_json(out / "events.json", events)
    write_json(out / "records.json", build_records(read_json(analysis / "records.json"), g["people"], names, df, lang=lang,
                                                             isolates=isolates))
    lore = read_csv(analysis / "lore_terms.csv", LORE_COLUMNS)
    nicknames = read_json(content / "nicknames.json", {})
    write_json(out / "lore.json", build_lore(lore, g["people"], names, nicknames if isinstance(nicknames, dict) else {}))
    if cfg.departer:
        reentries = read_csv(analysis / "departures.csv", REENTRY_COLUMNS, parse_dates=["reentry"])
        scenes = read_json(analysis / "departures_scenes.json", {})
        quotes = read_json(analysis / "departures_quotes.json", {})
    else:
        reentries, scenes, quotes = pd.DataFrame(columns=REENTRY_COLUMNS), {}, {}
    write_json(out / "departures.json",
               build_departures(reentries, scenes, quotes, g["people"], names, cfg.departer, lang, isolates))
    words = language.load_badwords(badwords_txt, lang)  # la lista del grupo manda (arranca de la base del idioma)
    hits = language.badword_hits(df, words, lang)
    background = load_background(args.data, df["ts"].min())
    lang_data = language.build_language(df, g["people"], names, words, th, hits, background, lang=lang)
    write_json(out / "language.json", lang_data)
    cens = census.build_census(
        load_all(args.data, names, lang, isolates), g["people"], events, read_json(analysis / "peak_days.json", []), len(reentries),
        cfg.departer, names, lang,
    )
    write_json(out / "census.json", cens)
    med = media.build_media(df, g["people"])
    write_json(out / "media.json", med)
    write_json(out / "emojis.json", emojis.build_emojis(df, g["people"], th))
    write_json(out / "polls.json", polls.build_polls(df, g["people"], th))
    rhy = rhythm.build_rhythm(df, g["people"], people_files, g["timeResolution"])
    write_json(out / "rhythm.json", rhy)
    men = mentions.build_mentions(df, g["people"], raw_bodies(args.data, df), names, lang)
    write_json(out / "mentions.json", men)
    prizes = awards_mod.build_awards(df, g, lang_data, cens, med, men, rhy, names, th, lang, g["timeResolution"])
    write_json(out / "awards.json", prizes)
    write_json(out / "facts.json", build_facts(g, people_files, analysis, departer=cfg.departer, language=lang_data,
                                               census=cens, mentions=men, rhythm=rhy, awards=prizes, thresholds=th,
                                               lang=lang))
    print(badword_review_message(hits, badwords_txt), file=sys.stderr)
    print(copy_review_message(cfg.verified_on, g["period"]["to"]), file=sys.stderr)


if __name__ == "__main__":
    run(sys.argv[1:])
