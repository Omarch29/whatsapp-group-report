"""Informe del grupo: membresía, salidas de un miembro, apodos, lore, días pico.

Uso:
    .venv/bin/python -I scripts/group_report.py [--data data/messages.parquet] [--out data/analysis]
        [--lang es|en] [--departer NOMBRE [--aliases a,b,c]]

Genera en --out:
    membership_events.csv   entradas/salidas/expulsiones/renombres del grupo
Solo con --departer (el miembro que se fue y volvió muchas veces; --aliases = cómo lo llama el chat):
    departures.csv          cada re-entrada del miembro con tiempo afuera
    departures_scenes.json  días de "escena" (celos/enojo/exclusión) con disparadores
    departures_quotes.json  frases del miembro citadas por otros + frases repetidas
Siempre:
    nicknames.json          padrón de apodos (último roster publicado) + apodos inferidos
    lore_terms.csv          palabras nacidas en el grupo, quién las acuñó, a quién refieren
    peak_days.json          días anómalos con palabras distintivas y muestra
    report.md               informe legible con todo lo anterior
"""
from __future__ import annotations

import argparse
import collections
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wa.background import lore_filter  # noqa: E402
from wa.lang import Lang, get_lang  # noqa: E402
from wa.names import People, load_people_cli  # noqa: E402
from wa.text import tokens  # noqa: E402

MENTION_RE = re.compile(r"@\u2068[^\u2069]*\u2069")

# Los disparadores de "escena" (acusaciones de otros, quejas de exclusión del miembro) y las plantillas de citas
# atribuidas son del idioma: lang.departures (wa.lang.es / wa.lang.en).


def _alias_re(aliases: list[str]) -> str:
    return "|".join(map(re.escape, aliases))


def load(path: str, chat: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    full = pd.read_parquet(path)
    full["sender"] = full["sender"].astype(str)
    group = full[full["chat"] == chat].sort_values("ts", kind="stable").reset_index(drop=True)  # same minute: chat order
    return full, group


# ---------------------------------------------------------------- membresía
# sys_event del parser -> `ev` (claves internas en castellano: las usan departures y los tests, no se publican)
MEMBERSHIP_EVENTS = {"added": "añadió", "joined_link": "link", "left": "salió", "removed": "quitó",
                     "name_changed": "nombre"}
PEOPLE_LIST_RE = re.compile(r", | y | and ")  # "Bruno, Caro y Tomi" / "Bruno, Caro and Tomi"
SPLIT_EVENTS = ("added", "removed")  # solo estos avisos pueden nombrar a varias personas
NO_BY = ("?", "-")  # "?": el aviso no dice quién; "-": no aplica


def canonical_or_sentinel(raw: str, people: People) -> str:
    """Nombre corto de `raw`; "?", "-" y el dueño (people.me, que el dataset ya resolvió) quedan como están."""
    return raw if raw in NO_BY or raw == people.me else people.canonical(raw.strip())


def _who(event: str, who: str, people: People, lang: Lang) -> list[str]:
    """Las personas de un aviso. Solo añadir/quitar se parten (un contacto cuyo nombre entero ya es conocido, como
    "Tom and Jerry", queda como uno); un cambio de nombre sin nombre nuevo se rotula lang.labels.unnamed_rename (el
    cuerpo del aviso trae nombres de contacto crudos: no se publica)."""
    if event == "name_changed":
        return [who or lang.labels.unnamed_rename]
    if event not in SPLIT_EVENTS or who in people.names or who in people.short_names():
        return [who]
    return PEOPLE_LIST_RE.split(who)


def membership(group: pd.DataFrame, people: People, lang: Lang) -> pd.DataFrame:
    """Eventos de membresía (ts, ev, quien, por, quien_c, por_c) desde las columnas estructuradas del parser
    (`sys_event`, `sys_who`, `sys_by`). Un aviso de añadir/quitar que nombra a varias personas da una fila por
    persona. `quien` es el nombre nuevo del grupo en "nombre". `por` es quien lo hizo: "?" si el aviso no lo dice
    (añadir/quitar), "-" si no aplica (salir, entrar por link). lang: el rótulo de un cambio de nombre sin nombre."""
    rows = []
    for r in group[group["sys_event"].isin(MEMBERSHIP_EVENTS)].itertuples():
        by = r.sys_by or ("?" if r.sys_event in SPLIT_EVENTS else "-")
        rows += [(r.ts, MEMBERSHIP_EVENTS[r.sys_event], w, by)
                 for w in _who(r.sys_event, r.sys_who, people, lang) if w.strip()]
    ev = pd.DataFrame(rows, columns=["ts", "ev", "quien", "por"])
    ev["quien_c"] = ev["quien"].map(lambda s: canonical_or_sentinel(s, people))
    ev["por_c"] = ev["por"].map(lambda s: canonical_or_sentinel(s, people))
    return ev


# ---------------------------------------------------------------- salidas de un miembro
def _entries(ev: pd.DataFrame, name: str) -> pd.DataFrame:
    """Entradas únicas de `name` (añadido o link); "añadió" + "Se añadió" duplican el mismo evento: dedup a 5 minutos."""
    ent = ev[(ev["quien_c"] == name) & ev["ev"].isin(["añadió", "link"])].sort_values("ts", kind="stable")
    return ent[ent["ts"].diff().dt.total_seconds().fillna(1e9) > 300]


def departure_candidates(ev: pd.DataFrame) -> list[tuple[str, int]]:
    """Personas con re-entradas verdaderas (añadido o link DESPUÉS de una salida/expulsión de la misma persona),
    de más a menos. La primera entrada nunca cuenta; si nadie se fue, la lista es vacía."""
    leaves = ev[ev["ev"].isin(["salió", "quitó"])].groupby("quien_c")["ts"].min()
    counts = {}
    for name, first_leave in leaves.items():
        n = int((_entries(ev, name)["ts"] > first_leave).sum())
        if n:
            counts[name] = n
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))


def departer_reentries(group: pd.DataFrame, ev: pd.DataFrame, name: str) -> pd.DataFrame:
    ent = _entries(ev, name)
    mk = group[(group["sender"] == name) & (group["kind"] != "system")]
    rows = []
    for _, e in ent.iterrows():
        before = mk[mk["ts"] < e["ts"]]["ts"]
        after = mk[mk["ts"] > e["ts"]]["ts"]
        rows.append((e["ts"], before.max() if len(before) else pd.NaT, after.min() if len(after) else pd.NaT, e["ev"], e["por_c"]))
    r = pd.DataFrame(rows, columns=["reentry", "last_msg_before", "first_msg_after", "how", "added_by"])
    for c in ("reentry", "last_msg_before", "first_msg_after"):
        r[c] = pd.to_datetime(r[c])  # dtype datetime también sin filas
    r["out_hours"] = (r["reentry"] - r["last_msg_before"]).dt.total_seconds() / 3600
    r["back_minutes"] = (r["first_msg_after"] - r["reentry"]).dt.total_seconds() / 60
    return r


def departer_scenes(group: pd.DataFrame, reentries: pd.DataFrame, name: str, aliases: list[str], lang: Lang) -> dict:
    """Días de escena del miembro: acusaciones de otros (lang.departures.accuse + un alias) y quejas suyas
    (lang.departures.complain). complaint_chip = sus quejas que son las del chip (lang.departures.complaint_chip[0],
    "no me invit")."""
    pats = lang.departures
    t = group[group["kind"] == "text"]
    acc = t[(t["sender"] != name) & t["body"].str.contains(pats.accuse, case=False, regex=True) & t["body"].str.contains(_alias_re(aliases), case=False, regex=True)]
    comp = t[(t["sender"] == name) & t["body"].str.contains(pats.complain, case=False, regex=True)]
    comp_days = comp.groupby("date").size()
    comp_days2 = set(comp_days[comp_days >= 2].index)
    acc_days = set(acc["date"])
    re_days = set(reentries["reentry"].dt.date)
    scenes = sorted(acc_days | comp_days2)
    out = []
    for d in scenes:
        out.append(
            {
                "date": str(d),
                "left_group": d in re_days,
                "accusations": acc[acc["date"] == d]["body"].head(3).tolist(),
                "complaints": comp[comp["date"] == d]["body"].head(3).tolist(),
            }
        )
    norm = comp["body"].str.lower().str.replace(r"[^\wáéíóúñ ]", "", regex=True).str.strip()
    return {
        "days_with_accusations": len(acc_days),
        "days_with_2plus_complaints": len(comp_days2),
        "scene_days": len(scenes),
        "scene_days_with_exit": len(set(scenes) & re_days),
        "by_year": dict(collections.Counter(d.year for d in scenes)),
        "top_complaints": norm.value_counts().head(15).to_dict(),
        "total_complaint_msgs": int(len(comp)),
        "complaint_chip": int(comp["body"].str.contains(pats.complaint_chip[0], case=False, regex=True).sum()),
        "total_accusation_msgs": int(len(acc)),
        "scenes": out,
    }


def departer_quotes(group: pd.DataFrame, aliases: list[str], lang: Lang) -> dict:
    """Frases del miembro: las que otros le atribuyen (por alias, con lang.departures.quote_templates) y las suyas que
    otros repitieron.
    `aliases` debe incluir su nombre corto (el remitente en el chat), sin distinguir mayúsculas;
    `run()` es el único lugar que lo antepone, quien llame directo debe hacerlo."""
    t = group[group["kind"] == "text"]
    is_departer = t["sender"].str.lower().isin({a.lower() for a in aliases})
    others = t[~is_departer]
    attributed = []
    for p in (q.format(names=_alias_re(aliases)) for q in lang.departures.quote_templates):
        ex = others["body"].str.extract(p)[0].dropna()
        for i, q in ex.items():
            attributed.append({"ts": str(others.loc[i, "ts"]), "by": others.loc[i, "sender"], "quote": q.strip()})
    attributed.sort(key=lambda x: x["ts"])

    def norm(s: str) -> list[str]:
        return re.sub(r"[^\wáéíóúñ ]", " ", MENTION_RE.sub("", s).lower()).split()

    mk = t[is_departer &  t["n_chars"].between(15, 120) & ~t["body"].str.contains("http")]
    gram_first: dict[str, tuple] = {}
    for _, r in mk.iterrows():
        w = norm(r["body"])
        for i in range(len(w) - 4):
            g = " ".join(w[i : i + 5])
            gram_first.setdefault(g, (r["ts"], r["body"]))
    cnt: collections.Counter = collections.Counter()
    who: dict[str, set] = collections.defaultdict(set)
    for _, r in others.iterrows():
        w = norm(r["body"])
        seen = set()
        for i in range(len(w) - 4):
            g = " ".join(w[i : i + 5])
            if g in gram_first and gram_first[g][0] < r["ts"] and g not in seen:
                seen.add(g)
                cnt[g] += 1
                who[g].add(r["sender"])
    repeated = []
    shown = set()
    for g, c in cnt.most_common(500):
        if c < 3 or len(who[g]) < 2:
            continue
        ts, body = gram_first[g]
        if body in shown or MENTION_RE.search(body) or len(norm(body)) < 5:
            continue
        shown.add(body)
        repeated.append({"ts": str(ts), "phrase": body, "times": c, "people": len(who[g])})
        if len(repeated) >= 40:
            break
    return {"attributed": attributed, "repeated": repeated}


# ---------------------------------------------------------------- apodos y lore
def nickname_roster(group: pd.DataFrame) -> dict:
    """Último 'padrón' publicado en el chat con el formato 'apodo => persona'."""
    t = group[(group["kind"] == "text") & (group["body"].str.count("=>") >= 10)].sort_values("ts", kind="stable")
    if t.empty:
        return {}
    body = t.iloc[-1]["body"]
    roster = {}
    for line in body.splitlines():
        if m := re.match(r"\s*(.+?)\s*(?:=>|:)\s*(.+?)\s*$", line):
            roster[m.group(1).strip()] = m.group(2).strip()
    return {"ts": str(t.iloc[-1]["ts"]), "by": t.iloc[-1]["sender"], "roster": roster}


def background_rows(full: pd.DataFrame, chat: str) -> pd.DataFrame | None:
    """Textos de los chats que no son `chat` anteriores a su primer mensaje; None si no hay chats de fondo."""
    start = full.loc[full["chat"] == chat, "ts"].min()
    bg = full[(full["chat"] != chat) & (full["ts"] < start) & (full["kind"] == "text")]
    return None if bg.empty else bg


def lore_terms(main: pd.DataFrame, lang: Lang, bg: pd.DataFrame | None, min_uses: int = 20) -> pd.DataFrame:
    """Palabras frecuentes del chat (wa.text.tokens con las stopwords de `lang`) que no son del fondo: con chats de
    fondo (`bg`, de background_rows) las que ahí casi no aparecen; sin ellos, las que no son de uso corriente en el
    idioma (wa.background.lore_filter con lang.code)."""
    bgc = None
    if bg is not None:
        bgc = collections.Counter()
        for b in bg["body"]:
            bgc.update(tokens(MENTION_RE.sub("", b), lang))
    t = main[main["kind"] == "text"]
    prev_sender = main["sender"].shift(1)
    prev_ts = main["ts"].shift(1)
    cnt: collections.Counter = collections.Counter()
    senders: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    refers: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    first: dict[str, tuple] = {}
    days: dict[str, set] = collections.defaultdict(set)
    for i, r in t.iterrows():
        ws = set(tokens(MENTION_RE.sub("", r["body"]), lang))
        is_reply = prev_sender[i] != r["sender"] and (r["ts"] - prev_ts[i]).total_seconds() < 180
        for w in ws:
            cnt[w] += 1
            senders[w][r["sender"]] += 1
            days[w].add(r["date"])
            first.setdefault(w, (r["ts"], r["sender"], r["body"]))
            if is_reply:
                refers[w][prev_sender[i]] += 1
    rows = []
    for w, c in lore_filter(cnt, lang.code, bgc).items():
        if c < min_uses or len(senders[w]) < 3:
            continue
        ts, s, body = first[w]
        ref = refers[w].most_common(1)
        rows.append(
            {
                "palabra": w,
                "usos": c,
                "personas": len(senders[w]),
                "dias": len(days[w]),
                "primer_uso": str(ts.date()),
                "acuño": s,
                "primer_mensaje": body[:120],
                "mas_usa": senders[w].most_common(1)[0][0],
                "responde_a": ref[0][0] if ref else "",
                "responde_a_n": ref[0][1] if ref else 0,
            }
        )
    cols = ["palabra", "usos", "personas", "dias", "primer_uso", "acuño", "primer_mensaje", "mas_usa", "responde_a", "responde_a_n"]
    return pd.DataFrame(rows, columns=cols).sort_values("usos", ascending=False, kind="stable")


# ---------------------------------------------------------------- eventos
PEAK_BIG_DAY = 200  # mensajes de texto desde los que un día es "grande" para el piso de palabras clave
PEAK_FLOOR_BIG, PEAK_FLOOR_SMALL = 4, 2  # veces que una palabra tiene que aparecer ese día (día grande / chico)
PEAK_SAMPLE, PEAK_SAMPLE_KW, PEAK_SAMPLE_TOP = 8, 5, 5  # muestra; de ella, cuántos con una de las primeras palabras


def peak_days(group: pd.DataFrame, lang: Lang, n: int = 30) -> list[dict]:
    """Los `n` días con más mensajes respecto de la mediana móvil, con sus palabras distintivas (tokens de `lang`).

    Una palabra clave aparece ese día al menos 4 veces si el día tiene 200 mensajes de texto o más, 2 si no. La muestra
    (a lo sumo 8, cronológica, de ±1 h de la hora pico y 30 caracteres o más) lleva primero hasta 5 mensajes que
    contienen alguna de las 5 primeras palabras clave y se completa al azar; random_state=1, reproducible."""
    daily = group.groupby("date").size()
    base = daily.rolling(28, min_periods=7, center=True).median()
    ratio = (daily / base).dropna().sort_values(ascending=False, kind="stable")
    t = group[group["kind"] == "text"]
    docfreq: collections.Counter = collections.Counter()
    day_tokens, day_texts = {}, {}
    for d, g in t.groupby("date"):
        c: collections.Counter = collections.Counter()
        for b in g["body"]:
            c.update(tokens(MENTION_RE.sub("", b), lang))
        day_tokens[d], day_texts[d] = c, len(g)
        docfreq.update(c.keys())
    N = len(day_tokens)
    out = []
    for d, rt in ratio.head(n).items():
        c = day_tokens.get(d, collections.Counter())
        tot = sum(c.values()) or 1
        floor = PEAK_FLOOR_BIG if day_texts.get(d, 0) >= PEAK_BIG_DAY else PEAK_FLOOR_SMALL
        kw = sorted(((w, (k / tot) * math.log(N / docfreq[w])) for w, k in c.items() if k >= floor), key=lambda x: -x[1])[:10]
        keywords = [w for w, _ in kw]
        g = t[(t["date"] == d) & (t["n_chars"] >= 30)]
        hr = int(group[group["date"] == d]["hour"].value_counts().idxmax())
        window = g[g["hour"].between(hr - 1, hr + 1)]
        sample = window
        if len(window):
            top = set(keywords[:PEAK_SAMPLE_TOP])
            has_kw = window["body"].map(lambda b: bool(top.intersection(tokens(MENTION_RE.sub("", b), lang)))).astype(bool)
            with_kw = window[has_kw]
            picked = with_kw.sample(min(PEAK_SAMPLE_KW, len(with_kw)), random_state=1)
            rest = window.drop(picked.index)
            filled = rest.sample(min(PEAK_SAMPLE - len(picked), len(rest)), random_state=1)
            # chat order: by time, and within a minute (Android keeps no seconds) by position in the chat
            sample = pd.concat([picked, filled]).sort_index().sort_values("ts", kind="stable")
        out.append(
            {
                "date": str(d),
                "msgs": int(daily[d]),
                "ratio": round(float(rt), 1),
                "peak_hour": hr,
                "top_senders": group[group["date"] == d]["sender"].value_counts().head(3).to_dict(),
                "keywords": keywords,
                "sample": [f"{r['ts']:%H:%M} {r['sender']}: {r['body'][:140]}" for _, r in sample.iterrows()],
            }
        )
    return out


# ---------------------------------------------------------------- informe
def write_report(out: Path, ev, departures: dict | None, roster, lore, peaks, group) -> None:
    """departures = {"name", "reentries", "scenes", "quotes"} o None (grupo sin capítulo de salidas)."""
    L = []
    a = L.append
    a("# Informe de análisis del grupo\n")
    a(f"Período: {group['ts'].min():%Y-%m-%d} a {group['ts'].max():%Y-%m-%d}. Mensajes: {len(group):,}.\n")

    a("## Membresía\n")
    mem = ev[ev["ev"].isin(["añadió", "link", "salió", "quitó"])]
    tab = mem.groupby(["quien_c", "ev"]).size().unstack(fill_value=0)
    tab["entradas"] = tab.get("añadió", 0) + tab.get("link", 0)
    a(tab.sort_values("entradas", ascending=False, kind="stable").head(15).to_markdown())
    a(f"\nQuién agrega gente: {mem[mem['ev']=='añadió']['por_c'].value_counts().to_dict()}")
    a(f"\nQuién echa gente: {mem[mem['ev']=='quitó']['por_c'].value_counts().to_dict()}\n")
    a("Cambios de nombre del grupo:\n")
    for _, r in ev[ev["ev"] == "nombre"].iterrows():
        a(f"- {r['ts']:%Y-%m-%d}: {r['quien']}")

    if departures is None:
        a("\n## Salidas\n")
        a("Informe sin capítulo de salidas (no se indicó --departer).")
    else:
        name, re_, scenes, quotes = departures["name"], departures["reentries"], departures["scenes"], departures["quotes"]
        a(f"\n## {name}: salidas y vueltas\n")
        a(f"- Re-entradas únicas: **{len(re_)}** (por link {int((re_['how']=='link').sum())}, agregado {int((re_['how']=='añadió').sum())}).")
        a(f"- Lo agregó: {re_['added_by'].value_counts().to_dict()}")
        a(f"- Tiempo afuera: mediana {re_['out_hours'].median():.1f} h, p25 {re_['out_hours'].quantile(.25):.1f} h, p75 {re_['out_hours'].quantile(.75):.1f} h, máximo {re_['out_hours'].max()/24:.1f} días.")
        a(f"- Salidas relámpago (<1 h afuera): {int((re_['out_hours']<1).sum())}; <10 min: {int((re_['out_hours']<1/6).sum())}; >1 día: {int((re_['out_hours']>24).sum())}.")
        a(f"- Minutos hasta su primer mensaje al volver: mediana {re_['back_minutes'].median():.1f}.")
        a(f"- Por mes: {re_.groupby(re_['reentry'].dt.to_period('M')).size().to_dict()}")

        a(f"\n## {name}: escenas de celos / enojo / exclusión\n")
        a(f"- Días con acusación explícita de otros (celos, enojado, escena, drama): **{scenes['days_with_accusations']}** ({scenes['total_accusation_msgs']} mensajes).")
        a(f"- Días con 2+ quejas de exclusión de {name} ('no me invitó', 'sin mí', 'me dejaron afuera'...): **{scenes['days_with_2plus_complaints']}** ({scenes['total_complaint_msgs']} mensajes).")
        a(f"- Días de escena (unión): **{scenes['scene_days']}**, de los cuales {scenes['scene_days_with_exit']} coinciden con una salida del grupo. Por año: {scenes['by_year']}.")
        a(f"- Quejas más repetidas: {scenes['top_complaints']}")

        a(f"\n## {name}: frases\n")
        a("Citas que otros le atribuyen:\n")
        for q in quotes["attributed"]:
            a(f"- {q['ts'][:10]} ({q['by']}): «{q['quote']}»")
        a("\nFrases suyas que otros repitieron después:\n")
        for q in quotes["repeated"]:
            a(f"- {q['times']}x por {q['people']} personas, desde {q['ts'][:10]}: «{q['phrase']}»")

    a("\n## Apodos\n")
    if roster:
        a(f"Padrón publicado el {roster['ts'][:10]} por {roster['by']}:\n")
        for k, v in roster["roster"].items():
            a(f"- {k} → {v}")
    a("\nPalabras nacidas en el grupo (apodos, muletillas, lore), con quién las acuñó y a quién suelen responder:\n")
    a(lore.head(80)[["palabra", "usos", "personas", "dias", "primer_uso", "acuño", "responde_a", "responde_a_n"]].to_markdown(index=False))
    if departures is not None:
        a(f"\nAcuñadas por {departures['name']}:\n")
        a(lore[lore["acuño"] == departures["name"]][["palabra", "usos", "personas", "dias", "primer_uso", "primer_mensaje"]].to_markdown(index=False))

    a("\n## Días pico (candidatos a eventos)\n")
    for p in peaks:
        a(f"### {p['date']} · {p['msgs']} mensajes (x{p['ratio']}) · pico {p['peak_hour']}h · {p['top_senders']}")
        a(f"Palabras: {', '.join(p['keywords'])}\n")
        for s in p["sample"]:
            a(f"> {s}")
        a("")
    (out / "report.md").write_text("\n".join(L), encoding="utf-8")


def run(argv: list[str]) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/messages.parquet")
    ap.add_argument("--chat", default="main")
    ap.add_argument("--out", default="data/analysis")
    ap.add_argument("--lang", choices=["es", "en"], default="es", help="idioma del chat (wa.lang)")
    ap.add_argument("--people", default="content/people.json")
    ap.add_argument("--me", default=None, help="nombre corto del dueño del export (pisa al de --people)")
    ap.add_argument("--departer", default=None, help="nombre corto del miembro con capítulo de salidas (sin él no se genera)")
    ap.add_argument("--aliases", default=None, help="cómo lo llama el chat, separados por coma (default: su nombre corto)")
    args = ap.parse_args(argv)
    lang = get_lang(args.lang)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    full, group = load(args.data, args.chat)

    ev = membership(group, load_people_cli(args.people, me=args.me), lang)
    ev.to_csv(out / "membership_events.csv", index=False)
    departures = None
    if args.departer:
        aliases = list(dict.fromkeys([args.departer, *(x.strip() for x in (args.aliases or "").split(",") if x.strip())]))
        re_ = departer_reentries(group, ev, args.departer)
        re_.to_csv(out / "departures.csv", index=False)
        scenes = departer_scenes(group, re_, args.departer, aliases, lang)
        (out / "departures_scenes.json").write_text(json.dumps(scenes, ensure_ascii=False, indent=1, default=str))
        quotes = departer_quotes(group, aliases, lang)
        (out / "departures_quotes.json").write_text(json.dumps(quotes, ensure_ascii=False, indent=1))
        departures = {"name": args.departer, "reentries": re_, "scenes": scenes, "quotes": quotes}
    roster = nickname_roster(group)
    (out / "nicknames.json").write_text(json.dumps(roster, ensure_ascii=False, indent=1))
    lore = lore_terms(group, lang, background_rows(full, args.chat))
    lore.to_csv(out / "lore_terms.csv", index=False)
    peaks = peak_days(group, lang)
    (out / "peak_days.json").write_text(json.dumps(peaks, ensure_ascii=False, indent=1))
    write_report(out, ev, departures, roster, lore, peaks, group)
    print(f"-> {out}/report.md", file=sys.stderr)


def main() -> None:
    run(sys.argv[1:])


if __name__ == "__main__":
    main()
