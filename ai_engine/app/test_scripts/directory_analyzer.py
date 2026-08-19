"""Analyze test automation directory structure for context building."""

import re
from pathlib import Path


def analyze_test_directory(test_dir_path: str) -> str:
    """
    Walk the test directory and extract structure, patterns, and dependencies.
    Returns a summary string for LLM context.
    """
    path = Path(test_dir_path)
    if not path.exists() or not path.is_dir():
        return ""

    summary_parts: list[str] = []

    framework_hints: set[str] = set()
    page_classes: list[str] = []
    locator_patterns: set[str] = set()
    dependencies: set[str] = set()
    fixture_files: list[str] = []
    base_classes: list[str] = []

    try:
        for py_file in path.rglob("*.py"):
            try:
                content = py_file.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            if "selenium" in content or "webdriver" in content.lower():
                framework_hints.add("selenium")
            if "playwright" in content:
                framework_hints.add("playwright")
            if "robot" in content.lower() or ".robot" in str(py_file):
                framework_hints.add("robot_framework")
            if "pytest" in content:
                framework_hints.add("pytest")

            if "_page.py" in py_file.name or "page" in py_file.name.lower():
                for match in re.finditer(r"class\s+(\w+)\s*(?:\([^)]*\))?\s*:", content):
                    page_classes.append(match.group(1))

            if "base" in py_file.name.lower() or "base_page" in content.lower():
                for match in re.finditer(r"class\s+(\w+)\s*(?:\([^)]*\))?\s*:", content):
                    base_classes.append(match.group(1))

            if re.search(r"By\.\w+|find_element", content):
                locator_patterns.add("Selenium By (id, xpath, css, etc.)")
            if "locator(" in content or "get_by_" in content:
                locator_patterns.add("Playwright locators")
            if "data-testid" in content or "data_testid" in content:
                locator_patterns.add("data-testid attributes")
            if "css=" in content or "css_selector" in content:
                locator_patterns.add("CSS selectors")
            if "xpath=" in content or "xpath" in content.lower():
                locator_patterns.add("XPath")
            if "id=" in content or "By.ID" in content:
                locator_patterns.add("ID selectors")

            if "conftest" in py_file.name:
                fixture_files.append(py_file.name)

        for dep_file in ["requirements.txt", "pyproject.toml"]:
            dep_path = path / dep_file
            if not dep_path.exists():
                for parent in path.parents:
                    candidate = parent / dep_file
                    if candidate.exists():
                        dep_path = candidate
                        break
                else:
                    continue

            try:
                dep_content = dep_path.read_text(encoding="utf-8", errors="ignore")
                if dep_file == "requirements.txt":
                    for line in dep_content.splitlines():
                        line = line.strip()
                        if line and not line.startswith("#"):
                            pkg = re.match(r"^([a-zA-Z0-9_-]+)", line)
                            if pkg:
                                dependencies.add(pkg.group(1).lower())
                elif dep_file == "pyproject.toml":
                    if "selenium" in dep_content:
                        dependencies.add("selenium")
                    if "playwright" in dep_content:
                        dependencies.add("playwright")
                    if "pytest" in dep_content:
                        dependencies.add("pytest")
            except Exception:
                pass

    except Exception:
        return ""

    if framework_hints:
        summary_parts.append(f"Framework hints: {', '.join(sorted(framework_hints))}.")
    if page_classes:
        unique_pages = list(dict.fromkeys(page_classes))[:10]
        summary_parts.append(f"Page object classes: {', '.join(unique_pages)}.")
    if base_classes:
        unique_bases = list(dict.fromkeys(base_classes))[:5]
        summary_parts.append(f"Base classes: {', '.join(unique_bases)}.")
    if locator_patterns:
        summary_parts.append(f"Locator strategy: {', '.join(locator_patterns)}.")
    if dependencies:
        relevant = {
            d
            for d in dependencies
            if d in {"selenium", "playwright", "pytest", "robotframework"}
        }
        if relevant:
            summary_parts.append(f"Dependencies: {', '.join(sorted(relevant))}.")
    if fixture_files:
        summary_parts.append(f"Fixture files: {', '.join(fixture_files)}.")

    if not summary_parts:
        return "Test directory analyzed; no specific patterns detected. Use standard patterns for the requested framework."
    return " ".join(summary_parts)
