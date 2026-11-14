"""Guard: every pandas/numpy value sort in the pipeline is stable.

numpy's default sort is not stable and breaks ties differently on x86 (SIMD) and ARM, so a tie that feeds a published
value (a ranking cut with .head(n), .iloc[0], the order of same-timestamp messages) differs between platforms.
`kind="stable"` keeps ties in input order, which is the same everywhere.
"""

import re
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
CALL = re.compile(r"\b(sort_values|argsort)\(")


def _call_text(src: str, open_idx: int) -> str:
    """Text from the opening parenthesis to its matching closing one (strings and comments skipped)."""
    depth, i, quote = 0, open_idx, None
    while i < len(src):
        c = src[i]
        if quote:
            if c == "\\":
                i += 1
            elif src.startswith(quote, i):
                i += len(quote) - 1
                quote = None
        elif c == "#":
            i = src.find("\n", i) - 1 if "\n" in src[i:] else len(src)
        elif c in "\"'":
            quote = c * 3 if src.startswith(c * 3, i) else c
            i += len(quote) - 1
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return src[open_idx : i + 1]
        i += 1
    return src[open_idx:]


def find_unstable(src: str) -> list[int]:
    bad = []
    for m in CALL.finditer(src):
        line_start = src.rfind("\n", 0, m.start()) + 1
        if "#" in src[line_start : m.start()]:  # the call sits inside a comment
            continue
        if not re.search(r"""kind\s*=\s*(["'])stable\1""", _call_text(src, m.end() - 1)):
            bad.append(src.count("\n", 0, m.start()) + 1)
    return bad


def test_every_sort_is_stable():
    problems = []
    for path in sorted(SCRIPTS.rglob("*.py")):
        for line in find_unstable(path.read_text(encoding="utf-8")):
            problems.append(f'{path.relative_to(SCRIPTS.parent)}:{line}: add kind="stable"')
    assert not problems, "unstable sorts break ties differently per platform:\n" + "\n".join(problems)


def test_guard_sees_multiline_and_nested_calls():
    src = 'a.sort_values(\n    ["x", "y"],\n    ascending=False,\n    kind="stable",\n)\nb.sort_values(f(1), ascending=False)\nnp.argsort(x, kind="stable")\nnp.argsort(x)\n'
    assert find_unstable(src) == [6, 8]
