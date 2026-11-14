"""La historia en las líneas exactas de cada formato de export (los de tests/fixtures/formats/), y los archivos de
contenido que la acompañan.

- iOS: `[d/m/aa, h:mm:ss a. m.] Nombre: texto` (U+202F antes de "a. m."/"PM"); lo que pone la app (multimedia,
  borrados, encuestas, avisos) lleva un LRM al principio de la línea y del cuerpo; los avisos los firma el grupo;
  menciones `@⁨Nombre⁩` (aisladores U+2068/U+2069).
- Android: `d/m/aa, h:mm a. m. - Nombre: texto`, sin segundos ni LRM; multimedia `<Multimedia omitido>` (salvo la
  ubicación); avisos sin remitente; menciones `@Nombre`.
`date_order` "mdy" escribe mes/día (el default en inglés).
"""
from __future__ import annotations

import json
from datetime import timedelta

from synth import cast
from synth.cast import BY_SHORT, ME
from synth.story import Event, Story
from wa.lang import Lang
from wa.locales import LRM, Locale

NNBSP = " "
FSI, PDI = "⁨", "⁩"
MAPS = "https://maps.google.com/?q={lat},{lon}"

IOS_MEDIA = {
    "es": {"image": "imagen omitida", "audio": "audio omitido", "sticker": "sticker omitido", "video": "Video omitido",
           "gif": "GIF omitido", "video_note": "se omitió la nota de video", "document": "documento omitido",
           "contact": "Tarjeta de contacto omitida", "location": "Ubicación: "},
    "en": {"image": "image omitted", "audio": "audio omitted", "sticker": "sticker omitted", "video": "video omitted",
           "gif": "GIF omitted", "video_note": "video note omitted", "document": "document omitted",
           "contact": "Contact card omitted", "location": "Location: "},
}
ANDROID_MEDIA = {"es": ("<Multimedia omitido>", "ubicación: "), "en": ("<Media omitted>", "location: ")}
DELETED = {"es": ("Se eliminó este mensaje.", "Eliminaste este mensaje."),
           "en": ("This message was deleted.", "You deleted this message.")}
EDITED = {"es": "<Se editó este mensaje.>", "en": "<This message was edited>"}
POLL = {"es": ("ENCUESTA:", "OPCIÓN: {label} ({n} {unit})", ("voto", "votos")),
        "en": ("POLL:", "OPTION: {label} ({n} {unit})", ("vote", "votes"))}
ENCRYPTION = {"es": "Los mensajes y las llamadas están cifrados de extremo a extremo. Solo las personas en este chat "
                    "pueden leerlos, escucharlos o compartirlos",
              "en": "Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or "
                    "share them"}
YOU = {"es": "Tú", "en": "You"}


def _raw(short: str) -> str:
    return BY_SHORT[short].raw


def system_text(e: Event, platform: str, lang: str) -> str:
    """Texto de un aviso del sistema en el formato (sin LRM ni cabecera)."""
    ev = e.kind.split(":", 1)[1]
    by = _raw(e.tag["by"]) if e.tag.get("by") else ""
    who = _raw(e.tag["who"]) if e.tag.get("who") else ""
    name, old = e.tag.get("name", ""), e.tag.get("old", "")
    ios = platform == "ios"
    q = ("“", "”") if ios else ('"', '"')
    dot = "." if ios else ""
    if ev == "encryption":
        return ENCRYPTION[lang] + dot
    if lang == "es":
        if ev == "created":
            return f"{by} creó el grupo {q[0]}{name}{q[1]}"
        if ev == "added":
            if e.tag["who"] == ME:
                return f"{by} te añadió{dot}"
            if e.tag["by"] == ME:
                return f"Añadiste a {who}{dot}"
            return f"{by} añadió a {who}{dot}"
        if ev == "joined_link":
            return f"{who} se unió con el enlace del grupo." if ios else \
                f"{who} se unió usando el enlace de invitación de este grupo"
        if ev == "left":
            return f"{who} salió del grupo." if ios else f"{who} salió"
        if ev == "name_changed":
            return f"{by} cambió el nombre del grupo a “{name}”" if ios else \
                f'{by} cambió el asunto de "{old}" a "{name}"'
        if ev == "photo_changed":
            return f"{by} cambió la imagen de este grupo" if ios else f"{by} cambió el ícono del grupo"
    else:
        if ev == "created":
            return f"{by} created group {q[0]}{name}{q[1]}"
        if ev == "added":
            if e.tag["who"] == ME:
                return f"{by} added you"
            if e.tag["by"] == ME:
                return f"You added {who}"
            return f"{by} added {who}"
        if ev == "joined_link":
            return f"{who} joined using this group's invite link"
        if ev == "left":
            return f"{who} left"
        if ev == "name_changed":
            return f"{by} changed the group name to “{name}”" if ios else \
                f'{by} changed the subject from "{old}" to "{name}"'
        if ev == "photo_changed":
            return f"{by} changed this group's icon"
    raise ValueError(f"aviso sin texto: {ev!r}")


def _stamp(e: Event, locale: Locale, date_order: str) -> str:
    ts = e.ts
    a, b = (ts.month, ts.day) if date_order == "mdy" else (ts.day, ts.month)
    day = f"{a}/{b}/{ts.year % 100:02d}"
    h12 = ts.hour % 12 or 12
    pm = ts.hour >= 12
    if locale.lang == "es":
        mark = ("p" if pm else "a") + "."
        ampm = f"{mark}{NNBSP}m." if locale.platform == "ios" else f"{mark} m."
        sep = NNBSP if locale.platform == "ios" else " "
    else:
        ampm, sep = ("PM" if pm else "AM"), NNBSP
    if locale.platform == "ios":
        return f"[{day}, {h12}:{ts.minute:02d}:{ts.second:02d}{sep}{ampm}]"
    return f"{day}, {h12}:{ts.minute:02d}{sep}{ampm} -"


def _body(e: Event, locale: Locale) -> tuple[str, bool]:
    """(cuerpo, puesto_por_la_app). En iOS lo puesto por la app va después de un LRM."""
    lang, ios = locale.lang, locale.platform == "ios"
    me = e.sender == ME
    if e.kind == "deleted":
        text = DELETED[lang][me]
        return (text if ios else text.rstrip(".")), True
    if e.kind.startswith("media:"):
        mtype = e.kind.split(":", 1)[1]
        if mtype == "location":
            url = MAPS.format(lat=e.tag["coords"][0], lon=e.tag["coords"][1])
            return (IOS_MEDIA[lang]["location"] if ios else ANDROID_MEDIA[lang][1]) + url, True
        if not ios:
            return ANDROID_MEDIA[lang][0], True
        if mtype == "document":
            pages = f"{e.tag['pages']} {e.tag['pages_word']}"
            return f"{e.tag['doc_name']} • {LRM}{pages} {LRM}{IOS_MEDIA[lang]['document']}", True
        return IOS_MEDIA[lang][mtype], True
    body = e.body
    if e.tag.get("mention"):
        raw = _raw(e.tag["mention"])
        body = f"@{FSI}{raw}{PDI} {body}" if ios else f"@{raw} {body}"
    if e.kind == "edited":
        body = f"{body} {LRM}{EDITED[lang]}" if ios else f"{body} {EDITED[lang]}"
    return body, False


def render(story: Story, locale: Locale, date_order: str) -> list[str]:
    """Las líneas del export (sin salto final) de `story` en `locale`."""
    if locale.lang != story.lang:
        raise ValueError(f"la historia es en {story.lang!r} y el formato en {locale.lang!r}")
    ios, lang = locale.platform == "ios", locale.lang
    out: list[str] = []
    for e in story.events:
        stamp = _stamp(e, locale, date_order)
        if e.kind.startswith("system:"):
            text = system_text(e, locale.platform, lang)
            out.append(f"{LRM}{stamp} {story.title}: {LRM}{text}" if ios else f"{stamp} {text}")
            continue
        sender = _raw(e.sender)
        if e.kind == "poll":
            prefix, option, units = POLL[lang]
            lines = [prefix, e.tag["question"]] + [
                option.format(label=label, n=n, unit=units[n != 1])
                for label, n in zip(e.tag["labels"], e.tag["votes"], strict=True)
            ]
            if ios:
                out.append(f"{LRM}{stamp} {sender}: {LRM}{lines[0]}")
                out.extend(f"{LRM}{line}" for line in lines[1:])
            else:
                out.append(f"{stamp} {sender}: {lines[0]}")
                out.extend(lines[1:])
            continue
        body, app = _body(e, locale)
        first, *rest = body.split("\n")
        if ios and app:
            lead = "" if e.kind == "media:document" else LRM
            out.append(f"{LRM}{stamp} {sender}: {lead}{first}")
        else:
            out.append(f"{stamp} {sender}: {first}")
        out.extend(rest)
    return out


def _json(data) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def content_files(story: Story, lang: Lang) -> dict[str, str]:
    """people.json, events.json, nicknames.json, badwords.txt y conclusion.md coherentes con la historia."""
    v = cast.vocab(story.lang)
    people = {p.raw: p.short for p in story.people}
    people[YOU[story.lang]] = ME
    nick = [p for p in story.people if p.nickname]
    events = []
    for ev, day in sorted(story.event_days.items(), key=lambda kv: kv[1]):
        meta = v.EVENT_META[ev]
        events.append({"id": meta["id"], "title": meta["title"], "terms": meta["terms"],
                       "from": (day - timedelta(days=3)).isoformat(), "to": (day + timedelta(days=1)).isoformat(),
                       "note": meta["note"]})
    words = sorted(set(lang.badwords_base) | set(story.badwords_used))
    return {
        "people.json": _json({"me": ME, "group": [story.title], "people": people,
                              "aliases": [p.nickname.lower() for p in nick]}),
        "events.json": _json(events),
        "nicknames.json": _json({p.short: p.nickname for p in nick}),
        "badwords.txt": v.BADWORDS_HEADER + "\n" + "\n".join(words) + "\n",
        "conclusion.md": v.CONCLUSION,
    }
