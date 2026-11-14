"""Slugs estables para nombres de personas (URLs y claves del JSON de la web)."""
from __future__ import annotations

import re

from wa.text import strip_accents

_NON_ALNUM = re.compile(r"[^a-z0-9]")


def slug(name: str) -> str:
    return _NON_ALNUM.sub("-", strip_accents(name).lower())
