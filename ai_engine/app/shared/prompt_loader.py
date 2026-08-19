"""Load external prompt text files from app/prompts/."""

from pathlib import Path

_PROMPTS_ROOT = Path(__file__).resolve().parent.parent / "prompts"


def load_prompt(relative_path: str) -> str:
    """Read a prompt file relative to app/prompts/ (e.g. system/foo.txt)."""
    path = _PROMPTS_ROOT / relative_path
    if not path.is_file():
        raise FileNotFoundError(f"Prompt file not found: {path}")
    return path.read_text(encoding="utf-8").strip()
