"""The CI workflow runs the tests, the linter and the four synthetic builds, and deploys nothing."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CI = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")


def test_ci_builds_both_languages_and_modes():
    for needle in ("lang: [es, en]", "mode: [full, single]",
                   "demo_deploy.py --lang ${{ matrix.lang }} --mode ${{ matrix.mode }} --no-deploy",
                   "uv run pytest -q", "pnpm lint", "pnpm test", "--frozen-lockfile", "uv sync --locked"):
        assert needle in CI
    assert CI.count("uv sync") == CI.count("uv sync --locked") == 2  # both jobs install from uv.lock as it is


def test_ci_deploys_nothing_and_reads_no_secret():
    assert "secrets." not in CI and "vercel" not in CI.lower() and "contents: read" in CI
