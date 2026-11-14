"""Nombres de contacto -> nombres cortos canónicos, cargados de content/people.json (sin nombres en el código)."""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from wa.slugs import slug

GROUP = "__grupo__"
SYSTEM_SENDER = "__system__"  # remitente de los avisos sin firma (Android): el parser lo pone, es el grupo
YOU = ("Tú", "You")  # cómo el export llama al dueño en sus propios mensajes de sistema
# Apodo entre comillas en el nombre de contacto: "..." “...” ‘...’ o '...' (la simple recta, solo si no es un apóstrofo).
# analyze.quoted_nickname lo extrae; contact_surnames lo quita antes de buscar apellidos.
QUOTED_RE = re.compile(r"\"([^\"]+)\"|“([^”]+)”|‘([^’]+)’|(?<!\w)'([^']+)'(?!\w)")
SURNAME_MIN_CHARS = 4


@dataclass(frozen=True)
class People:
    """me: nombre corto del dueño del export. group_senders: títulos con que el export firma al grupo.
    names: nombre de contacto crudo -> nombre corto. aliases: palabras en minúscula que el grupo usa como nombres
    (apodos) y que el detector de muletillas no debe tratar como frases."""

    me: str | None = None
    group_senders: frozenset[str] = frozenset()
    names: dict[str, str] = field(default_factory=dict)
    aliases: frozenset[str] = frozenset()

    @property
    def raw_names(self) -> tuple[str, ...]:
        return tuple(self.names)

    def canonical(self, raw: str) -> str:
        """Nombre corto de un remitente crudo; el grupo (o un remitente que empieza con su título, porque el export
        a veces lo trunca o le agrega texto) es '__grupo__'; lo desconocido vuelve igual, sin espacios de borde."""
        name = raw.strip()
        if name == SYSTEM_SENDER:
            return GROUP
        if name in YOU and self.me:  # antes que el mapa: un --me explícito pisa a la entrada "Tú" del archivo
            return self.me
        if raw in self.names:
            return self.names[raw]
        if name in self.names:
            return self.names[name]
        if any(name.startswith(g) for g in self.group_senders):
            return GROUP
        if name in YOU and self.me:
            return self.me
        return name

    def short_names(self) -> set[str]:
        return set(self.names.values())

    def contact_surnames(self) -> set[str]:
        """Apellidos (en minúscula) de los nombres de contacto: lo que queda tras quitar el apodo entre comillas y el
        primer nombre ('Bruno "Brujo" Castro' -> {'castro'})."""
        out = set()
        for full in self.names:
            words = re.findall(r"\w+", QUOTED_RE.sub(" ", full).lower())
            out.update(w for w in words[1:] if len(w) >= SURNAME_MIN_CHARS)
        return out


class PeopleError(ValueError):
    """people.json ilegible o con la forma equivocada."""


def _str_list(data: dict, key: str, path: Path) -> list[str]:
    value = data.get(key, [])
    if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
        raise PeopleError(f"{path}: '{key}' debe ser una lista de textos")
    return value


def _check_slugs(names: dict[str, str], path: Path) -> None:
    """Two different short names with one slug would share a profile (the web keys people by wa.slugs.slug). The same
    short name for several contact names (one person, two contacts, or the export's own "Tú"/"You") is fine."""
    seen: dict[str, str] = {}
    for short in names.values():
        other = seen.setdefault(slug(short), short)
        if other != short:
            raise PeopleError(f"{path}: short names {other!r} and {short!r} would share the profile {slug(short)!r}: "
                              f"rename one")


def load_people(path: Path | None, me: str | None = None) -> People:
    """Lee people.json ({"me","group","people","aliases"}); `me` pisa al del archivo. Sin archivo, el mapa queda vacío
    y todo remitente se devuelve tal cual ('Tú'/'You' -> me, si hay). Un archivo ilegible levanta PeopleError."""
    if path is None:
        return People(me=me)
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except OSError as e:
        raise PeopleError(f"no se pudo leer {path}: {e}") from e
    except json.JSONDecodeError as e:
        raise PeopleError(f"{path} no es JSON válido: {e}") from e
    if not isinstance(data, dict):
        raise PeopleError(f"{path} debe contener un objeto JSON")
    names = data.get("people", {})
    if not isinstance(names, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in names.items()):
        raise PeopleError(f"{path}: 'people' debe ser un objeto de nombre de contacto a nombre corto")
    if data.get("me") is not None and not isinstance(data["me"], str):
        raise PeopleError(f"{path}: 'me' debe ser un texto")
    _check_slugs(names, path)
    return People(
        me=me or data.get("me"),
        group_senders=frozenset(g for g in _str_list(data, "group", path) if g),  # "" haría que todo remitente fuera el grupo
        names=dict(names),
        aliases=frozenset(_str_list(data, "aliases", path)),
    )


def load_people_cli(path: str | Path, me: str | None = None, quiet: bool = False) -> People:
    """load_people para los CLIs: sin archivo sigue sin nombres de contacto (una línea a stderr, salvo quiet); con
    un archivo malformado sale con un mensaje que nombra la ruta, sin traceback."""
    path = Path(path)
    if not path.is_file():
        if not quiet:
            print(f"no encuentro {path}: sigo sin nombres de contacto", file=sys.stderr)
        return load_people(None, me=me)
    try:
        return load_people(path, me=me)
    except PeopleError as e:
        raise SystemExit(str(e)) from e
