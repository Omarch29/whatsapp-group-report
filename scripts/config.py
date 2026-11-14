"""Loader for report.config.json (stdlib only)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Literal

LANGS = ("es", "en")
MODES = ("single", "full")

# JSON key (camelCase) -> dataclass field (snake_case)
_KEYS = {
    "title": "title",
    "lang": "lang",
    "mode": "mode",
    "chat": "chat",
    "background": "background",
    "me": "me",
    "departer": "departer",
    "departerAliases": "departer_aliases",
    "gate": "gate",
    "verifiedOn": "verified_on",
}
_REQUIRED = ("title", "chat")


class ConfigError(ValueError):
    pass


@dataclass(frozen=True, kw_only=True)
class ReportConfig:
    title: str
    chat: str
    lang: Literal["es", "en"] = "es"
    mode: Literal["single", "full"] = "full"
    background: tuple[str, ...] = ()
    me: str | None = None
    departer: str | None = None
    departer_aliases: tuple[str, ...] = ()  # cómo lo llama el chat; vacío = los arma build_pipeline (apodo, contacto)
    gate: bool = True
    verified_on: str = ""

    def __post_init__(self) -> None:
        if not self.verified_on:
            object.__setattr__(self, "verified_on", date.today().isoformat())

    def check_people(self, names: set[str]) -> None:
        for field in ("me", "departer"):
            value = getattr(self, field)
            if value is not None and value not in names:
                raise ConfigError(f"{field} '{value}' no está entre las personas: {sorted(names)}")


def _validate(raw: dict[str, Any]) -> dict[str, Any]:
    unknown = sorted(set(raw) - set(_KEYS))
    if unknown:
        raise ConfigError(f"claves desconocidas: {unknown}; válidas: {sorted(_KEYS)}")
    for key in _REQUIRED:
        if key not in raw:
            raise ConfigError(f"falta la clave obligatoria '{key}'")

    for key in ("title", "chat", "verifiedOn"):
        if key in raw and not (isinstance(raw[key], str) and raw[key]):
            raise ConfigError(f"'{key}' debe ser un texto no vacío")
    for key in ("me", "departer"):
        if raw.get(key) is not None and not (isinstance(raw[key], str) and raw[key]):
            raise ConfigError(f"'{key}' debe ser un texto no vacío o null")
    if "gate" in raw and not isinstance(raw["gate"], bool):
        raise ConfigError("'gate' debe ser true o false")
    if "lang" in raw and raw["lang"] not in LANGS:
        raise ConfigError(f"'lang' debe ser uno de {list(LANGS)}, no {raw['lang']!r}")
    if "mode" in raw and raw["mode"] not in MODES:
        raise ConfigError(f"'mode' debe ser uno de {list(MODES)}, no {raw['mode']!r}")
    bg = raw.get("background", [])
    if not isinstance(bg, list) or not all(isinstance(x, str) for x in bg):
        raise ConfigError("'background' debe ser una lista de textos")
    aliases = raw.get("departerAliases", [])
    if not isinstance(aliases, list) or not all(isinstance(x, str) and x for x in aliases):
        raise ConfigError("'departerAliases' debe ser una lista de textos no vacíos")
    if "verifiedOn" in raw:
        try:
            date.fromisoformat(raw["verifiedOn"])
        except ValueError:
            raise ConfigError(f"'verifiedOn' debe ser una fecha ISO (AAAA-MM-DD), no {raw['verifiedOn']!r}") from None

    kwargs = {_KEYS[k]: v for k, v in raw.items()}
    for key in ("background", "departer_aliases"):
        if key in kwargs:
            kwargs[key] = tuple(kwargs[key])
    return kwargs


def load_config(path: Path = Path("report.config.json")) -> ReportConfig:
    try:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
    except OSError as e:
        raise ConfigError(f"no se pudo leer {path}: {e}") from e
    except json.JSONDecodeError as e:
        raise ConfigError(f"{path} no es JSON válido: {e}") from e
    if not isinstance(raw, dict):
        raise ConfigError(f"{path} debe contener un objeto JSON")
    return ReportConfig(**_validate(raw))
