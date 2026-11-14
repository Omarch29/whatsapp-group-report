"""Parser de exports de WhatsApp (iOS/Android × es/en) sobre un `Locale` de `wa/locales.py`.

Una línea que matchea la cabecera del locale abre un mensaje; las demás son continuación del anterior (las líneas
antes de la primera cabecera se ignoran). Todo texto que depende del export (multimedia, borrados, editados,
encuestas, avisos del sistema) vive en el locale: acá no hay ningún texto de la app.

Normalizaciones:
- encuestas: el cuerpo se reescribe al formato canónico `POLL:\\n<pregunta>\\nOPTION: <label> (<n>)` en todo idioma;
- avisos del sistema: `kind == "system"` y el evento estructurado en `sys_event` / `sys_who` / `sys_by`
  (`OWNER` = el dueño del export; build_dataset lo resuelve a `people.me`);
- Android: una cabecera sin "Nombre: " es un aviso del sistema, con remitente `SYSTEM_SENDER`.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from itertools import islice
from typing import Iterable, Iterator, NamedTuple

from wa.locales import DETECT_LINES, IOS_ES, LRM, Locale, detect, infer_date_order
from wa.names import SYSTEM_SENDER

OWNER = "__you__"  # el dueño del export en sys_who / sys_by ("Añadiste a X", "You added X")
KEEP_TEXT = ("location", "call")  # multimedia que conserva su texto (el link, el tipo de llamada)
NAME_JUNK = str.maketrans("", "", LRM + "\u2068\u2069")  # LRM y aisladores de las menciones
NO_SYS = ("", "", "")


@dataclass(slots=True)
class Message:
    ts: datetime
    sender: str
    body: str
    kind: str  # text | image | audio | ... | media (Android) | poll | deleted | system
    edited: bool
    caption: bool  # multimedia con texto adjunto (ej: "foto ‎imagen omitida")
    sys_event: str = ""  # solo en kind == "system": created, added, ... (ver locales), "other" si no se reconoce
    sys_who: str = ""  # a quién le pasó (o el nombre nuevo del grupo, en created / name_changed)
    sys_by: str = ""  # quién lo hizo


class Classified(NamedTuple):
    kind: str
    body: str
    edited: bool
    caption: bool
    sys: tuple[str, str, str]  # (sys_event, sys_who, sys_by); NO_SYS fuera de los avisos del sistema


def _person(raw: str | None, locale: Locale) -> str:
    if not raw:
        return ""
    name = raw.translate(NAME_JUNK).strip().rstrip(".").strip()
    return OWNER if name.casefold() in {y.casefold() for y in locale.you} else name


def system_event(text: str, locale: Locale) -> tuple[str, str, str] | None:
    """(sys_event, sys_who, sys_by) del primer patrón de sistema del locale que matchea `text`; None si ninguno."""
    for event, pat in locale.system:
        m = pat.search(text)
        if m is None:
            continue
        g = m.groupdict()
        who = OWNER if g.get("who_you") is not None else _person(g.get("who"), locale)
        by = OWNER if g.get("by_you") is not None else _person(g.get("by"), locale)
        if not who and g.get("name"):
            who = g["name"].strip()
        return event, who, by
    return None


def canonical_poll(text: str, locale: Locale) -> str:
    """'ENCUESTA:\\n<pregunta>\\nOPCIÓN: Sí (3 votos)' (o 'POLL:' / 'OPTION: Yes (3 votes)') ->
    'POLL:\\n<pregunta>\\nOPTION: Sí (3)'. Sin las líneas vacías."""
    lines = [line.replace(LRM, "").strip() for line in text.splitlines()]
    out = ["POLL:"]
    if lines and lines[0].startswith(locale.poll_prefix):
        lines[0] = lines[0][len(locale.poll_prefix):].strip()
    for line in lines:
        if line:
            m = locale.poll_option.match(line)
            out.append(f"OPTION: {m['label']} ({m['n']})" if m else line)
    return "\n".join(out)


def _app_text(text: str, locale: Locale) -> str | None:
    """kind de un texto puesto por la app (multimedia, encuesta, borrado), o None."""
    for kind, pat in locale.media:
        if pat.search(text):
            return kind
    if text.startswith(locale.poll_prefix):
        return "poll"
    if locale.deleted.search(text):
        return "deleted"
    return None


def classify(raw_body: str, locale: Locale = IOS_ES, system: bool = False) -> Classified:
    """Tipo, cuerpo limpio, editado, caption y evento de sistema de un cuerpo crudo. `system`: el parser ya sabe
    que es un aviso del sistema (cabecera Android sin remitente)."""
    kind, body, edited, caption, *sys = _classify(raw_body, locale, system)
    return Classified(kind, body, edited, caption, tuple(sys))


def _classify(raw_body: str, locale: Locale, system: bool) -> tuple:
    """classify como tupla plana (kind, body, edited, caption, sys_event, sys_who, sys_by): es el camino caliente,
    una llamada por mensaje, y la tupla va directo a Message."""
    mark = locale.edited_mark
    edited = mark in raw_body
    body = (raw_body.replace(mark, "") if edited else raw_body).strip()
    ios = locale.platform == "ios" and not system
    if ios and LRM not in body:  # el caso común: texto escrito por una persona
        return "text", body, edited, False, *NO_SYS

    if not ios:
        clean = body.replace(LRM, "").strip()
        if system:
            return ("system", clean, edited, False, *(system_event(clean, locale) or ("other", "", "")))
        kind = _app_text(clean, locale)
        if kind is None:
            return ("text", clean, edited, False, *NO_SYS)
        if kind == "poll":
            return (kind, canonical_poll(clean, locale), edited, False, *NO_SYS)
        if kind == "deleted" or kind in KEEP_TEXT:
            return (kind, "" if kind == "deleted" else clean, edited, False, *NO_SYS)
        m = next(p for k, p in locale.media if k == kind).search(clean)
        extra = f"{clean[:m.start()].strip()} {clean[m.end():].strip()}".strip()
        return (kind, extra, edited, bool(extra), *NO_SYS)

    # iOS: el LRM marca contenido generado por la app. Si hay texto antes del LRM es un caption de multimedia.
    clean = body.replace(LRM, "").strip()
    before, _, after = body.partition(LRM)
    after = after.replace(LRM, "").strip()
    caption = bool(before.strip())
    kind = _app_text(after, locale)
    if kind is not None:
        if kind == "poll":
            text = canonical_poll(after, locale)
        elif kind in KEEP_TEXT:  # conservamos el contenido
            text = after if not caption else f"{before.strip()} {after}"
        else:
            text = before.strip() if caption else ""
        return (kind, text, edited, caption, *NO_SYS)
    # Los avisos reales empiezan con el LRM: con texto antes ("@‎Tomi⁩ left" escrito por una persona) es texto.
    sys = None if caption else system_event(after, locale)
    if sys is not None:
        return ("system", after, edited, False, *sys)
    # Menciones (@todos) y otros LRM sueltos: es texto.
    return ("text", clean, edited, False, *NO_SYS)


def _to_datetime(d: str, m: str, y: str, hh: str, mm: str, ss: str | None, ampm: str | None) -> datetime:
    year = int(y)
    if year < 100:
        year += 2000
    hour = int(hh)
    if ampm:
        hour = hour % 12 + (12 if ampm in "pP" else 0)
    return datetime(year, int(m), int(d), hour, int(mm), int(ss or 0))


def _message(ts: datetime, sender: str, body_lines: list[str], system: bool, locale: Locale) -> Message:
    kind, body, edited, caption, ev, who, by = _classify("\n".join(body_lines).strip(), locale, system)
    return Message(ts, sender, body, kind, edited, caption, ev, who, by)


def iter_messages(lines: Iterable[str], locale: Locale = IOS_ES, date_order: str = "dmy") -> Iterator[Message]:
    """Mensajes de las líneas de un export ya detectado. date_order "mdy" lee la fecha como m/d; "dmy" y
    "ambiguous", como d/m."""
    match = locale.header.match
    android = locale.platform == "android"
    mdy = date_order == "mdy"
    ts = sender = system = None
    body_lines: list[str] | None = None  # None hasta la primera cabecera (lo de antes se ignora)

    for line in lines:
        line = line.rstrip("\r\n")
        m = match(line)
        if m is not None:
            d, mo, y, hh, mi, ss, ampm, rest = m.groups()  # d, m, y, hh, mm, ss, ampm, rest (ver locales)
            i = rest.find(": ", 1)  # el remitente llega hasta el primer ": " (y no es vacío)
            # iOS siempre tiene remitente: sin él, es una línea de texto que parece cabecera
            if i > 0 or android:
                try:
                    new_ts = _to_datetime(mo, d, y, hh, mi, ss, ampm) if mdy else _to_datetime(d, mo, y, hh, mi, ss, ampm)
                except ValueError:  # fecha imposible (31/2): no es una cabecera
                    new_ts = None
                if new_ts is not None:
                    if body_lines is not None:
                        yield _message(ts, sender, body_lines, system, locale)
                    ts = new_ts
                    if i > 0:
                        sender = rest[:i].replace(LRM, "")
                        if "~" in sender:  # "~ Nombre": quien no está en los contactos
                            sender = sender.replace("~\u202f", "").replace("~ ", "")
                        sender, body_lines, system = sender.strip(), [rest[i + 2:]], False
                    else:
                        sender, body_lines, system = SYSTEM_SENDER, [rest], True
                    continue
        if body_lines is not None:
            body_lines.append(line)
    if body_lines is not None:
        yield _message(ts, sender, body_lines, system, locale)


def _detect_path(path: str, locale: Locale | None = None) -> tuple[Locale, str]:
    """Locale y orden de fecha de un archivo. Si las primeras líneas no deciden el orden, mira el archivo entero
    (solo en ese caso: es una pasada extra)."""
    with open(path, encoding="utf-8", errors="replace") as f:
        head = list(islice(f, DETECT_LINES))
        if locale is None:
            locale, order = detect(head)
        else:
            order = infer_date_order(head, locale)
        if order == "ambiguous":
            f.seek(0)
            order = infer_date_order(f, locale)
    return locale, order


def detect_format(path: str) -> dict:
    """{"platform", "lang", "date_order", "verified"} del export en `path`. UnknownFormat si no se reconoce."""
    locale, order = _detect_path(path)
    return {"platform": locale.platform, "lang": locale.lang, "date_order": order, "verified": locale.verified}


def parse_file(path: str, locale: Locale | None = None, date_order: str | None = None) -> Iterator[Message]:
    """Mensajes del export en `path`; detecta el locale y el orden de fecha si no se pasan."""
    if locale is None or date_order is None:
        locale, detected = _detect_path(path, locale)
        date_order = date_order or detected
    with open(path, encoding="utf-8", errors="replace") as f:
        yield from iter_messages(f, locale, date_order)
