"""Perfil estadístico de una persona a partir del dataset Parquet.

Uso:
    .venv/bin/python -I scripts/profile.py --person Ana [--lang es] -o out/profile_ana.json

Imprime un informe en Markdown por stdout y guarda el JSON con todos los números.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wa.lang import Lang, get_lang  # noqa: E402
from wa.text import emojis, is_laugh, tokens  # noqa: E402

DOW = get_lang("es").dow  # herramienta de desarrollo: los días de profile() salen de su `lang`
REPLY_WINDOW = pd.Timedelta(minutes=10)
KEYWORDS = {  # temas cotidianos: cuántas veces los nombra la persona y quiénes más del resto
    "trabajo": r"\btrabaj(?:o|ar|ando)\b|\blabur(?:o|ar|ando)\b",
    "gimnasio": r"\bgym\b|\bgimnasio\b",
    "asado": r"\basado\b|\bparrilla\b",
    "comida": r"\bpizza\b|\bempanadas?\b|\bsushi\b",
    "cerveza": r"\bcerveza\b|\bbirra\b",
    "mate": r"\bmate\b",
    "familia": r"\bmi (?:mam[aá]|pap[aá]|hermana|hermano|abuela|abuelo)\b",
    "pareja": r"\bmi (?:novia|novio)\b",
    "película": r"\bpel[ií]cula\b|\bpeli\b",
    "serie": r"\bserie\b",
    "fútbol": r"\bf[úu]tbol\b|\bpartido\b",
    "viaje": r"\bviaje\b|\bvacaciones\b",
    "lluvia": r"\bllueve\b|\blluvia\b",
    "cumpleaños": r"\bcumple(?:años)?\b",
    "amor": r"\bte amo\b|\bte quiero\b",
    "perdón": r"\bperd[óo]n\b",
}


MENTION_RE = re.compile(r"@\u2068[^\u2069]*\u2069|@\S+")


def load(path: str) -> pd.DataFrame:
    df = pd.read_parquet(path)
    df = df[~df["is_system"]].copy()
    df["sender"] = df["sender"].astype(str)
    # Las menciones (@⁨Nombre Completo⁩) contaminan palabras y emojis: se quitan del cuerpo.
    df["body"] = df["body"].str.replace(MENTION_RE, "@mention", regex=True)
    return df


def reply_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Para cada mensaje, quién fue el emisor anterior distinto (dentro de la ventana)."""
    out = []
    for chat, g in df.groupby("chat", observed=True):
        g = g.sort_values("ts", kind="stable")
        prev_sender = g["sender"].shift(1)
        prev_ts = g["ts"].shift(1)
        same = prev_sender == g["sender"]
        # retrocede hasta encontrar un emisor distinto: aproximación con ffill sobre cambios
        changed = ~same
        last_other = g["sender"].where(changed).shift(1).ffill()
        last_other_ts = g["ts"].where(changed).shift(1).ffill()
        sub = pd.DataFrame(
            {
                "chat": chat,
                "sender": g["sender"],
                "replies_to": last_other,
                "gap": (g["ts"] - last_other_ts),
                "is_new_turn": changed,
            },
            index=g.index,
        )
        out.append(sub)
    r = pd.concat(out)
    r = r[r["is_new_turn"] & (r["gap"] <= REPLY_WINDOW) & (r["replies_to"] != r["sender"])]
    return r


def profile(df: pd.DataFrame, person: str, lang: Lang) -> dict:
    """Números de `person` en df; `lang` (wa.lang) da los días de la semana, las stopwords y las risas."""
    me = df[df["sender"] == person]
    others = df[df["sender"] != person]
    text_me = me[me["kind"] == "text"]
    text_others = others[others["kind"] == "text"]
    res: dict = {"person": person}

    # Volumen
    res["total_msgs"] = int(len(me))
    res["share_of_all"] = round(len(me) / len(df), 4)
    res["by_chat"] = me["chat"].value_counts().to_dict()
    res["by_year"] = me.groupby("year").size().to_dict()
    res["rank_by_year"] = {
        int(y): [s for s, _ in g["sender"].value_counts().head(5).items()]
        for y, g in df.groupby("year")
    }
    res["kinds"] = me["kind"].value_counts().to_dict()
    kinds_all = df.groupby("sender")["kind"].value_counts().unstack(fill_value=0)
    res["rank_in_kind"] = {k: kinds_all[k].sort_values(ascending=False, kind="stable").head(5).to_dict() for k in ["audio", "image", "sticker", "deleted", "video", "poll", "location"] if k in kinds_all}
    res["edited_msgs"] = int(me["edited"].sum())
    res["edited_rank"] = df.groupby("sender")["edited"].sum().sort_values(ascending=False, kind="stable").head(5).to_dict()

    # Tiempo
    hours = me["hour"].value_counts().sort_index()
    res["hour_dist"] = hours.to_dict()
    res["peak_hour"] = int(hours.idxmax())
    res["late_night_share"] = round(float(me["hour"].isin([0, 1, 2, 3, 4, 5]).mean()), 4)
    res["late_night_rank"] = df.groupby("sender")["hour"].apply(lambda h: h.isin([0, 1, 2, 3, 4, 5]).mean()).sort_values(ascending=False, kind="stable").head(6).round(3).to_dict()
    dow = me["dow"].value_counts().sort_index()
    res["dow_dist"] = {lang.dow[i]: int(v) for i, v in dow.items()}
    res["peak_dow"] = lang.dow[int(dow.idxmax())]
    daily = me.groupby("date").size()
    res["busiest_day"] = {"date": str(daily.idxmax()), "msgs": int(daily.max())}
    all_daily = df.groupby("date").size()
    res["busiest_day_group"] = {"date": str(all_daily.idxmax()), "msgs": int(all_daily.max())}
    # racha de días consecutivos escribiendo / silencio más largo
    days = pd.to_datetime(pd.Series(sorted(daily.index)))
    gaps = days.diff().dt.days.fillna(1)
    streak_id = (gaps > 1).cumsum()
    streaks = days.groupby(streak_id).agg(["min", "max", "count"])
    # tie on length: the earliest streak wins (streaks are built in date order and the sort is stable)
    best = streaks.sort_values("count", ascending=False, kind="stable").iloc[0]
    res["longest_streak"] = {"days": int(best["count"]), "from": str(best["min"].date()), "to": str(best["max"].date())}
    silence_idx = gaps.idxmax()
    res["longest_silence"] = {"days": int(gaps.max()), "from": str(days[silence_idx - 1].date()), "to": str(days[silence_idx].date())}
    res["first_message"] = {"ts": str(me["ts"].min()), "body": str(me.sort_values("ts", kind="stable").iloc[0]["body"])[:200]}
    res["active_days"] = int(len(daily))
    res["avg_msgs_per_active_day"] = round(float(daily.mean()), 1)

    # Texto
    res["avg_chars"] = round(float(text_me["n_chars"].mean()), 1)
    res["avg_chars_rank"] = text_others.groupby("sender")["n_chars"].mean().sort_values(ascending=False, kind="stable").head(8).round(1).to_dict()
    longest = text_me.sort_values("n_chars", ascending=False, kind="stable").iloc[0]
    res["longest_message"] = {"ts": str(longest["ts"]), "chars": int(longest["n_chars"]), "body": str(longest["body"])[:1500]}
    laugh = lambda s: is_laugh(s, lang)  # noqa: E731
    res["laugh_msgs_share"] = round(float(text_me["body"].map(laugh).mean()), 4)
    laughs = Counter(w.lower() for b in text_me["body"] for w in b.split() if laugh(w))
    res["top_laughs"] = laughs.most_common(8)
    res["laugh_share_rank"] = text_others.groupby("sender")["body"].apply(lambda s: s.map(laugh).mean()).sort_values(ascending=False, kind="stable").head(6).round(3).to_dict()

    cnt_me = Counter()
    for b in text_me["body"]:
        cnt_me.update(tokens(b, lang))
    cnt_others = Counter()
    for b in text_others["body"]:
        cnt_others.update(tokens(b, lang))
    tot_me = sum(cnt_me.values())
    tot_others = sum(cnt_others.values())
    res["top_words"] = cnt_me.most_common(40)
    # palabras firma: muy usadas por mí en proporción al resto
    sig = []
    for w, c in cnt_me.items():
        if c < 40:
            continue
        ratio = (c / tot_me) / ((cnt_others.get(w, 0) + 1) / tot_others)
        sig.append((w, c, round(ratio, 1)))
    sig.sort(key=lambda x: -x[2])
    res["signature_words"] = sig[:40]

    bigrams = Counter()
    for b in text_me["body"]:
        t = tokens(b, lang, keep_stop=True)
        bigrams.update(zip(t, t[1:]))
    res["top_bigrams"] = [(" ".join(k), v) for k, v in bigrams.most_common(40)]

    em = Counter()
    for b in text_me["body"]:
        em.update(emojis(b))
    res["top_emojis"] = em.most_common(20)
    res["emoji_msgs_share"] = round(float(text_me["body"].map(lambda s: bool(emojis(s))).mean()), 4)

    # Palabras clave
    kw = {}
    for name, pat in KEYWORDS.items():
        mine = int(text_me["body"].str.contains(pat, case=False, regex=True).sum())
        by_sender = text_others["body"].str.contains(pat, case=False, regex=True).groupby(text_others["sender"]).sum().sort_values(ascending=False, kind="stable").head(3)
        kw[name] = {"me": mine, "top_others": by_sender.to_dict()}
    res["keywords"] = kw

    # Menciones del nombre
    name_pat = r"\b" + person.lower() + r"\b"
    mentions = text_others[text_others["body"].str.lower().str.contains(name_pat, regex=True)]
    res["mentioned_by"] = mentions["sender"].value_counts().head(8).to_dict()
    res["mentions_total"] = int(len(mentions))

    # Interacciones
    rm = reply_matrix(df)
    mine_r = rm[rm["sender"] == person]
    res["replies_to"] = mine_r["replies_to"].value_counts().head(8).to_dict()
    to_me = rm[rm["replies_to"] == person]
    res["replied_by"] = to_me["sender"].value_counts().head(8).to_dict()
    res["median_reply_seconds"] = int(mine_r["gap"].median().total_seconds())
    res["median_reply_rank"] = rm.groupby("sender")["gap"].median().dt.total_seconds().sort_values(kind="stable").head(8).astype(int).to_dict()

    # Conversaciones iniciadas (mensaje tras > 3h de silencio) y "matadas" (último antes de > 3h)
    starts = Counter()
    kills = Counter()
    for chat, g in df.groupby("chat", observed=True):
        g = g.sort_values("ts", kind="stable")
        gap_before = g["ts"].diff()
        gap_after = -g["ts"].diff(-1)
        starts.update(g.loc[gap_before > pd.Timedelta(hours=3), "sender"])
        kills.update(g.loc[gap_after > pd.Timedelta(hours=3), "sender"])
    res["conversation_starters"] = dict(starts.most_common(8))
    res["conversation_killers"] = dict(kills.most_common(8))

    # Mensajes de sistema que me involucran (cambios de nombre del grupo, etc.)
    return res


def to_markdown(p: dict) -> str:
    L = []
    a = L.append
    a(f"# Perfil de {p['person']}\n")
    a(f"- Mensajes totales: **{p['total_msgs']:,}** ({p['share_of_all']:.1%} del total). Por chat: {p['by_chat']}")
    a(f"- Por año: {p['by_year']}")
    a(f"- Ranking top-5 por año: {json.dumps(p['rank_by_year'], ensure_ascii=False)}")
    a(f"- Tipos: {p['kinds']}")
    a(f"- Ranking por tipo (top 5): {json.dumps(p['rank_in_kind'], ensure_ascii=False)}")
    a(f"- Mensajes editados: {p['edited_msgs']} (ranking: {p['edited_rank']})")
    a(f"- Hora pico: **{p['peak_hour']}h**. Distribución: {p['hour_dist']}")
    a(f"- Madrugada (0-5h): {p['late_night_share']:.1%} de sus mensajes. Ranking madrugadores: {p['late_night_rank']}")
    a(f"- Día pico: **{p['peak_dow']}**. {p['dow_dist']}")
    a(f"- Día más activo: {p['busiest_day']}. Día más activo del grupo: {p['busiest_day_group']}")
    a(f"- Racha más larga escribiendo todos los días: {p['longest_streak']}")
    a(f"- Silencio más largo: {p['longest_silence']}")
    a(f"- Primer mensaje: {p['first_message']}")
    a(f"- Días activos: {p['active_days']}, promedio {p['avg_msgs_per_active_day']} msgs/día activo")
    a(f"- Largo promedio: {p['avg_chars']} chars. Ranking otros: {p['avg_chars_rank']}")
    a(f"- Mensaje más largo ({p['longest_message']['chars']} chars, {p['longest_message']['ts']}):\n\n> {p['longest_message']['body'][:600]}\n")
    a(f"- Mensajes que son solo risa: {p['laugh_msgs_share']:.1%}. Risas favoritas: {p['top_laughs']}. Ranking otros: {p['laugh_share_rank']}")
    a(f"- Top palabras: {p['top_words']}")
    a(f"- Palabras firma (ratio vs resto): {p['signature_words']}")
    a(f"- Top bigramas: {p['top_bigrams']}")
    a(f"- Top emojis: {p['top_emojis']} (en {p['emoji_msgs_share']:.1%} de sus mensajes)")
    a(f"- Palabras clave: {json.dumps(p['keywords'], ensure_ascii=False)}")
    a(f"- Lo nombran ({p['mentions_total']} veces): {p['mentioned_by']}")
    a(f"- A quién responde: {p['replies_to']}")
    a(f"- Quién le responde: {p['replied_by']}")
    a(f"- Mediana de tiempo de respuesta: {p['median_reply_seconds']}s. Ranking más rápidos: {p['median_reply_rank']}")
    a(f"- Arranca conversaciones (ranking): {p['conversation_starters']}")
    a(f"- Mata conversaciones (ranking): {p['conversation_killers']}")
    return "\n".join(L)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/messages.parquet")
    ap.add_argument("--person", default="Ana")
    ap.add_argument("--chat", default=None, help="limitar a un chat (p. ej. main)")
    ap.add_argument("--lang", choices=["es", "en"], default="es", help="idioma del chat")
    ap.add_argument("-o", "--output", default=None)
    args = ap.parse_args()
    df = load(args.data)
    if args.chat:
        df = df[df["chat"] == args.chat]
    p = profile(df, args.person, get_lang(args.lang))
    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(json.dumps(p, ensure_ascii=False, indent=1, default=str))
    print(to_markdown(p))


if __name__ == "__main__":
    main()
