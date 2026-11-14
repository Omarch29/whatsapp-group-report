"""Guarda anti-fugas: el repo público no lleva nombres de un grupo real ni exports de chats.

La lista de palabras prohibidas NO vive en el repo (una lista, aunque sea hasheada, ya es una pista): cada
mantenedor la guarda fuera y la pasa con WGR_PRIVATE_WORDS=/ruta/a/palabras.txt (una palabra por línea, `#` para
comentarios, un ` whole` al final marca palabra entera). Sin la variable, el chequeo de nombres se saltea; los
chequeos genéricos corren siempre.
"""
import os
import re
import subprocess
import unicodedata
from pathlib import Path

import pytest
from conftest import ROOT

from wa.names import load_people

LETTERS_RE = re.compile(r"[a-z]+")
# lo único que puede estar trackeado bajo las carpetas de datos
DATA_DIRS = ("chats/", "data/", "web/data/")
DATA_ALLOWED = ("web/data/example/",)
ALLOWED_CHAT = "tests/fixtures/mini_chat.txt"
# el titular del copyright es el autor que publica el repo con su nombre: no es un dato del chat
AUTHORSHIP = {"LICENSE"}


def _plain(text: str) -> str:
    """Minúscula y sin tildes ('Muñóz' -> 'munoz')."""
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


def _runs(text: str) -> set[str]:
    """Tiras de letras ascii en minúscula."""
    return set(LETTERS_RE.findall(_plain(text)))


def parse_words(text: str) -> tuple[set[str], set[str]]:
    """(subcadenas, palabras enteras) de un archivo de palabras: una por línea, `#` comenta, ` whole` al final."""
    subs, wholes = set(), set()
    for line in text.splitlines():
        parts = line.split("#", 1)[0].split()
        if not parts:
            continue
        whole = len(parts) > 1 and parts[-1] == "whole"
        word = "".join(LETTERS_RE.findall(_plain(" ".join(parts[:-1] if whole else parts))))
        if word:
            (wholes if whole else subs).add(word)
    return subs, wholes


def private_hits(text: str, subs: set[str], wholes: set[str]) -> bool:
    """¿Alguna tira de letras del texto contiene una subcadena prohibida o es una palabra entera prohibida?"""
    return any(run in wholes or any(w in run for w in subs) for run in _runs(text))


def tracked_files() -> list[Path]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    return [ROOT / rel for rel in out.decode().split("\0") if rel]


def _scannable() -> list[tuple[str, Path]]:
    return [(p.relative_to(ROOT).as_posix(), p) for p in tracked_files()
            if p.is_file() and p.relative_to(ROOT).as_posix() not in AUTHORSHIP]


def test_parse_words_and_matcher():
    subs, wholes = parse_words("# comentario\nBrujó\n\nana whole  # solo entera\n")
    assert (subs, wholes) == ({"brujo"}, {"ana"})
    assert private_hits("el Brujó volvió", subs, wholes)
    assert private_hits("departerBrujoMonths", subs, wholes)
    assert private_hits("hola Ana!", subs, wholes)
    assert not private_hits("banana split", subs, wholes)  # 'ana' solo como palabra entera
    assert not private_hits("brujula", subs, wholes)


def test_no_private_names_in_repo():
    words_file = os.environ.get("WGR_PRIVATE_WORDS")
    if not words_file:
        pytest.skip("WGR_PRIVATE_WORDS no está definida: sin lista de palabras prohibidas no se puede chequear nombres "
                    "(mantenedores: WGR_PRIVATE_WORDS=/ruta/palabras.txt uv run pytest -q)")
    subs, wholes = parse_words(Path(words_file).read_text(encoding="utf-8"))
    assert subs or wholes, f"{words_file} no tiene palabras"
    hits = [rel for rel, p in _scannable()
            if private_hits(rel, subs, wholes) or private_hits(p.read_text(errors="ignore"), subs, wholes)]
    assert hits == []


def test_no_chat_exports_tracked():
    rels = [p.relative_to(ROOT).as_posix() for p in tracked_files()]
    assert [r for r in rels if Path(r).name.startswith("_chat") and r != ALLOWED_CHAT] == []


def test_no_real_data_tracked():
    rels = [p.relative_to(ROOT).as_posix() for p in tracked_files()]
    bad = [r for r in rels if r.startswith(DATA_DIRS) and not r.startswith(DATA_ALLOWED)
           and Path(r).name != ".gitkeep"]
    assert bad == []


def surname_hits(people_json: Path, texts: list[tuple[str, str]]) -> list[str]:
    """Los nombres de `texts` ((nombre, texto)) cuyo nombre o texto lleva, como palabra entera y sin distinguir
    mayúsculas ni tildes, un apellido de contacto de `people_json`."""
    wholes = {_plain(s) for s in load_people(people_json).contact_surnames()}
    return sorted({name for name, text in texts if private_hits(name, set(), wholes) or private_hits(text, set(), wholes)})


def test_surname_hits_are_whole_words(tmp_path):
    people_json = tmp_path / "people.json"
    people_json.write_text('{"people": {"Ana Rivas": "Ana", "Tomi Suárez": "Tomi"}}', encoding="utf-8")
    texts = [("a.txt", "le escribió a Ana RIVAS."), ("b.txt", "lo que derivas de eso"), ("suarez.md", ""),
             ("c.txt", "nada"), ("d.txt", "Suárez-Gómez")]
    assert surname_hits(people_json, texts) == ["a.txt", "d.txt", "suarez.md"]


def test_no_local_contact_surnames_in_repo():
    people_json = ROOT / "content" / "people.json"
    if not people_json.is_file():
        pytest.skip("no hay content/people.json local: no hay apellidos de contacto que buscar")
    assert surname_hits(people_json, [(rel, p.read_text(errors="ignore")) for rel, p in _scannable()]) == []


EXPORT_NAMES = ("_chat.txt", "WhatsApp Chat with The Park Crew.txt", "Chat de WhatsApp con Los del Parque.txt",
                "export.zip")


@pytest.mark.parametrize("where", ["", "web/"])
@pytest.mark.parametrize("name", EXPORT_NAMES)
def test_exports_dropped_anywhere_are_ignored(where, name):
    out = subprocess.run(["git", "check-ignore", "--no-index", f"{where}{name}"], cwd=ROOT, capture_output=True,
                         text=True)
    assert out.returncode == 0, f"{where}{name} is not ignored"


def test_no_tracked_file_is_ignored():
    out = subprocess.run(["git", "ls-files", "-ci", "--exclude-standard"], cwd=ROOT, capture_output=True, text=True,
                         check=True)
    assert out.stdout == ""
