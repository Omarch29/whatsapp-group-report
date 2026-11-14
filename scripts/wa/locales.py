"""Formatos de export de WhatsApp: plataforma (iOS/Android) × idioma (es/en), y su detección.

Todo lo que depende del export vive acá (cabecera, textos que pone la app, avisos del sistema); `parser.py` no tiene
ningún texto de la app. Cada `Locale` es una constante; `LOCALES` las indexa por (plataforma, idioma).

Qué está verificado
-------------------
Solo **ios/es** está verificado contra exports reales (`verified=True`). Las otras tres salen de documentación
pública y ejemplos de usuarios (`verified=False`); hasta ver un export real, todas sus líneas son supuestas:

- ios/es (verificado). Sin verificar dentro de este locale: "Creaste este grupo" / "Creaste el grupo “X”"; la
  cabecera de 24 h (`[13/11/26, 14:05:09]`) y `p.m.` sin espacio; "Cambió tu código de seguridad con X"; la
  pregunta de una encuesta en su propia línea.
- ios/en (sin verificar): cabecera `[11/13/26, 2:05:09 PM]` (con U+202F o espacio antes de AM/PM) y su variante
  de 24 h; multimedia `image/audio/sticker/video/GIF/video note/document omitted`, `Contact card omitted`,
  `Location: https://maps.google.com…`; llamadas `(Missed) voice/video call`; borrados `This message was
  deleted.` / `You deleted this message.`; editado `<This message was edited>`; encuestas `POLL:` +
  `OPTION: x (n votes)`; sistema `created group “X”`, `added`, `joined using this group's invite link`, `left`,
  `removed`, `changed the group name to “X”`, `changed this group's icon`, `changed the group description`,
  `pinned a message`, `changed this group's settings`, `Your security code with X changed`, `You're now an admin`.
- android/es (sin verificar): cabecera `13/11/26, 2:05 p. m. - ` y `13/11/26 14:05 - ` (coma opcional, sin
  segundos, `p. m.`/`p.m.`); `<Multimedia omitido>` (kind `media`), `ubicación: https://maps.google.com/?q=…`;
  borrados sin punto final; editado `<Se editó este mensaje.>`; encuestas `ENCUESTA:` + `OPCIÓN: x (n votos)`;
  avisos sin remitente: `creó el grupo "X"`, `añadió a`/`agregó a`, `Añadiste a`, `se unió usando el enlace de
  invitación de este grupo`, `salió`, `eliminó a`, `cambió el asunto de "A" a "X"`, `cambió el ícono del grupo`,
  `cambió la descripción del grupo`, `fijó un mensaje`, `cambió los ajustes`, `Cambió el código de seguridad de
  X`, `Ahora eres admin`.
- android/en (sin verificar): cabecera `11/13/26, 2:05 PM - ` y `11/13/26, 14:05 - `; `<Media omitted>`,
  `location: https://maps.google.com/?q=…`; borrados sin punto final; avisos como ios/en pero
  `changed the subject from "A" to "X"` y `X's security code changed`.

Convenciones de los patrones
----------------------------
- `header`: grupos `d, m, y, hh, mm, ss?, ampm?, rest`. `d`/`m` son las dos primeras cifras de la fecha en el
  orden en que aparecen: con `date_order == "mdy"` el parser las invierte. `ampm` es solo la letra (a/p).
- `media`, `deleted`, `system` se aplican con `.search` sobre el cuerpo sin LRM. En iOS el cuerpo es lo que sigue
  al primer LRM (la marca de "texto puesto por la app"); en Android, el cuerpo entero (Android no pone LRM), por eso
  sus patrones van anclados con `^…$`. Los de ios/es encuentran la frase en cualquier parte del cuerpo, igual que
  el parser verificado de antes (paridad con los exports reales).
- `system`: grupos opcionales `who` (a quién le pasó), `by` (quién lo hizo), `name` (nombre nuevo del grupo). Si
  el dueño del export es el sujeto u objeto y el idioma no lo nombra ("Añadiste a X", "Te uniste"), el patrón
  marca el grupo vacío `by_you` / `who_you`. Un `who`/`by` que es "Tú"/"You" (ver `you`) también es el dueño.
  El primer patrón que matchea gana: los genéricos (añadir, quitar, salir) van al final.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from itertools import islice
from typing import Iterable, Literal

LRM = "\u200e"
SP = "[\\s\u00a0\u202f]"  # espacio, NBSP o U+202F (iOS y Android nuevos usan U+202F antes de a. m./PM)
DETECT_LINES = 50
MIN_MATCHES = 3


class UnknownFormat(ValueError):
    """Ninguna cabecera conocida matchea al menos MIN_MATCHES de las primeras líneas."""


@dataclass(frozen=True)
class Locale:
    platform: Literal["ios", "android"]
    lang: Literal["es", "en"]
    verified: bool
    header: re.Pattern
    media: tuple[tuple[str, re.Pattern], ...]  # (kind, patrón); incluye location, call y pending
    deleted: re.Pattern
    edited_mark: str
    poll_prefix: str
    poll_option: re.Pattern  # grupos label, n
    system: tuple[tuple[str, re.Pattern], ...]  # (sys_event, patrón)
    you: tuple[str, ...]  # cómo el export nombra al dueño


_DATE = r"(?P<d>\d{1,2})/(?P<m>\d{1,2})/(?P<y>\d{2,4})"
_TIME = r"(?P<hh>\d{1,2}):(?P<mm>\d{2})(?::(?P<ss>\d{2}))?"
_AMPM = {"es": rf"(?P<ampm>[ap])\.{SP}?m\.", "en": r"(?P<ampm>[AaPp])\.?[Mm]\.?"}


def _ios_header(lang: str) -> re.Pattern:
    return re.compile(rf"^{LRM}?\[{_DATE},{SP}{_TIME}(?:{SP}{_AMPM[lang]})?\]{SP}(?P<rest>.*)$")


def _android_header(lang: str) -> re.Pattern:
    return re.compile(rf"^{LRM}?{_DATE},?{SP}{_TIME}(?:{SP}?{_AMPM[lang]})?{SP}-{SP}(?P<rest>.*)$")


def _pats(pairs: list[tuple[str, str]]) -> tuple[tuple[str, re.Pattern], ...]:
    return tuple((key, re.compile(p)) for key, p in pairs)


Q, QE = "[“\"]", "[”\"]"  # comillas de apertura / cierre de un nombre de grupo
APOS = "['’]"
# ios/es busca la frase en cualquier parte del cuerpo (como el parser verificado). Con `^` y un prefijo perezoso que
# cruza saltos de línea, la búsqueda es lineal: un `(?:(?P<by>.+?) )?` sin anclar es cuadrático en los textos largos.
ANY = r"^(?s:.*?)"
BY = r"^(?P<by>(?s:.*?)) ?"
WHO = r"^(?P<who>(?s:.*?)) ?"

IOS_ES = Locale(
    platform="ios", lang="es", verified=True,
    header=_ios_header("es"),
    media=_pats([
        ("image", r"^imagen omitida$"),
        ("audio", r"^audio omitido$"),
        ("sticker", r"^sticker omitido$"),
        ("video", r"^Video omitido$"),
        ("gif", r"^GIF omitido$"),
        ("video_note", r"^se omitió la nota de video$"),
        ("document", r"documento omitido$"),
        ("contact", r"^Tarjeta de contacto omitida$"),
        ("location", r"^Ubicación: https://maps\.google\.com"),
        ("call", r"^(Videollamada|Llamada)"),
        ("pending", r"^Esperando el mensaje\. Esto puede tomar tiempo\.$"),
    ]),
    deleted=re.compile(r"^(Se eliminó este mensaje\.|Eliminaste este mensaje\.|Un admin\..*eliminó este mensaje)"),
    edited_mark="<Se editó este mensaje.>",
    poll_prefix="ENCUESTA:",
    poll_option=re.compile(r"^OPCIÓN: (?P<label>.*) \((?P<n>\d+) votos?\)$"),
    system=_pats([
        ("created", rf"{BY}creó (?:este grupo|el grupo)(?: {Q}(?P<name>.*){QE})?"),
        ("created", rf"{ANY}(?P<by_you>)Creaste (?:este grupo|el grupo)(?: {Q}(?P<name>.*){QE})?"),
        ("name_changed", rf"{ANY}(?P<by_you>)Cambiaste el nombre del grupo(?: a {Q}(?P<name>.*){QE})?"),
        ("name_changed", rf"{BY}cambió el nombre del grupo(?: a {Q}(?P<name>.*){QE})?"),
        ("photo_changed", rf"{ANY}(?P<by_you>)Cambiaste el ícono de este grupo"),
        ("photo_changed", rf"{BY}cambió la imagen de este grupo"),
        ("description_changed", rf"{ANY}(?P<by_you>)Cambiaste la descripción del grupo"),
        ("description_changed", rf"{BY}cambió la descripción del grupo"),
        ("pinned", rf"{ANY}(?P<by_you>)Fijaste un mensaje"),
        ("pinned", rf"{BY}fijó un mensaje"),
        ("settings", rf"{ANY}(?P<by_you>)Cambiaste los ajustes"),
        ("settings", rf"{BY}cambió los ajustes"),
        ("security_code", rf"{ANY}Cambió tu código de seguridad(?: con (?P<who>[^.]+))?"),
        ("encryption", rf"{ANY}Los mensajes y las llamadas están cifrados"),
        ("admin", rf"{WHO}(?:ahora es admin|ya no es admin)"),
        ("joined_link", rf"{ANY}(?P<who_you>)Te uniste con el enlace"),
        ("joined_link", rf"{WHO}se unió con el enlace"),
        ("left", rf"{ANY}(?P<who_you>)Saliste del grupo"),
        ("left", rf"{WHO}salió del grupo"),
        ("removed", rf"{ANY}(?P<by_you>)Quitaste a(?: (?P<who>.*))?"),
        ("removed", rf"{BY}quitó a(?: (?P<who>.*))?"),
        ("added", rf"{ANY}Se añadió a(?: (?P<who>.*))?"),
        ("added", rf"{ANY}(?P<by_you>)Añadiste a(?: (?P<who>.*))?"),
        ("added", rf"{BY}te añadió(?P<who_you>)"),
        ("added", rf"{BY}añadió a(?: (?P<who>.*))?"),
    ]),
    you=("Tú",),
)

_EN_SYSTEM_COMMON = [
    ("created", rf"^(?P<by>.+?) created (?:group {Q}(?P<name>.*){QE}|this group)\.?$"),
    ("name_changed", rf"^(?P<by>.+?) changed the group name to {Q}(?P<name>.*){QE}\.?$"),
    ("name_changed", rf"^(?P<by>.+?) changed the subject (?:from {Q}.*?{QE} )?to {Q}(?P<name>.*){QE}\.?$"),
    ("photo_changed", rf"^(?P<by>.+?) changed (?:this group{APOS}s icon|the group icon|this group{APOS}s photo)\.?$"),
    ("description_changed", r"^(?P<by>.+?) changed the group description\.?$"),
    ("pinned", r"^(?P<by>.+?) pinned a message\.?$"),
    ("settings", rf"^(?P<by>.+?) changed (?:this group{APOS}s|the group{APOS}s|the group|the) settings\b.*$"),
    ("security_code", r"^Your security code with (?P<who>.+?) changed\b.*$"),
    ("security_code", rf"^(?P<who>.+?){APOS}s security code changed\b.*$"),
    ("encryption", r"^Messages and calls are end-to-end encrypted\b.*$"),
    ("admin", rf"^(?P<who_you>)You{APOS}re (?:now|no longer) an admin\b.*$"),
    ("admin", r"^(?P<who>.+?) is (?:now|no longer) an admin\b.*$"),
    ("joined_link", rf"^(?P<who>.+?) joined using this group{APOS}s invite link\.?$"),
    ("left", r"^(?P<who>.+?) left\.?$"),
    ("removed", r"^(?P<by>.+?) removed (?P<who>.+?)\.?$"),
    ("added", r"^(?P<who>.+?) (?:was|were) added\.?$"),
    ("added", r"^(?P<by>.+?) added (?P<who>.+?)\.?$"),
]

IOS_EN = Locale(
    platform="ios", lang="en", verified=False,
    header=_ios_header("en"),
    media=_pats([
        ("image", r"^image omitted$"),
        ("audio", r"^audio omitted$"),
        ("sticker", r"^sticker omitted$"),
        ("video", r"^video omitted$"),
        ("gif", r"^GIF omitted$"),
        ("video_note", r"^video note omitted$"),
        ("document", r"document omitted$"),
        ("contact", r"^Contact card omitted$"),
        ("location", r"^Location: https://maps\.google\.com"),
        ("call", r"^(?:Missed )?(?:[Gg]roup )?(?:[Vv]oice|[Vv]ideo) call"),
        ("pending", r"^Waiting for this message\. This may take a while\.$"),
    ]),
    deleted=re.compile(r"^(This message was deleted\.|You deleted this message\.|This message was deleted by)"),
    edited_mark="<This message was edited>",
    poll_prefix="POLL:",
    poll_option=re.compile(r"^OPTION: (?P<label>.*) \((?P<n>\d+) votes?\)$"),
    system=_pats(_EN_SYSTEM_COMMON),
    you=("You",),
)

ANDROID_ES = Locale(
    platform="android", lang="es", verified=False,
    header=_android_header("es"),
    media=_pats([
        ("media", r"^<Multimedia omitido>"),
        ("location", r"^[Uu]bicación: https://maps\.google\.com"),
        ("pending", r"^Esperando este mensaje\. Esto puede tardar un poco\.?$"),
    ]),
    deleted=re.compile(r"^(?:Se eliminó este mensaje|Eliminaste este mensaje)\.?$"),
    edited_mark="<Se editó este mensaje.>",
    poll_prefix="ENCUESTA:",
    poll_option=re.compile(r"^OPCIÓN: (?P<label>.*) \((?P<n>\d+) votos?\)$"),
    system=_pats([
        ("created", rf"^(?:(?P<by_you>)Creaste|(?P<by>.+?) creó) (?:el grupo {Q}(?P<name>.*){QE}|este grupo)\.?$"),
        ("name_changed", rf"^(?:(?P<by_you>)Cambiaste|(?P<by>.+?) cambió) el (?:asunto|nombre del grupo) "
                         rf"(?:de {Q}.*?{QE} )?a {Q}(?P<name>.*){QE}\.?$"),
        ("photo_changed", r"^(?:(?P<by_you>)Cambiaste|(?P<by>.+?) cambió) (?:el ícono|el icono|la imagen|la foto) "
                          r"(?:del|de este) grupo\.?$"),
        ("description_changed", r"^(?:(?P<by_you>)Cambiaste|(?P<by>.+?) cambió) la descripción del grupo\.?$"),
        ("pinned", r"^(?:(?P<by_you>)Fijaste|(?P<by>.+?) fijó) un mensaje\.?$"),
        ("settings", r"^(?:(?P<by_you>)Cambiaste|(?P<by>.+?) cambió) (?:los ajustes|la configuración)\b.*$"),
        ("security_code", r"^Cambió el código de seguridad de (?P<who>.+?)\.(?: .*)?$"),
        ("security_code", r"^Tu código de seguridad con (?P<who>.+?) cambió\b.*$"),
        ("encryption", r"^Los mensajes y las llamadas están cifrados de extremo a extremo\b.*$"),
        ("admin", r"^(?P<who_you>)(?:Ahora eres admin|Ya no eres admin)\b.*$"),
        ("joined_link", r"^(?:(?P<who_you>)Te uniste|(?P<who>.+?) se unió) (?:usando el|con el) enlace"
                        r"(?: de invitación)?(?: de este grupo| del grupo)?\.?$"),
        ("left", r"^(?:(?P<who_you>)Saliste|(?P<who>.+?) salió)(?: del grupo)?\.?$"),
        ("removed", r"^(?:(?P<by_you>)Eliminaste|(?P<by>.+?) eliminó) a (?P<who>.+?)\.?$"),
        ("removed", r"^(?P<by>.+?) te eliminó(?P<who_you>)\.?$"),
        ("added", r"^(?:(?P<by_you>)(?:Añadiste|Agregaste)|(?P<by>.+?) (?:añadió|agregó)) a (?P<who>.+?)\.?$"),
        ("added", r"^(?P<by>.+?) te (?:añadió|agregó)(?P<who_you>)\.?$"),
    ]),
    you=("Tú",),
)

ANDROID_EN = Locale(
    platform="android", lang="en", verified=False,
    header=_android_header("en"),
    media=_pats([
        ("media", r"^<Media omitted>"),
        ("location", r"^[Ll]ocation: https://maps\.google\.com"),
        ("pending", r"^Waiting for this message\. This may take a while\.?$"),
    ]),
    deleted=re.compile(r"^(?:This message was deleted|You deleted this message)\.?$"),
    edited_mark="<This message was edited>",
    poll_prefix="POLL:",
    poll_option=re.compile(r"^OPTION: (?P<label>.*) \((?P<n>\d+) votes?\)$"),
    system=_pats(_EN_SYSTEM_COMMON),
    you=("You",),
)

# Orden = desempate de la detección: ios antes que android, es antes que en.
LOCALES: dict[tuple[str, str], Locale] = {
    ("ios", "es"): IOS_ES,
    ("ios", "en"): IOS_EN,
    ("android", "es"): ANDROID_ES,
    ("android", "en"): ANDROID_EN,
}


def _order(pairs: Iterable[tuple[int, int]]) -> str:
    seconds_over = False
    for first, second in pairs:
        if first > 12:
            return "dmy"
        seconds_over = seconds_over or second > 12
    return "mdy" if seconds_over else "ambiguous"


def infer_date_order(lines: Iterable[str], locale: Locale) -> str:
    """"dmy" si alguna fecha tiene la primera cifra > 12, si no "mdy" si alguna tiene la segunda > 12, si no
    "ambiguous" (el parser lo lee como d/m). Recorre todo `lines`: quien quiera acotar, que pase un trozo."""
    match = locale.header.match
    return _order((int(m["d"]), int(m["m"])) for line in lines if (m := match(line.rstrip("\r\n"))))


def _evidence(locale: Locale, rests: list[str]) -> int:
    """Cuántos cuerpos llevan un texto que pone la app en el idioma del locale (desempate de cabeceras iguales:
    las de 24 h no dicen el idioma)."""
    n = 0
    for rest in rests:
        i = rest.find(": ", 1)
        body = (rest[i + 2:] if i > 0 else rest).replace(LRM, "").strip()
        if (body.startswith(locale.poll_prefix) or locale.edited_mark in body or locale.deleted.search(body)
                or any(p.search(body) for _, p in locale.media) or any(p.search(body) for _, p in locale.system)):
            n += 1
    return n


def detect(lines: Iterable[str]) -> tuple[Locale, str]:
    """(locale, date_order) a partir de las primeras DETECT_LINES líneas: gana el locale cuya cabecera matchea más
    líneas; a igualdad, el que tenga más textos de la app en su idioma; después, el orden de LOCALES. Con menos de
    MIN_MATCHES cabeceras, UnknownFormat con las dos primeras líneas. Si la cabecera no dice el idioma (la de 24 h
    matchea igual en es y en en) y ningún texto de la app lo dice tampoco, UnknownFormat: puede ser un export en otro
    idioma (italiano, portugués...) y leerlo como castellano daría números falsos."""
    head = [line.rstrip("\r\n") for line in islice(lines, DETECT_LINES)]
    best, scored = None, []
    for rank, loc in enumerate(LOCALES.values()):
        matches = [m for line in head if (m := loc.header.match(line))]
        if len(matches) < MIN_MATCHES:
            continue
        key = (len(matches), _evidence(loc, [m["rest"] for m in matches]), -rank)
        scored.append((key, loc))
        if best is None or key > best[0]:
            best = (key, loc, matches)
    if best is None:
        first = (head + ["", ""])[:2]
        raise UnknownFormat(
            f"No reconozco el formato del export. Primeras líneas:\n{first[0]}\n{first[1]}\n"
            "Si es un export de WhatsApp, abrí un issue con una muestra de 20 líneas (sin datos personales)."
        )
    key, loc, matches = best
    tied = [k for k, other in scored if other.lang != loc.lang and k[0] == key[0]]
    if tied and not key[1] and not any(k[1] for k in tied):
        raise UnknownFormat(
            f"El export parece de WhatsApp ({loc.platform}, hora de 24 h) pero no reconozco su idioma: solo se "
            f"soportan castellano (es) e inglés (en). Si está en uno de ellos, abrí un issue con una muestra de 20 "
            f"líneas que incluya avisos de la app (multimedia omitida, mensajes borrados, altas), sin datos "
            f"personales."
        )
    return loc, _order((int(m["d"]), int(m["m"])) for m in matches)
