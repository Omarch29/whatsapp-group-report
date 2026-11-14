"""Compara dos carpetas de JSON de la web (por ejemplo web/data nuevo contra el de una versión anterior).

Uso:
    .venv/bin/python -I scripts/compare_data.py --a web/data --b ../otro/web/data \
        [--ignore k1,k2] [--rename viejo.json=nuevo.json,claveVieja=claveNueva] \
        [--extra-ok archivo.clave,archivo.lista[*].clave] [--value-map viejo=nuevo,clave:viejo=nuevo]

Recorre todo JSON de --b (la referencia, la versión vieja) y lo compara con su par en --a (la versión nueva):
- --ignore: claves que se saltean en cualquier nivel, de los dos lados.
- --rename: renombres de b a a; si el nombre viejo es una ruta relativa de archivo (`viejo.json`) renombra el archivo,
  y si no renombra claves de diccionario en cualquier nivel.
- --extra-ok: rutas que pueden existir solo en a (`archivo.clave.sub`, sin `.json`; los índices de lista se escriben
  `[*]`). Un archivo entero que existe solo en a se acepta con su nombre sin `.json`.
- --value-map: textos de b que se reemplazan antes de comparar, por igualdad exacta; `clave:viejo=nuevo` lo limita a
  los valores que cuelgan de esa clave.
Imprime una línea `archivo:ruta: a=... b=...` por diferencia (valores cortados a 80 caracteres) y sale con 1 si hay
alguna; el resumen va a stderr.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path


class _Mark(str):
    """Texto que se imprime tal cual (no es un valor del JSON)."""


MISSING = _Mark("<missing>")
FILE = _Mark("<file>")
MAX_VALUE = 80
INDEX_RE = re.compile(r"\[\d+\]")


def _csv(text: str | None) -> list[str]:
    return [x.strip() for x in (text or "").split(",") if x.strip()]


def _pairs(text: str | None) -> dict[str, str]:
    out = {}
    for item in _csv(text):
        old, sep, new = item.partition("=")
        if not sep or not old:
            raise SystemExit(f"se esperaba viejo=nuevo: {item!r}")
        out[old] = new
    return out


def _show(value) -> str:
    text = value if isinstance(value, _Mark) else json.dumps(value, ensure_ascii=False)
    return text if len(text) <= MAX_VALUE else text[: MAX_VALUE - 1] + "…"


def _same_scalar(a, b) -> bool:
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-12)
    return type(a) is type(b) and a == b


class Comparer:
    def __init__(self, ignore: set[str], key_renames: dict[str, str], extra_ok: set[str],
                 value_map: dict[str, str], scoped_map: dict[tuple[str, str], str]):
        self.ignore, self.key_renames, self.extra_ok = ignore, key_renames, extra_ok
        self.value_map, self.scoped_map = value_map, scoped_map
        self.diffs: list[str] = []

    def _map_value(self, value, key: str | None):
        if not isinstance(value, str):
            return value
        if key is not None and (key, value) in self.scoped_map:
            return self.scoped_map[(key, value)]
        return self.value_map.get(value, value)

    def _normalize_b(self, value, key: str | None = None):
        """Aplica a la referencia los renombres de claves y el mapa de valores."""
        if isinstance(value, dict):
            return {self.key_renames.get(k, k): self._normalize_b(v, self.key_renames.get(k, k)) for k, v in value.items()}
        if isinstance(value, list):
            return [self._normalize_b(v, key) for v in value]
        return self._map_value(value, key)

    def _allowed_extra(self, stem: str, path: str) -> bool:
        full = f"{stem}.{path}" if path else stem
        return full in self.extra_ok or INDEX_RE.sub("[*]", full) in self.extra_ok

    def _report(self, rel: str, path: str, a, b) -> None:
        where = f"{rel}:{path}" if path else rel
        self.diffs.append(f"{where}: a={_show(a)} b={_show(b)}")

    def compare(self, rel: str, a, b, path: str = "") -> None:
        stem = rel[:-5] if rel.endswith(".json") else rel
        if isinstance(a, dict) and isinstance(b, dict):
            for k in [*b, *(k for k in a if k not in b)]:
                if k in self.ignore:
                    continue
                sub = f"{path}.{k}" if path else k
                if k not in a:
                    self._report(rel, sub, MISSING, b[k])
                elif k not in b:
                    if not self._allowed_extra(stem, sub):
                        self._report(rel, sub, a[k], MISSING)
                else:
                    self.compare(rel, a[k], b[k], sub)
        elif isinstance(a, list) and isinstance(b, list):
            if len(a) != len(b):
                self._report(rel, path, _Mark(f"len {len(a)}"), _Mark(f"len {len(b)}"))
            for i in range(max(len(a), len(b))):
                sub = f"{path}[{i}]"
                if i >= len(a):
                    self._report(rel, sub, MISSING, b[i])
                elif i >= len(b):
                    self._report(rel, sub, a[i], MISSING)
                else:
                    self.compare(rel, a[i], b[i], sub)
        elif isinstance(a, (dict, list)) or isinstance(b, (dict, list)) or not _same_scalar(a, b):
            self._report(rel, path, a, b)


def _json_files(root: Path) -> dict[str, Path]:
    return {p.relative_to(root).as_posix(): p for p in sorted(root.rglob("*.json"))}


def run(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--a", required=True, help="carpeta nueva")
    ap.add_argument("--b", required=True, help="carpeta de referencia (vieja)")
    ap.add_argument("--ignore", default="")
    ap.add_argument("--rename", default="")
    ap.add_argument("--extra-ok", default="")
    ap.add_argument("--value-map", default="")
    args = ap.parse_args(argv)

    a_root, b_root = Path(args.a), Path(args.b)
    for root in (a_root, b_root):
        if not root.is_dir():
            raise SystemExit(f"no existe la carpeta {root}")
    a_files, b_files = _json_files(a_root), _json_files(b_root)
    renames = _pairs(args.rename)
    file_renames = {old: new for old, new in renames.items() if old in b_files}
    key_renames = {old: new for old, new in renames.items() if old not in b_files}
    value_map, scoped_map = {}, {}
    for old, new in _pairs(args.value_map).items():
        key, sep, value = old.partition(":")
        if sep and key and not key.startswith("/"):
            scoped_map[(key, value)] = new
        else:
            value_map[old] = new
    cmp = Comparer(set(_csv(args.ignore)), key_renames, set(_csv(args.extra_ok)), value_map, scoped_map)

    seen = set()
    for rel_b, path_b in b_files.items():
        rel = file_renames.get(rel_b, rel_b)
        seen.add(rel)
        if rel not in a_files:
            cmp._report(rel, "", MISSING, FILE)
            continue
        a = json.loads(a_files[rel].read_text(encoding="utf-8"))
        b = cmp._normalize_b(json.loads(path_b.read_text(encoding="utf-8")))
        cmp.compare(rel, a, b)
    for rel in a_files:
        if rel not in seen and not cmp._allowed_extra(rel[:-5], ""):
            cmp._report(rel, "", FILE, MISSING)

    for line in cmp.diffs:
        print(line)
    n = len(cmp.diffs)
    print(f"{len(b_files)} archivos comparados, {n} diferencia{'' if n == 1 else 's'}", file=sys.stderr)
    return 1 if cmp.diffs else 0


def main() -> None:
    sys.exit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()
