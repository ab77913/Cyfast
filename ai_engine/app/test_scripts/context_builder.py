"""Build LLM context from request inputs."""

from pathlib import Path
from typing import Optional

from app.test_scripts.directory_analyzer import analyze_test_directory
from app.test_scripts.schemas import GenerateRequest


def get_directory_summary(test_dir_path: Optional[str]) -> str:
    """Analyze test directory and return summary string."""
    if not test_dir_path or not test_dir_path.strip():
        return ""
    return analyze_test_directory(test_dir_path.strip())


def get_example_script(
    example_script: Optional[str] = None,
    example_script_path: Optional[str] = None,
) -> str:
    """Get example script from inline string or file path."""
    if example_script and example_script.strip():
        return example_script.strip()

    if example_script_path and example_script_path.strip():
        path = Path(example_script_path.strip())
        if path.exists() and path.is_file():
            try:
                return path.read_text(encoding="utf-8", errors="ignore").strip()
            except Exception:
                pass
    return ""


def build_context(request: GenerateRequest) -> dict:
    """Aggregate all request inputs into a context dict for generation."""
    directory_summary = get_directory_summary(request.test_dir_path)
    example_script = get_example_script(
        request.example_script,
        request.example_script_path,
    )
    return {
        "project_description": request.project_description,
        "requirements": request.requirements,
        "test_scenario": request.test_scenario,
        "framework": request.framework,
        "directory_summary": directory_summary,
        "example_script": example_script,
    }
