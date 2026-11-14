"""Naming rule: this project calls the chat a "group". The word checked below is not a name the project uses: it
only appears as fictional content (chat lines of the synthetic cast, test fixtures) and in the tests that enforce
this rule: the files of ALLOWED. No tracked file is named with it."""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ALLOWED = {"scripts/synth/vocab_es.py", "scripts/synth/vocab_en.py", "tests/fixtures/mini_chat.txt",
           "web/src/test/fixtures.ts", "web/src/components/sections/census/Timeline.test.tsx",
           "web/src/test/copy.test.ts", "tests/test_naming.py"}


def test_the_word_only_appears_as_fiction():
    out = subprocess.run(["git", "grep", "-il", "club"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    assert set(out) <= ALLOWED, sorted(set(out) - ALLOWED)


def test_no_tracked_file_is_named_with_the_word():
    names = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.lower()
    assert "club" not in names
