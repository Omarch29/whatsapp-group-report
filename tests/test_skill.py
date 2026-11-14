"""The agent skill: its frontmatter, its size, the commands it quotes, its fixed rules and the agent files."""
import re
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SKILL = ROOT / ".agents" / "skills" / "whatsapp-group-report"
TEXT = (SKILL / "SKILL.md").read_text(encoding="utf-8")
ALL = "\n".join(p.read_text(encoding="utf-8") for p in SKILL.rglob("*.md"))


def test_frontmatter():
    meta = dict(line.split(":", 1) for line in TEXT.split("---")[1].strip().splitlines() if ":" in line)
    assert meta["name"].strip() == "whatsapp-group-report" == SKILL.name
    d = meta["description"].strip()
    assert 0 < len(d) <= 1024 and "WhatsApp" in d and "informe" in d


def test_skill_is_short_and_its_references_exist():
    assert len(TEXT.splitlines()) <= 200
    named = set(re.findall(r"references/([\w-]+\.md)", TEXT))
    assert named == {p.name for p in (SKILL / "references").glob("*.md")} == {"content.md", "writing.md", "changes.md", "deploy.md"}


def test_every_command_exists():
    for line in re.findall(r"^.*scripts/\w+\.py.*$", ALL, flags=re.M):
        script = ROOT / re.search(r"scripts/\w+\.py", line).group()
        assert script.is_file(), line
        for flag in re.findall(r"(?<!\w)--[a-z][\w-]*", line.split(script.name, 1)[1]):
            assert f'"{flag}"' in script.read_text(encoding="utf-8"), (flag, line)


def test_fixed_rules_are_stated():
    for needle in ("NEXT_PUBLIC_GATE_WORD", "web/.env.local", "surname", "overwrit", "check_report.py", "draft_content.py"):
        assert needle in TEXT


@pytest.mark.skipif(sys.platform == "win32", reason="symlinks")
def test_claude_reads_the_same_folder():
    link = ROOT / ".claude" / "skills" / "whatsapp-group-report"
    assert link.is_symlink() and link.resolve() == SKILL.resolve()
    tracked = subprocess.run(["git", "ls-files", ".cursor/skills"], cwd=ROOT, capture_output=True, text=True, check=True)
    assert tracked.stdout == ""  # Cursor reads .agents/skills natively; a local .cursor/ of the editor is fine


def test_agent_files():                                   # Review Focus 5
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    assert ".agents/skills/whatsapp-group-report/SKILL.md" in agents
    assert (ROOT / "CLAUDE.md").read_text(encoding="utf-8").strip() == "@AGENTS.md"
