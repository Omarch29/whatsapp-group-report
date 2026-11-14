"""Capítulo Emojis.

Emojis con emoji_seqs, en todos los mensajes: los caracteres de wa.text.EMOJI_RE sin tonos de piel ni selector de
variación, pero sin partir las secuencias ZWJ (🏳️‍🌈, 🏊‍♂️) ni las banderas (🇦🇷) como hace wa.text.emojis. Se
cuenta por clave (❤️ y ❤ juntos) y se publica la forma más escrita de cada una, así ❤️ conserva su selector.

- top: los 30 más usados (cada aparición cuenta) con la persona con perfil que más lo usa (`topUser`).
- signature: el emoji firma de cada persona: el de mayor razón propio por mil / resto por mil, contando mensajes
  que lo contienen (una vez por mensaje, para que una ristra 😂😂😂😂 no infle) y con al menos th.signature_min_own mensajes propios.
  El resto por mil tiene un piso de 0.05 para no dividir por cero. Quien no tenga ninguno que llegue no aparece.
- byYear: el top 5 de cada año (apariciones).
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wa.text import EMOJI_RE  # noqa: E402
from web.thresholds import Thresholds  # noqa: E402

TOP = 30
YEAR_TOP = 5
OTHERS_FLOOR = 0.05

VS16, ZWJ = "\ufe0f", "\u200d"
SKIN_TONE_RE = re.compile("[\U0001F3FB-\U0001F3FF]")
_E = EMOJI_RE.pattern[1:-1]  # el contenido de la clase [...]
SEQ_RE = re.compile(f"[\U0001F1E6-\U0001F1FF]{{2}}|[{_E}]{VS16}?(?:{ZWJ}[{_E}]{VS16}?)*")


def emoji_surfaces(text: str) -> list[str]:
    """Emojis de `text` tal como se escribieron (banderas y secuencias ZWJ enteras), sin tonos de piel."""
    return SEQ_RE.findall(SKIN_TONE_RE.sub("", text))


def emoji_key(surface: str) -> str:
    """Clave de conteo: el selector de variación se quita de los emojis sueltos (❤️ y ❤ son el mismo) y se
    conserva dentro de las secuencias ZWJ, que son una sola forma."""
    return surface if ZWJ in surface else surface.replace(VS16, "")


def emoji_seqs(text: str) -> list[str]:
    """Las claves (emoji_key) de los emojis de `text`."""
    return [emoji_key(m) for m in emoji_surfaces(text)]


def _top(counter: Counter, n: int) -> list[tuple[str, int]]:
    return sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[:n]


def build_emojis(df: pd.DataFrame, people: list[dict], th: Thresholds) -> dict:
    """emojis.json. df = build_web_data.load_chat; people = entradas de global.json (cuentan las con perfil)."""
    from build_web_data import profiled  # import diferido (ciclo con build_web_data)

    slugs = profiled(people)
    surfaces = df["body"].astype(str).map(emoji_surfaces)
    found = surfaces.map(lambda ms: [emoji_key(m) for m in ms])
    years = pd.to_datetime(df["ts"]).dt.year
    forms: dict[str, Counter] = {}
    for ms in surfaces:
        for m in ms:
            forms.setdefault(emoji_key(m), Counter())[m] += 1

    def shown(key: str) -> str:
        """La forma más escrita de la clave (❤️ con su selector si así se tipeó más); en empate, la más larga."""
        return max(forms[key].items(), key=lambda kv: (kv[1], len(kv[0]), kv[0]))[0]

    total: Counter = Counter()
    uses: dict[str, Counter] = {}
    msgs_with: dict[str, Counter] = {}
    by_year: dict[int, Counter] = {}
    for sender, year, es in zip(df["sender"], years, found):
        if not es:
            continue
        total.update(es)
        uses.setdefault(sender, Counter()).update(es)
        msgs_with.setdefault(sender, Counter()).update(set(es))
        by_year.setdefault(int(year), Counter()).update(es)

    top = []
    for e, n in _top(total, TOP):
        users = [(uses[name][e], s) for name, s in slugs.items() if uses.get(name, Counter())[e]]
        top_user = min(users, key=lambda u: (-u[0], u[1]))[1] if users else None
        top.append({"e": shown(e), "n": int(n), "topUser": top_user})

    totals = df["sender"].value_counts()
    all_with: Counter = Counter()
    for c in msgs_with.values():
        all_with.update(c)
    n_all = int(len(df))
    signature = []
    for name, s in slugs.items():
        own_msgs = int(totals.get(name, 0))
        best = None
        for e, own in msgs_with.get(name, Counter()).items():
            if own < th.signature_min_own:
                continue
            others = 1000 * (all_with[e] - own) / (n_all - own_msgs) if n_all > own_msgs else 0.0
            ratio = (1000 * own / own_msgs) / max(others, OTHERS_FLOOR)
            if best is None or (ratio, own) > (best["ratio"], best["own"]):
                best = {"slug": s, "e": e, "own": int(own), "ratio": ratio}
        if best:
            signature.append({**best, "e": shown(best["e"]), "ratio": round(best["ratio"], 1)})

    return {
        "top": top,
        "signature": signature,
        "byYear": [
            {"year": str(y), "top": [{"e": shown(e), "n": int(n)} for e, n in _top(by_year[y], YEAR_TOP)]}
            for y in sorted(by_year)
        ],
    }
