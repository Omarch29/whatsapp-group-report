"""Capítulo Ritmo.

- starters / killers: quién manda el primer mensaje después de más de 3 h de silencio y quién el último antes de un
  silencio así (build_web_data.conversation_counts, la misma definición que global.json). Todas las personas con
  perfil, con 0 si nunca arrancaron o mataron, de mayor a menor (empates por slug).
- respuestas (replies): cada cambio de turno, un mensaje cuyo mensaje inmediatamente anterior en el chat es de otra
  persona, a más de 0 s (con 0 s los mensajes se cruzaron: nadie respondió a nadie) y a lo sumo REPLY_WINDOW (los
  10 min de profile.REPLY_WINDOW). Con time_resolution "minute" (Android no guarda segundos) un gap de 0 es una
  respuesta dentro del mismo minuto y cuenta: las medianas pueden ser 0 s (la web avisa la resolución). gap = ts - ts del mensaje anterior (el último del turno ajeno, no el primero como
  en profile.reply_matrix, que sigue intacto para los perfiles). df es un solo chat (load_chat).
- latency: medianToSec = mediana de las respuestas que recibe cada uno (de cualquiera, con perfil o no);
  medianFromSec = mediana de las suyas; n = cuántas respuestas mandó. Entra quien mandó y recibió al menos una.
- fastest: la respuesta más rápida entre dos personas con perfil, los dos mensajes de kind "text"; `a` (el mensaje
  anterior) termina en "?" o tiene al menos FASTEST_A_CHARS caracteres, `b` (la respuesta) tiene al menos
  FASTEST_B_WORDS palabras y FASTEST_B_CHARS caracteres. Gana el menor gap; en empate, primero un `a` que termina en
  "?" con a lo sumo FASTEST_A_MAX caracteres, si no un `a` de a lo sumo FASTEST_A_MAX, si no cualquiera; dentro de
  cada grupo, el más reciente. seconds = b - a. None si no hay ninguna.
- streaks: racha de días seguidos escribiendo y silencio más largo de cada uno, tal cual vienen en people/<slug>.json
  (records.streak, records.silence): no se recalculan.
- rings: mensajes de todo el grupo por día de la semana (0 = lunes) y por mes del año (0 = enero).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from web.common import export_text, msg_ref, ranked  # noqa: E402

REPLY_WINDOW = pd.Timedelta(minutes=10)  # = profile.REPLY_WINDOW
FASTEST_A_CHARS = 12
FASTEST_B_WORDS = 2
FASTEST_B_CHARS = 6
FASTEST_A_MAX = 80  # un "a" más largo no se lee en un segundo: no cuenta como pregunta respondida


def _counts(series: pd.Series, slugs: dict[str, str]) -> list[dict]:
    return ranked(pd.Series({name: int(series.get(name, 0)) for name in slugs}), slugs)


def replies(df: pd.DataFrame, keep_zero: bool = False) -> pd.DataFrame:
    """Respuestas: columnas sender, replies_to, gap (Timedelta) y prev (índice en df del mensaje respondido), con el
    índice de df de la respuesta. keep_zero: también las de gap 0 (resolución de minutos)."""
    d = df.sort_values("ts", kind="stable")
    prev_sender, prev_ts = d["sender"].shift(1), d["ts"].shift(1)
    gap = d["ts"] - prev_ts
    moved = (gap >= pd.Timedelta(0)) if keep_zero else (gap > pd.Timedelta(0))
    keep = prev_sender.notna() & (d["sender"] != prev_sender) & moved & (gap <= REPLY_WINDOW)
    prev = pd.Series(d.index, index=d.index).shift(1)
    return pd.DataFrame({"sender": d["sender"], "replies_to": prev_sender, "gap": gap, "prev": prev})[keep]


def _latency(rp: pd.DataFrame, slugs: dict[str, str]) -> list[dict]:
    secs = rp["gap"].dt.total_seconds()
    out = []
    for name, s in slugs.items():
        to, frm = secs[rp["replies_to"] == name], secs[rp["sender"] == name]
        if len(to) and len(frm):
            out.append({"slug": s, "medianToSec": round(float(to.median()), 1),
                        "medianFromSec": round(float(frm.median()), 1), "n": int(len(frm))})
    return out


def _fastest(df: pd.DataFrame, rp: pd.DataFrame, slugs: dict[str, str], text_fn) -> dict | None:
    cand = rp[rp["sender"].isin(slugs) & rp["replies_to"].isin(slugs)]
    if cand.empty:
        return None
    prev = cand["prev"].astype(int).to_numpy()
    a_body = df.loc[prev, "body"].astype(str).str.strip().to_numpy()
    b_body = df.loc[cand.index, "body"].astype(str).str.strip()
    a_len = pd.Series(a_body, index=cand.index).str.len()
    ok = (df.loc[prev, "kind"].astype(str).to_numpy() == "text") & (df.loc[cand.index, "kind"].astype(str) == "text")
    ok &= pd.Series(a_body, index=cand.index).str.endswith("?") | (a_len >= FASTEST_A_CHARS)
    ok &= (b_body.str.split().str.len() >= FASTEST_B_WORDS) & (b_body.str.len() >= FASTEST_B_CHARS)
    if not ok.any():
        return None
    short = a_len <= FASTEST_A_MAX
    question = pd.Series(a_body, index=cand.index).str.endswith("?") & short
    tier = (~question).astype(int) + (~short).astype(int)  # 0 pregunta corta, 1 corto, 2 largo
    order = pd.DataFrame({"gap": cand["gap"], "tier": tier, "ts": df.loc[cand.index, "ts"]})[ok]
    best = order.sort_values(["gap", "tier", "ts"], ascending=[True, True, False], kind="stable").index[0]
    a, b = df.loc[int(cand.at[best, "prev"])], df.loc[best]
    return {"a": msg_ref(a, slugs, text_fn), "b": msg_ref(b, slugs, text_fn),
            "seconds": float(cand.at[best, "gap"].total_seconds())}


def build_rhythm(df: pd.DataFrame, people: list[dict], people_files: dict[str, dict],
                 time_resolution: str = "second") -> dict:
    """rhythm.json. df = build_web_data.load_chat; people = entradas de global.json (cuentan las con perfil);
    people_files = slug -> people/<slug>.json ya construido (de ahí salen las rachas y silencios); time_resolution =
    global.json timeResolution ("minute": las respuestas de gap 0 cuentan)."""
    from build_web_data import conversation_counts, profiled  # import diferido (ciclo con build_web_data)

    slugs = profiled(people)
    starts, kills = conversation_counts(df)
    rp = replies(df, keep_zero=time_resolution == "minute")
    ts = pd.to_datetime(df["ts"])
    return {
        "starters": _counts(starts, slugs),
        "killers": _counts(kills, slugs),
        "latency": _latency(rp, slugs),
        "fastest": _fastest(df, rp, slugs, export_text),
        "streaks": [
            {"slug": s, "streak": rec["streak"], "silence": rec["silence"]}
            for s in slugs.values()
            if (rec := people_files.get(s, {}).get("records"))
        ],
        "rings": {
            "dow": [int(n) for n in df["dow"].astype(int).value_counts().reindex(range(7), fill_value=0)],
            "month": [int(n) for n in ts.dt.month.value_counts().reindex(range(1, 13), fill_value=0)],
        },
    }
