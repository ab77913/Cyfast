from __future__ import annotations

import dataclasses
import re
from typing import Iterable


REPAIRABLE_FAILURES = {
    "LOCATOR_FAILURE",
    "TIMING_FAILURE",
    "SCRIPT_DEFECT",
    "KEYWORD_IMPORT_DEFECT",
}
ACTION_KEYWORDS = (
    "click element",
    "click button",
    "input text",
    "press keys",
    "select from list",
    "set value",
    "invoke element",
    "open application",
    "launch application",
    "tap",
    "send frame",
    "write uart",
    "start measurement",
)
ASSERTION_KEYWORDS = (
    "element should",
    "page should",
    "should be equal",
    "should contain",
    "should be true",
    "wait until element is visible",
    "response should",
    "verify signal",
    "assert",
)


class RepairPolicyError(ValueError):
    def __init__(self, errors: list[str]) -> None:
        super().__init__(" | ".join(errors))
        self.errors = errors


@dataclasses.dataclass(frozen=True, slots=True)
class RepairValidation:
    valid: bool
    errors: tuple[str, ...]
    before_actions: int
    after_actions: int
    before_assertions: int
    after_assertions: int

    def to_dict(self) -> dict[str, object]:
        return dataclasses.asdict(self)


def validate_repair(
    *,
    failure_classification: str,
    attempt_number: int,
    before_script: str,
    after_script: str,
    proposed_changes: Iterable[str] = (),
    raise_on_error: bool = False,
) -> RepairValidation:
    errors: list[str] = []
    classification = str(failure_classification or "").upper()
    if classification not in REPAIRABLE_FAILURES:
        errors.append(f"failure {classification or '<empty>'} is not eligible for automatic script repair")
    if not isinstance(attempt_number, int) or attempt_number < 1 or attempt_number > 3:
        errors.append("repair attempt must be between 1 and 3")
    if not before_script.strip() or not after_script.strip():
        errors.append("before_script and after_script are required")

    before_actions = count_meaningful(before_script, ACTION_KEYWORDS)
    after_actions = count_meaningful(after_script, ACTION_KEYWORDS)
    before_assertions = count_meaningful(before_script, ASSERTION_KEYWORDS)
    after_assertions = count_meaningful(after_script, ASSERTION_KEYWORDS)
    if after_actions < before_actions:
        errors.append("repair may not remove business actions")
    if after_assertions < before_assertions:
        errors.append("repair may not remove or weaken assertions")
    if before_actions > 0 and after_actions == 0:
        errors.append("repair must retain executable actions")
    if before_assertions > 0 and after_assertions == 0:
        errors.append("repair must retain executable assertions")

    combined_changes = "\n".join(str(item) for item in proposed_changes)
    if re.search(r"(?:^|\n)\s*(?:Log|Log To Console)\s{2,}.*(?:pass|success)", after_script, re.I):
        errors.append("repair may not replace execution with a fabricated PASS log")
    if re.search(r"\b(?:powershell|cmd(?:\.exe)?|bash|sh)\b", combined_changes, re.I):
        errors.append("repair may not introduce arbitrary shell execution")
    if re.search(r"^\s*(?:Run|Run Process|Start Process)\s{2,}(?:powershell|cmd(?:\.exe)?|bash|sh)\b", after_script, re.I | re.M):
        errors.append("repair may not introduce arbitrary shell execution")
    if re.search(r"^\s*\$\{(?:PASSWORD|TOKEN|SECRET|API_KEY)\}\s{2,}(?!%\{|\$\{)[^#\s].+$", after_script, re.I | re.M):
        errors.append("repair may not introduce plaintext credentials")
    if re.search(r"^\s*(?:#\s*)?(?:TODO|FIXME)\b", after_script, re.I | re.M) or re.search(
        r"<locator>|replace_me|your_locator|placeholder_locator", after_script, re.I
    ):
        errors.append("repair may not contain unresolved placeholders")
    if re.search(r"\bdesiredCapabilities\b", after_script, re.I):
        errors.append("repair may not introduce legacy Appium capabilities")
    if re.search(r"(?:^|[\s\"'])(?:/home/|/tmp/|/var/tmp/)", after_script, re.I) or re.search(
        r"(?:^|[\s\"'])[A-Za-z]:\\", after_script
    ):
        errors.append("repair may not introduce unresolved host-specific paths")

    validation = RepairValidation(
        valid=not errors,
        errors=tuple(errors),
        before_actions=before_actions,
        after_actions=after_actions,
        before_assertions=before_assertions,
        after_assertions=after_assertions,
    )
    if errors and raise_on_error:
        raise RepairPolicyError(errors)
    return validation


def count_meaningful(script: str, keywords: Iterable[str]) -> int:
    count = 0
    for line in str(script).splitlines():
        normalized = line.strip().lower()
        if normalized and not normalized.startswith("#") and any(keyword in normalized for keyword in keywords):
            count += 1
    return count
