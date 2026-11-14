"""Capítulo Lenguaje.

- muletillas: las frases que cada persona repite mucho más que el resto del grupo. Una frase es un n-grama de 2 a 5
  palabras normalizadas (web.common.norm_words). Se cuenta una vez por mensaje, solo en mensajes con texto (texto o
  pie de foto/video). "Por mil" usa como base todos los mensajes de la persona (o del resto), de cualquier tipo.
- repeated_by_others: frases suyas que otros escribieron después, textuales (5-gramas, como group_report.departer_quotes).
- laughed: el mensaje de cada persona que más risas ajenas juntó en 3 minutos (misma definición que funniest).
- badwords: puteadas de web/content/badwords.txt, por persona y por mil.
- style: largo, mayúsculas, signos, editados y borrados por persona.
- laughs: cómo se ríe cada uno (las clases de risa del idioma: jaja, jsjs, jeje, jiji, xd en castellano; 😂/🤣) y el
  "jaja" ("haha") más largo.
- build_language: todo junto para web/data/language.json.

Todo lo que depende del idioma (stopwords, risas, filtros de las muletillas) sale del wa.lang.Lang que se pasa.
"""
from __future__ import annotations

import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wa.background import word_is_common  # noqa: E402
from wa.names import People  # noqa: E402
from wa.lang import Lang  # noqa: E402
from wa.text import URL_RE, is_laugh  # noqa: E402
from web.common import (  # noqa: E402
    export_text, norm_words, per_mil, ranked_per_mil, strip_accents_keep_enie, surface_words,
)
from web.thresholds import Thresholds  # noqa: E402

MIN_OWN = 8
MIN_RATIO = 4.0  # perMilOwn / max(perMilOthers, OTHERS_FLOOR) >= 4: la dice 4 veces más por mil que el resto
MIN_SCORE = 25.0  # score = ratio * log(own); separa "que bronca" (~32) de "hijo de puta" (~20) o "hoy a la noche"
NGRAM = (2, 5)
TOP = 10
OTHERS_FLOOR = 0.05  # piso de perMilOthers para que nadie divida por cero
SUBSUME = 0.9  # frase larga con >= 90 % del conteo de una corta contenida en ella: sobrevive una sola (_subsumption)
EXAMPLE_MAX_WORDS = 25
VARIANT_PREFIX = 3  # "me aparece" / "me aparecio", "me la pinto" / "me la pintaste": misma frase, otra conjugación
OVERLAP = 0.5  # dos frases encimadas ("que bronca" + "bronca se fue") son una sola si la unión cubre >= 50 %
# nombre propio: palabra vista th.proper_min_n veces a mitad de oración...
PROPER_MIN_CAPS = 0.4  # ...y con mayúscula inicial en >= 40 % de ellas (Uber, Messi, Mabel, River, Bariloche)

# Los filtros por idioma (lang.edge, start_block, end_block, abbreviations, one_char_ok, filler_redup,
# generic_phrases, exclamative) están en wa.lang.es / wa.lang.en.


def _is_stop(w: str, lang: Lang) -> bool:
    """Stopword (sin acentos: norm_words siempre los quita) o risa."""
    return w in lang.stopwords_plain or bool(lang.laugh_re.match(w))


def is_candidate(tokens: list[str], names: set[str], lang: Lang) -> bool:
    """Filtros estructurales de una frase (tokens ya normalizados), con los recursos de `lang`:

    - entre NGRAM[0] y NGRAM[1] palabras;
    - las abreviaturas se expanden (lang.abbreviations: "q" cuenta como "que");
    - no empieza en lang.start_block (en castellano EDGE + "al", "lo"; lang.exclamative, "que", sí abre frases de
      dos palabras) ni termina en lang.end_block;
    - no tiene tokens de una letra salvo lang.one_char_ok, no empieza con un número ("30 mil") y no empieza ni
      termina en risa ("jaja na");
    - no está en lang.generic_phrases;
    - no contiene un nombre de `names` (minúscula, sin acentos; muletillas() pasa los primeros nombres con perfil,
      People.aliases, los apodos del grupo, que casi nunca van con mayúscula, y los nombres propios detectados
      por proper_nouns);
    - no está hecha solo de stopwords o risas; las reduplicaciones ("dale dale", "bueno bueno") pasan aunque sean
      stopwords, salvo las de risa, de lang.filler_redup o cuya base de dos palabras sea genérica ("si si si").
    """
    tokens = _expand(tokens, lang)
    laugh, generic = lang.laugh_re, lang.generic_phrases
    if not NGRAM[0] <= len(tokens) <= NGRAM[1]:
        return False
    if (tokens[0] in lang.start_block and not _exclamative(tokens, lang)) or tokens[-1] in lang.end_block:
        return False
    if any(len(t) == 1 and t not in lang.one_char_ok for t in tokens):
        return False
    if tokens[0].isdigit() or laugh.match(tokens[0]) or laugh.match(tokens[-1]):
        return False
    if " ".join(tokens) in generic:
        return False
    if any(t in names or t.split("'")[0] in names for t in tokens):  # "tomi's" también es Tomi
        return False
    if len(set(tokens)) == 1:  # reduplicación: vale aunque sea stopword ("dale dale"), salvo relleno
        word = tokens[0]
        return not laugh.match(word) and word not in lang.filler_redup and f"{word} {word}" not in generic
    return not all(_is_stop(t, lang) for t in tokens)


def _expand(tokens: list[str], lang: Lang) -> list[str]:
    return [lang.abbreviations.get(t, t) for t in tokens]


def _exclamative(tokens: list[str], lang: Lang) -> bool:
    """lang.exclamative + una palabra ("que bronca"): la única frase que puede abrir con un token de lang.edge."""
    return lang.exclamative is not None and len(tokens) == 2 and tokens[0] == lang.exclamative


def _grams(tokens: list[str], lang: Lang) -> set[str]:
    """N-gramas de NGRAM[0]..NGRAM[1] palabras que no empiezan en lang.start_block ni terminan en lang.end_block
    (poda barata antes de contar; el resto de los filtros va en is_candidate)."""
    out = set()
    n = len(tokens)
    lo, hi = NGRAM
    start, end, excl = lang.start_block, lang.end_block, lang.exclamative
    for i in range(n):
        if tokens[i] in start:
            if i == 0 and excl is not None and tokens[0] == excl and n >= lo and tokens[1] not in end:
                out.add(f"{excl} {tokens[1]}")  # exclamativa de dos palabras, al principio del mensaje
            continue
        for j in range(i + lo, min(i + hi, n) + 1):
            if tokens[j - 1] not in end:
                out.add(" ".join(tokens[i:j]))
    return out


def _subsumption(kept: dict[str, int]) -> set[str]:
    """Frases a descartar entre pares corta/larga (la corta contenida en la larga) cuando la larga tiene >= SUBSUME
    del conteo de la corta:

    - la corta es el principio de la larga ("mira vos" / "mira vos che"): las palabras extra van a la derecha y
      sobran; gana la corta.
    - si no ("fue la fiesta" / "ya fue la fiesta"): a la corta le falta el principio; gana la larga.
    """
    drop = set()
    for gram, own in kept.items():
        words = gram.split()
        n = len(words)
        for size in range(NGRAM[0], n):
            for i in range(n - size + 1):
                sub = " ".join(words[i:i + size])
                if sub in kept and own >= SUBSUME * kept[sub]:
                    drop.add(gram if i == 0 else sub)
    return drop


def _merge(a: str, b: str) -> str | None:
    """Unión de dos frases encimadas: el final de `a` es el principio de `b` ("que bronca" + "bronca se fue")."""
    wa, wb = a.split(), b.split()
    for k in range(min(len(wa), len(wb)) - 1, 0, -1):
        if wa[-k:] == wb[:k]:
            return " ".join(wa + wb[k:])
    return None


def _variant(a: str, b: str) -> bool:
    """Misma cantidad de palabras y distintas solo en números ("cocino a las 21" / "cocino a las 22"), o en una sola
    palabra cuyas primeras VARIANT_PREFIX letras coinciden ("me aparece" / "me aparecio")."""
    wa, wb = a.split(), b.split()
    if len(wa) != len(wb):
        return False
    diff = [(x, y) for x, y in zip(wa, wb) if x != y]
    if diff and all(x.isdigit() and y.isdigit() for x, y in diff):
        return True
    if len(diff) != 1:
        return False
    x, y = diff[0]
    return len(x) >= VARIANT_PREFIX and x[:VARIANT_PREFIX] == y[:VARIANT_PREFIX]


def _redundant(gram: str, own: int, chosen: list[str], counts: Counter) -> bool:
    """True si `gram` repite una frase ya elegida: la contiene o está contenida en ella, es una variante conjugada
    (_variant), o se encima con ella y la unión aparece en >= OVERLAP de sus mensajes (o es más larga que NGRAM[1] y
    no se puede contar)."""
    padded = f" {gram} "
    for other in chosen:
        if padded in f" {other} " or f" {other} " in padded or _variant(gram, other):
            return True
        for merged in (_merge(gram, other), _merge(other, gram)):
            if merged and (len(merged.split()) > NGRAM[1] or counts.get(merged, 0) >= OVERLAP * own):
                return True
    return False


SENTENCE_RE = re.compile(r"[.!?¿¡\n:;()\"]+")
CASED_WORD_RE = re.compile(r"(?<![\w@$])([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)")


def proper_nouns(bodies, lang: Lang, th: Thresholds) -> set[str]:
    """Palabras (normalizadas como norm_words) que el grupo escribe con mayúscula a mitad de oración: nombres de
    gente, lugares y marcas. Se ignora la primera palabra de cada oración (la mayúscula del teclado) y nunca son
    nombre las stopwords ni las palabras de una letra de `lang` (el "I" del inglés siempre va con mayúscula)."""
    caps: Counter = Counter()
    seen: Counter = Counter()
    for body in bodies:
        for sentence in SENTENCE_RE.split(str(body)):
            for word in CASED_WORD_RE.findall(sentence)[1:]:
                key = strip_accents_keep_enie(word.lower())
                seen[key] += 1
                if word[0].isupper():
                    caps[key] += 1
    never = lang.stopwords_plain | lang.one_char_ok
    return {w for w, n in seen.items()
            if n >= th.proper_min_n and caps[w] >= PROPER_MIN_CAPS * n and w not in never}


def _find(norm: str, phrase: str, lang: Lang) -> int:
    """Posición de la frase en el mensaje normalizado `norm` (-1 si no está). Las exclamativas ("que bronca") solo
    cuentan al principio del mensaje, igual que en _grams."""
    padded, needle = f" {norm} ", f" {phrase} "
    if _exclamative(phrase.split(), lang):
        return 0 if padded.startswith(needle) else -1
    return padded.find(needle)


def _left_fragment(rows: list[tuple], phrase: str, lang: Lang) -> bool:
    """True si en >= SUBSUME de sus apariciones la frase va precedida por la misma palabra de start_block ("el gato
    le roba", "que bronca se fue"): es el final de una frase más larga que el informe no muestra. Es la misma regla de
    _subsumption (gana la larga cuando lo que falta va a la izquierda) para las largas que no se cuentan."""
    left: Counter = Counter()
    for _, norm, _ in rows:
        at = _find(norm, phrase, lang)
        if at >= 0:
            before = f" {norm} "[:at].split()
            left[before[-1] if before else ""] += 1
    if not left:
        return False
    word, n = left.most_common(1)[0]
    return word in lang.start_block and n >= SUBSUME * sum(left.values())


def _example(rows: list[tuple], phrase: str, text_fn, lang: Lang) -> tuple[str, dict]:
    """(primer mes "YYYY-MM", ejemplo {"when","text"}) de la frase entre los mensajes (ts, norm, body) de la persona.

    El ejemplo es el primer mensaje con al menos dos palabras más que la frase y no más de EXAMPLE_MAX_WORDS; si no
    hay, el primero que la contiene.
    """
    n = len(phrase.split())
    first = example = None
    for ts, norm, body in rows:
        if _find(norm, phrase, lang) < 0:
            continue
        if first is None:
            first = (ts, body)
        if n + 2 <= norm.count(" ") + 1 <= EXAMPLE_MAX_WORDS:
            example = (ts, body)
            break
    ts, body = example or first
    return pd.Timestamp(first[0]).strftime("%Y-%m"), {"when": pd.Timestamp(ts).isoformat(), "text": text_fn(str(body))}


def _display(rows: list[tuple], surfaces: list[list[str] | None], phrase: str, lang: Lang) -> str:
    """La forma más frecuente en que la persona escribió la frase: en minúscula pero con sus acentos ("qué ilusión"
    para la clave "que ilusion"). Una vez por mensaje, en la misma posición que cuenta _grams (las exclamativas solo al
    principio). Empate: la de más caracteres no ASCII (la que conserva los acentos), después la alfabética."""
    needle = phrase.split()
    n = len(needle)
    forms: Counter = Counter()
    for (_, norm, _), surface in zip(rows, surfaces):
        tokens = norm.split()
        starts = [0] if _exclamative(needle, lang) else range(len(tokens) - n + 1)
        at = next((i for i in starts if tokens[i:i + n] == needle), None)
        if at is not None:
            forms[" ".join((surface or tokens)[at:at + n])] += 1
    if not forms:
        return phrase
    return min(forms, key=lambda f: (-forms[f], -sum(ord(c) > 127 for c in f), f))


def muletillas(df: pd.DataFrame, slugs: dict[str, str], people_names: People, th: Thresholds,
               lang: Lang) -> dict[str, list[dict]]:
    """slug -> hasta TOP muletillas [{"phrase","display","own","others","perMilOwn","perMilOthers","ratio",
    "firstMonth","example"}], de mayor a menor score = ratio * log(own), con ratio = perMilOwn / max(perMilOthers,
    0.05). `phrase` es la clave normalizada (sin acentos, la que se cuenta); `display`, cómo la escribe (_display).

    `df` es load_chat: `sender` nombre corto, `body` con menciones ya limpias, `kind` y `caption` (cuentan los "text" y
    los pies de foto/video, _has_text); `lang`
    da las stopwords, las risas y los filtros de is_candidate.
    """
    totals = df["sender"].value_counts()
    grand_total = int(totals.sum())
    has_text = _has_text(df)  # el pie de un documento (su nombre de archivo) no es una frase
    texts = df.loc[has_text, ["ts", "sender", "body"]].sort_values("ts", kind="stable")  # firstMonth = primera vez

    per_sender: dict[str, Counter] = {}
    overall: Counter = Counter()
    by_sender_rows: dict[str, list[tuple]] = {name: [] for name in slugs}
    by_sender_surfaces: dict[str, list[list[str] | None]] = {name: [] for name in slugs}
    for ts, sender, body in texts.itertuples(index=False, name=None):
        tokens = _expand(norm_words(str(body), lang), lang)
        if (own_rows := by_sender_rows.get(sender)) is not None:
            own_rows.append((ts, " ".join(tokens), body))
            surface = surface_words(str(body), lang)
            by_sender_surfaces[sender].append(None if surface is None else _expand(surface, lang))
        if len(tokens) < NGRAM[0]:
            continue
        grams = _grams(tokens, lang)
        overall.update(grams)
        per_sender.setdefault(sender, Counter()).update(grams)

    names = {norm_words(name, lang)[0] for name in slugs if norm_words(name, lang)} | people_names.aliases | proper_nouns(texts["body"], lang, th)
    names |= {strip_accents_keep_enie(s) for s in people_names.contact_surnames()}
    out: dict[str, list[dict]] = {}
    for name, slug_ in slugs.items():
        own_total = int(totals.get(name, 0))
        others_total = grand_total - own_total
        counts = per_sender.get(name, Counter())
        scored = []
        for gram, own in counts.items():
            if own < MIN_OWN:
                continue
            others = overall[gram] - own
            pm_own = 1000 * own / own_total
            pm_others = 1000 * others / others_total if others_total else 0.0
            ratio = pm_own / max(pm_others, OTHERS_FLOOR)
            score = ratio * math.log(own)
            if ratio < MIN_RATIO or score < MIN_SCORE or not is_candidate(gram.split(), names, lang):
                continue
            scored.append((score, gram, own, others, pm_own, pm_others, ratio))

        dropped = _subsumption({s[1]: s[2] for s in scored})
        survivors = [s for s in scored if s[1] not in dropped]
        survivors.sort(key=lambda s: (-s[0], -s[2], s[1]))
        rows = by_sender_rows.get(name, [])
        chosen: list[tuple] = []
        for s in survivors:
            if len(chosen) == TOP:
                break
            if not _redundant(s[1], s[2], [c[1] for c in chosen], counts) and not _left_fragment(rows, s[1], lang):
                chosen.append(s)

        out[slug_] = []
        for _, gram, own, others, pm_own, pm_others, ratio in chosen:
            first_month, example = _example(rows, gram, export_text, lang)
            out[slug_].append({
                "phrase": gram,
                "display": _display(rows, by_sender_surfaces.get(name, []), gram, lang),
                "own": own,
                "others": others,
                "perMilOwn": round(pm_own, 1),
                "perMilOthers": round(pm_others, 1),
                "ratio": round(ratio, 1),
                "firstMonth": first_month,
                "example": example,
            })
    return out


# ---------------------------------------------------------------- frases que otros le repitieron
QUOTE_N = 5  # largo del n-grama que tiene que aparecer textual en el mensaje de otro
QUOTE_CHARS = (15, 120)  # mensajes fuente: ni muy cortos ni muy largos (como departer_quotes)
# Fuentes que no son frases: links, listas de anotados ("Asado miércoles:\n1) Ana\n2) Caro"), pedidos a Meta AI
# que otros copian como plantilla, "@todos imagen omitida" y avisos de sistema pegados como texto, que traen el nombre
# de contacto completo ('Tomi "Tomate" Suárez🍅 restableció el enlace...').
def _quote_source_block_re(people_names: People) -> re.Pattern:
    full_names = [re.escape(n) for n in people_names.raw_names if " " in n]
    return re.compile("|".join([r"http", r"\n", "@", "meta ai", "omitid[oa]"] + full_names), re.IGNORECASE)


QUOTE_MIN_CONTENT = 2  # palabras que no son stopword ni risa en el 5-grama ("esto es una frase muy" no alcanza)
QUOTE_MIN_PEOPLE = 2
QUOTE_TOP = 8


def _has_text(df: pd.DataFrame) -> pd.Series:
    """Mensajes con texto escrito: tipo texto o con pie de foto/video. El pie de un documento de iOS es su nombre de
    archivo ("presupuesto.pdf •"), no texto escrito: no cuenta."""
    kind = df["kind"].astype(str)
    mask = kind == "text"
    if "caption" in df:
        mask |= df["caption"].fillna(False).astype(bool) & (kind != "document")
    return mask


def _ordered(df: pd.DataFrame) -> pd.DataFrame:
    return df.sort_values("ts", kind="stable")


def _quote_grams(body: str, lang: Lang) -> set[str]:
    """5-gramas (QUOTE_N palabras de norm_words) con al menos QUOTE_MIN_CONTENT palabras que no son stopword ni risa."""
    words = norm_words(body, lang)
    if len(words) < QUOTE_N:
        return set()
    content = [not _is_stop(w, lang) for w in words]
    return {
        " ".join(words[i:i + QUOTE_N])
        for i in range(len(words) - QUOTE_N + 1)
        if sum(content[i:i + QUOTE_N]) >= QUOTE_MIN_CONTENT
    }


def repeated_by_others(df: pd.DataFrame, slugs: dict[str, str], people_names: People, th: Thresholds,
                       background=(), *, lang: Lang) -> dict[str, list[dict]]:
    """slug -> hasta QUOTE_TOP frases [{"text","when","times","people","by"}] que otras personas escribieron
    después textualmente.

    Una sola pasada cronológica por los mensajes con texto: cada 5-grama (_quote_grams) es de quien lo escribió
    primero en un mensaje fuente (texto de QUOTE_CHARS caracteres, de una línea, sin links, menciones ni Meta AI, de
    cualquiera); después, cada mensaje de otra persona que lo contiene suma una vez. Se descartan los 5-gramas que
    aparecen en `background` (textos de otro chat anteriores al del informe; build_web_data.load_background): son
    frases hechas ("abrir la puerta de noche", "es la primera vez que"): son de la lengua y no del grupo. Sin `background` (no hay chats de
    fondo) se descartan en cambio los formados solo por palabras corrientes del idioma (wa.background.word_is_common
    con lang.code),
    como en wa.background.lore_filter. Por mensaje fuente queda su 5-grama más
    repetido: `times` = mensajes de otros que lo copiaron, `people` = personas distintas (con o sin perfil), `by` =
    slugs con perfil de quienes lo copiaron, de más a menos. Entran las que tienen times >= th.quote_min_times y people
    >= QUOTE_MIN_PEOPLE; `text` es el mensaje fuente entero.
    """
    t = _ordered(df[_has_text(df)])  # como muletillas: texto y pies de foto/video, no nombres de documento
    lo, hi = QUOTE_CHARS
    source_ok = (
        t["n_chars"].between(lo, hi).to_numpy()
        & ~t["body"].astype(str).str.contains(_quote_source_block_re(people_names)).to_numpy()
    )
    origin: dict[str, tuple[int, str, object]] = {}  # gram -> (posición del mensaje fuente, autor, ts)
    copies: Counter = Counter()
    copiers: dict[str, Counter] = defaultdict(Counter)
    for pos, (ts, sender, body) in enumerate(t[["ts", "sender", "body"]].itertuples(index=False, name=None)):
        for gram in _quote_grams(str(body), lang):
            first = origin.get(gram)
            if first is None:
                if source_ok[pos]:
                    origin[gram] = (pos, sender, ts)
            elif first[1] != sender and ts > first[2]:
                copies[gram] += 1
                copiers[gram][sender] += 1

    candidates = {
        gram for gram, times in copies.items()
        if origin[gram][1] in slugs and times >= th.quote_min_times and len(copiers[gram]) >= QUOTE_MIN_PEOPLE
    }
    if len(background):
        for body in background:  # se filtra al final: solo hace falta buscar las candidatas
            candidates -= _quote_grams(str(body), lang)
    else:  # sin chats de fondo, la frecuencia de la lengua hace de fondo
        candidates = {g for g in candidates if not all(word_is_common(w, lang.code) for w in g.split())}

    best: dict[int, tuple[int, int, str]] = {}  # posición fuente -> (times, people, gram)
    for gram in candidates:
        pos = origin[gram][0]
        key = (copies[gram], len(copiers[gram]), gram)
        if key > best.get(pos, (0, 0, "")):
            best[pos] = key

    rows = t[["ts", "sender", "body"]].to_numpy()
    out: dict[str, list[dict]] = {s: [] for s in slugs.values()}
    for pos, (times, people, gram) in sorted(best.items(), key=lambda kv: (-kv[1][0], -kv[1][1], kv[0])):
        ts, author, body = rows[pos]
        quotes = out[slugs[author]]
        if len(quotes) == QUOTE_TOP:
            continue
        by = sorted((-n, slugs[who]) for who, n in copiers[gram].items() if who in slugs)
        quotes.append({
            "text": export_text(str(body)),
            "when": pd.Timestamp(ts).isoformat(),
            "times": times,
            "people": people,
            "by": [s for _, s in by],
        })
    return out


# ---------------------------------------------------------------- las que hicieron reír
FUNNY_WINDOW = np.timedelta64(180, "s")  # misma definición que records.funniest
FUNNY_MIN_CHARS = 12


def laughed(df: pd.DataFrame, slugs: dict[str, str], th: Thresholds, lang: Lang) -> dict[str, dict | None]:
    """slug -> el mensaje de la persona con más risas de otras personas en los FUNNY_WINDOW siguientes
    {"when","text","laughs","people"}, o None si ninguno llega a th.funny_min_laughs.

    Igual que records.funniest (así el récord de una persona nunca supera al del grupo): candidatos = textos de
    al menos FUNNY_MIN_CHARS caracteres que no son solo risa; risa = texto que es solo risa (wa.text.is_laugh) de
    otra persona; se cuentan las risas hasta 180 s después, inclusive. Empates: el más reciente, como funniest.
    """
    d = _ordered(df).reset_index(drop=True)
    ts = d["ts"].to_numpy()
    snd = d["sender"].to_numpy()
    text = (d["kind"].astype(str) == "text").to_numpy()
    laugh_only = d["body"].map(lambda b: is_laugh(b, lang)).to_numpy()
    laugh = text & laugh_only
    cum = np.concatenate([[0], np.cumsum(laugh)])
    ends = np.searchsorted(ts, ts + FUNNY_WINDOW, side="right")
    long_enough = d["n_chars"].to_numpy() >= FUNNY_MIN_CHARS
    cand = np.flatnonzero(text & long_enough & ~laugh_only & d["sender"].isin(slugs).to_numpy())

    best: dict[str, tuple[int, int, int]] = {}
    for i in cand:
        end = ends[i]
        if cum[end] - cum[i + 1] < th.funny_min_laughs:  # ni contando las propias llega: no hace falta mirar
            continue
        window = np.arange(i + 1, end)
        who = snd[window[laugh[window] & (snd[window] != snd[i])]]
        if len(who) >= th.funny_min_laughs:
            key = (len(who), len(set(who)), int(i))
            if key > best.get(snd[i], (0, 0, -1)):
                best[snd[i]] = key
    out: dict[str, dict | None] = {s: None for s in slugs.values()}
    for name, (n, people, i) in best.items():
        out[slugs[name]] = {
            "when": pd.Timestamp(ts[i]).isoformat(), "text": export_text(str(d.at[i, "body"])), "laughs": n,
            "people": people,
        }
    return out


# ---------------------------------------------------------------- puteadas
RECORD_CHARS = 300  # texto de los récords de puteadas y de risa


def load_badwords(path: Path, lang: Lang) -> set[str]:
    """Términos de `path` (content/badwords.txt) normalizados como norm_words; las líneas con # se ignoran."""
    words = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.lstrip().startswith("#"):
            words.add(" ".join(norm_words(line, lang)))
    return words - {""}


def base_badwords(lang: Lang) -> set[str]:
    """Las puteadas genéricas del idioma (lang.badwords_base), normalizadas como load_badwords: el punto de partida
    de content/badwords.txt. build_web_data cuenta solo las del archivo (una palabra base borrada no cuenta)."""
    return {" ".join(norm_words(w, lang)) for w in lang.badwords_base} - {""}


def _badword_re(words: set[str]) -> re.Pattern:
    # los más largos primero: en la misma posición, "hijo de puta" gana a "puta" y no se cuenta dos veces
    alternation = "|".join(re.escape(w) for w in sorted(words, key=lambda w: (-len(w), w)))
    return re.compile(rf"(?<!\S)(?:{alternation})(?!\S)")


def badword_hits(df: pd.DataFrame, words: set[str], lang: Lang) -> pd.Series:
    """Índice de df -> tupla de puteadas distintas (en orden de aparición) de cada mensaje con texto que tiene
    alguna. El texto se normaliza con norm_words; cada término cuenta como palabras enteras y sin solaparse."""
    if not words:
        return pd.Series(dtype=object)
    pattern = _badword_re(words)
    t = df[_has_text(df)]
    hits = {}
    for idx, body in zip(t.index, t["body"]):
        found = pattern.findall(" ".join(norm_words(str(body), lang)))
        if found:
            hits[idx] = tuple(dict.fromkeys(found))
    return pd.Series(hits, dtype=object)


def badwords(df: pd.DataFrame, slugs: dict[str, str], words: set[str], lang: Lang,
             hits: pd.Series | None = None) -> dict:
    """{"byPerson": [{"slug","n","perMil"}], "total", "record": {"who","when","text","distinct"} | None}.

    n = mensajes con al menos una puteada (badword_hits); perMil sobre todos los mensajes de la persona; total =
    mensajes con puteadas de todo el grupo; record = el mensaje de una persona con perfil con más puteadas
    distintas (empates: el primero; el texto recortado a RECORD_CHARS, `distinct` sobre el mensaje entero). `hits`
    evita recalcular badword_hits si ya se tiene.
    """
    hits = badword_hits(df, words, lang) if hits is None else hits
    senders = df.loc[hits.index, "sender"] if len(hits) else pd.Series(dtype=object)
    counts = senders.value_counts().reindex(list(slugs), fill_value=0)
    totals = df["sender"].value_counts()
    record = None
    mine = hits[senders.isin(slugs)] if len(hits) else hits
    if len(mine):
        distinct = mine.map(len)
        top = distinct[distinct == distinct.max()].index
        row = df.loc[min(top, key=lambda i: (df.at[i, "ts"], i))]
        record = {
            "who": slugs[row["sender"]], "when": pd.Timestamp(row["ts"]).isoformat(),
            "text": export_text(str(row["body"]))[:RECORD_CHARS], "distinct": int(distinct.max()),
        }
    return {"byPerson": ranked_per_mil(counts, totals, slugs, min_msgs=1), "total": int(len(hits)), "record": record}


def badword_terms(hits: pd.Series) -> Counter:
    """Término -> mensajes que lo contienen (para revisar badwords.txt)."""
    return Counter(term for terms in hits for term in terms)


# ---------------------------------------------------------------- cómo escribe cada uno
UPPER_MIN_LETTERS = 4
LETTER_RE = r"[^\W\d_]"


def style(df: pd.DataFrame, slugs: dict[str, str], lang: Lang) -> list[dict]:
    """Una carta por persona con perfil, en el orden de `slugs`: avgChars (promedio de caracteres de sus textos),
    upperShare (de sus textos con al menos UPPER_MIN_LETTERS letras que no son solo risa, los que no tienen ninguna
    minúscula), exclPerMil / questPerMil (mensajes con "!" / "?"), editedPerMil y deletedPerMil, por mil de todos sus
    mensajes. Letras, mayúsculas y signos se miran sin los links (el "?" de "...watch?v=" no es una pregunta)."""
    body = df["body"].astype(str).str.replace(URL_RE, " ", regex=True)
    kind = df["kind"].astype(str)
    is_text = kind == "text"
    lettered = is_text & (body.str.count(LETTER_RE) >= UPPER_MIN_LETTERS)
    maybe_laugh = lettered & body.str.contains(lang.laugh_hint)
    lettered[maybe_laugh] = ~body[maybe_laugh].map(lambda b: _laugh_only(b, lang)).astype(bool)  # "JAJAJA" no grita
    frame = pd.DataFrame({
        "sender": df["sender"],
        "chars": df["n_chars"].where(is_text),
        "lettered": lettered,
        "upper": lettered & (body == body.str.upper()),
        "excl": body.str.contains("!", regex=False),
        "quest": body.str.contains("?", regex=False),
        "edited": df["edited"].fillna(False).astype(bool) if "edited" in df else False,
        "deleted": kind == "deleted",
    })
    g = frame[frame["sender"].isin(slugs)].groupby("sender")
    sums = g[["lettered", "upper", "excl", "quest", "edited", "deleted"]].sum()
    sizes, chars = g.size(), g["chars"].mean()
    out = []
    for name, slug_ in slugs.items():
        if name not in sizes:
            continue
        n = int(sizes[name])
        s = sums.loc[name]
        avg = chars.get(name)
        out.append({
            "slug": slug_,
            "avgChars": round(float(avg), 1) if pd.notna(avg) else 0.0,
            "upperShare": round(int(s["upper"]) / int(s["lettered"]), 3) if s["lettered"] else 0.0,
            "exclPerMil": per_mil(int(s["excl"]), n),
            "questPerMil": per_mil(int(s["quest"]), n),
            "editedPerMil": per_mil(int(s["edited"]), n),
            "deletedPerMil": per_mil(int(s["deleted"]), n),
        })
    return out


# ---------------------------------------------------------------- la risa de cada uno
def _laugh_only(text: str, lang: Lang) -> bool:
    """Todas las palabras (norm_words) son risa: alguna de lang.laugh_kinds o lang.laugh_re ("ajaja", "lol")."""
    words = norm_words(text, lang)
    return bool(words) and all(lang.laugh_kind(w) or lang.laugh_re.match(w) for w in words)


def laughs(df: pd.DataFrame, slugs: dict[str, str], lang: Lang) -> dict:
    """{"byPerson": [{"slug","mix","avgJa"}], "record": {"who","when","text","length"} | None}.

    Cada mensaje de texto cuenta una sola vez en `mix`: por su primera palabra (norm_words) de lang.laugh_kinds (en
    castellano jaja, jsjs, jeje, jiji, xd) o, si no tiene ninguna, como "emoji" si tiene un emoji de lang.laugh_emoji
    (😂, 🤣): "me mato jajaja" es jaja, "me mato 😂" es emoji, "jsjs 😂 jaja" es jsjs. `mix` es una lista
    [{"key","label","n"}] en el orden de lang.laugh_kinds, más {"key": "emoji", "label": "😂", "n"} al final.
    avgJa = promedio de "ja" (lang.laugh_unit: grupos j+a+; en inglés h+a+) por palabra de la primera clase (jaja,
    haha) en sus textos. record = la palabra de esa clase con más repeticiones en cualquier texto de una persona con
    perfil (empates: la primera), con el mensaje recortado a RECORD_CHARS.
    """
    main_kind = lang.laugh_kinds[0][0]
    keys = [key for key, _, _ in lang.laugh_kinds]
    labels = {key: label for key, label, _ in lang.laugh_kinds} | {"emoji": lang.laugh_emoji[0]}
    d = _ordered(df[df["sender"].isin(slugs) & (df["kind"].astype(str) == "text")])
    body = d["body"].astype(str)
    mixes = {name: dict.fromkeys((*keys, "emoji"), 0) for name in slugs}
    jas: dict[str, list[int]] = {name: [] for name in slugs}
    record, record_len = None, 0
    t = d[body.str.contains("|".join([lang.laugh_hint, *lang.laugh_emoji]))]
    for ts, sender, text in t[["ts", "sender", "body"]].itertuples(index=False, name=None):
        text = str(text)
        kinds = [(w, lang.laugh_kind(w)) for w in norm_words(text, lang)]
        first = next((k for _, k in kinds if k), None)
        if first is None and any(e in text for e in lang.laugh_emoji):
            first = "emoji"
        if first:
            mixes[sender][first] += 1
        for w, k in kinds:
            if k == main_kind:
                n = len(lang.laugh_unit.findall(w))
                jas[sender].append(n)
                if n > record_len:
                    record, record_len = (ts, sender, text), n
    by_person = []
    for name, slug_ in slugs.items():
        mix = mixes[name]
        by_person.append({
            "slug": slug_,
            "mix": [{"key": k, "label": labels[k], "n": mix[k]} for k in (*keys, "emoji")],
            "avgJa": round(sum(jas[name]) / len(jas[name]), 1) if jas[name] else 0.0,
        })
    rec = None
    if record:
        ts, sender, text = record
        rec = {"who": slugs[sender], "when": pd.Timestamp(ts).isoformat(),
               "text": export_text(text)[:RECORD_CHARS], "length": record_len}
    return {"byPerson": by_person, "record": rec}


# ---------------------------------------------------------------- todo junto
def muletilla_score(m: dict) -> float:
    return m["ratio"] * math.log(m["own"])


def build_language(df: pd.DataFrame, people: list[dict], people_names: People, words: set[str], th: Thresholds,
                   hits: pd.Series | None = None, background=(), *, lang: Lang) -> dict:
    """language.json. `people` son las entradas de global.json (cuentan las con perfil), `people_names` el
    wa.names.People (nombres y apodos que no son muletillas ni citas); `words` son las puteadas
    (load_badwords), `th` los umbrales del reporte, `hits` (badword_hits) se puede pasar para no recalcularlo y `background` son los textos
    de frases hechas para repeated_by_others; `lang` (wa.lang.get_lang) da los recursos del idioma del chat.

    top.muletilla = la primera muletilla de cada persona con mayor ratio * log(own); top.repeated = la frase con
    más `times`; ambas con el "slug" de su dueño, o None. En empates gana la primera persona de `people`.
    """
    from build_web_data import profiled  # import diferido (ciclo con build_web_data)

    slugs = profiled(people)
    mul = muletillas(df, slugs, people_names, th, lang)
    rep = repeated_by_others(df, slugs, people_names, th, background, lang=lang)
    top_mul = top_rep = None
    for slug_, ms in mul.items():
        if ms and (top_mul is None or muletilla_score(ms[0]) > muletilla_score(top_mul)):
            top_mul = {**ms[0], "slug": slug_}
    for slug_, rs in rep.items():
        for r in rs:
            if top_rep is None or r["times"] > top_rep["times"]:
                top_rep = {**r, "slug": slug_}
    return {
        "muletillas": mul,
        "repeated": rep,
        "laughed": laughed(df, slugs, th, lang),
        "badwords": badwords(df, slugs, words, lang, hits),
        "style": style(df, slugs, lang),
        "laughs": laughs(df, slugs, lang),
        "top": {"muletilla": top_mul, "repeated": top_rep},
    }
