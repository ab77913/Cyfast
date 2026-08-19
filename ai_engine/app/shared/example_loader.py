"""Load few-shot YAML example libraries from app/prompt_examples/.

This loader is intended for future prompt assembly and LangGraph agents that
select document-type or task-specific examples. It is not wired into runtime
generation services yet.
"""

from pathlib import Path
from typing import Any

import yaml

_EXAMPLES_ROOT = Path(__file__).resolve().parent.parent / "prompt_examples"


def load_examples(relative_path: str) -> dict[str, Any]:
    """Load and validate a YAML example file relative to app/prompt_examples/.

    Example paths:
        requirements/brd_requirement_examples.yaml
        test_scenarios/functional_scenario_examples.yaml
        test_cases/manual_test_case_examples.yaml
    """
    path = _EXAMPLES_ROOT / relative_path
    if not path.is_file():
        raise FileNotFoundError(f"Example file not found: {path}")

    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise OSError(f"Unable to read example file: {path}") from exc

    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError as exc:
        raise ValueError(f"Invalid YAML in example file: {path}") from exc

    if not isinstance(data, dict):
        raise ValueError(
            f"Example file must contain a YAML mapping at the root: {path}"
        )

    if "examples" not in data:
        raise ValueError(
            f"Example file is missing required 'examples' key: {path}"
        )

    examples = data["examples"]
    if not isinstance(examples, list):
        raise ValueError(
            f"Example file 'examples' must be a list: {path}"
        )

    if not examples:
        raise ValueError(
            f"Example file 'examples' list must not be empty: {path}"
        )

    return data
