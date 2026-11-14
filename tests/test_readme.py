"""The tutorial README: two halves with the same shape, images and scripts that exist, the commands people copy."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = (ROOT / "README.md").read_text(encoding="utf-8")
EN, ES = README.split("## Español", 1)[0].split("## English", 1)[1], README.split("## Español", 1)[1]


def _blocks(text):
    return re.findall(r"```bash\n(.*?)```", text, flags=re.S)


def _strip(block):
    """Drops trailing `# comments`, which may be translated."""
    return [re.sub(r"\s+#.*$", "", line) for line in block.splitlines()]


def test_both_halves_have_the_same_shape():
    assert len(re.findall(r"^### ", EN, flags=re.M)) == len(re.findall(r"^### ", ES, flags=re.M)) == 8
    assert _blocks(EN)
    assert [_strip(b) for b in _blocks(EN)] == [_strip(b) for b in _blocks(ES)]


def test_every_image_and_script_exists():
    images = re.findall(r"\]\((docs/screenshots/[^)]+)\)", README) + re.findall(r'src="(docs/screenshots/[^"]+)"', README)
    assert len(images) == 8, images  # four captures per half
    for img in images:
        assert (ROOT / img).is_file(), img
    assert "docs/screenshots/en/" in EN and "docs/screenshots/es/" in ES
    assert "docs/screenshots/es/" not in EN and "docs/screenshots/en/" not in ES
    for script in set(re.findall(r"scripts/\w+\.py", README)):
        assert (ROOT / script).is_file(), script


def test_the_commands_people_copy():
    assert "pnpm run deploy" in README and not re.search(r"pnpm deploy\b", README)
    assert "--no-sensitive" in README and "armame el informe de mi grupo" in ES
    assert (ROOT / "docs" / "development.md").is_file() and "docs/development.md" in README
