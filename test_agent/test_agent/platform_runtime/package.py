from __future__ import annotations

import base64
import binascii
import os
import pathlib
import re
import shutil
import tempfile
from dataclasses import dataclass
from typing import Iterable

from .contracts import ExecutionPackage, sha256_bytes


HARD_PACKAGE_LIMIT_BYTES = 225_280
MAX_FILES = 128
MAX_IMPORT_DEPTH = 16
ALLOWED_EXTENSIONS = {".robot", ".resource", ".py", ".json", ".yaml", ".yml", ".txt", ".csv", ".xml"}
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
_IMPORT_PATTERN = re.compile(r"^\s*(Resource|Variables|Library)\s{2,}([^#\r\n]+?)\s*$", re.I | re.M)


class PackageValidationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True, slots=True)
class ValidatedPackage:
    suite_path: str
    files: dict[str, bytes]
    package_bytes: int
    meaningful_actions: int
    meaningful_assertions: int

    def materialize(self, parent: pathlib.Path, execution_id: str) -> pathlib.Path:
        root = safe_child(parent, execution_id)
        if root.exists():
            shutil.rmtree(root)
        root.mkdir(parents=True, exist_ok=False)
        for relative, content in self.files.items():
            destination = safe_child(root, relative)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
        return root


def validate_package(package: ExecutionPackage, *, maximum_bytes: int = HARD_PACKAGE_LIMIT_BYTES) -> ValidatedPackage:
    if not package.files:
        raise PackageValidationError("PACKAGE_EMPTY", "at least one package file is required")
    if len(package.files) > MAX_FILES:
        raise PackageValidationError("PACKAGE_FILE_LIMIT_EXCEEDED", f"package contains more than {MAX_FILES} files")
    configured_limit = max(1, min(int(maximum_bytes), HARD_PACKAGE_LIMIT_BYTES))
    suite_path = normalize_relative_path(package.suite_path)
    if pathlib.PurePosixPath(suite_path).suffix.lower() != ".robot":
        raise PackageValidationError("ROOT_SUITE_MUST_BE_ROBOT", "suite_path must reference a .robot file")

    decoded: dict[str, bytes] = {}
    package_bytes = 0
    for item in package.files:
        relative = normalize_relative_path(item.path)
        extension = pathlib.PurePosixPath(relative).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise PackageValidationError("UNSUPPORTED_PACKAGE_FILE", f"unsupported package file type: {relative}")
        key = relative.casefold()
        if key in {value.casefold() for value in decoded}:
            raise PackageValidationError("DUPLICATE_PACKAGE_PATH", f"duplicate package path: {relative}")
        try:
            content = base64.b64decode(item.content_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise PackageValidationError("PACKAGE_BASE64_INVALID", f"file is not valid base64: {relative}") from exc
        if item.size is not None and int(item.size) != len(content):
            raise PackageValidationError("PACKAGE_SIZE_MISMATCH", f"size mismatch: {relative}")
        actual_hash = sha256_bytes(content)
        if item.sha256 and actual_hash.lower() != item.sha256.lower():
            raise PackageValidationError("PACKAGE_HASH_MISMATCH", f"checksum mismatch: {relative}")
        package_bytes += len(content)
        if package_bytes > configured_limit:
            raise PackageValidationError(
                "PACKAGE_SIZE_LIMIT_EXCEEDED",
                f"package exceeds the {configured_limit}-byte limit",
            )
        decoded[relative] = content

    if suite_path.casefold() not in {value.casefold() for value in decoded}:
        raise PackageValidationError("ROOT_SUITE_MISSING", f"suite_path is missing: {suite_path}")

    normalized_files = _case_preserving_files(decoded)
    visited: set[str] = set()
    _validate_imports(suite_path, normalized_files, visited, 0)

    root_text = _decode_text(suite_path, normalized_files[suite_path.casefold()])
    actions = _count_meaningful(root_text, ACTION_KEYWORDS)
    assertions = _count_meaningful(root_text, ASSERTION_KEYWORDS)
    if actions < 1:
        raise PackageValidationError("NO_MEANINGFUL_ACTION", "package has no meaningful action")
    if assertions < 1:
        raise PackageValidationError("NO_MEANINGFUL_ASSERTION", "package has no meaningful assertion")

    return ValidatedPackage(
        suite_path=suite_path,
        files={original: normalized_files[original.casefold()] for original in decoded},
        package_bytes=package_bytes,
        meaningful_actions=actions,
        meaningful_assertions=assertions,
    )


def normalize_relative_path(value: str) -> str:
    text = str(value or "").replace("\\", "/").strip()
    if not text:
        raise PackageValidationError("PACKAGE_PATH_REQUIRED", "package path is required")
    if text.startswith(("/", "//")) or re.match(r"^[A-Za-z]:", text):
        raise PackageValidationError("ABSOLUTE_PATH_REJECTED", f"absolute package path is not allowed: {value}")
    parts = text.split("/")
    if any(not part or part in {".", ".."} for part in parts):
        raise PackageValidationError("PATH_TRAVERSAL_REJECTED", f"unsafe package path: {value}")
    normalized = pathlib.PurePosixPath(*parts).as_posix()
    if normalized != text:
        raise PackageValidationError("PATH_NORMALIZATION_REJECTED", f"unsafe package path: {value}")
    return normalized


def safe_child(root: pathlib.Path, relative: str) -> pathlib.Path:
    normalized = normalize_relative_path(relative)
    root_resolved = root.resolve()
    candidate = (root_resolved / pathlib.Path(*normalized.split("/"))).resolve()
    try:
        candidate.relative_to(root_resolved)
    except ValueError as exc:
        raise PackageValidationError("WORKSPACE_ESCAPE_REJECTED", f"path escapes workspace: {relative}") from exc
    return candidate


def create_workspace_root(configured: str | None = None) -> pathlib.Path:
    value = configured or os.environ.get("CYFAST_AGENT_WORKSPACE")
    if value:
        root = pathlib.Path(value).expanduser().resolve()
        if not root.is_absolute():
            raise PackageValidationError("WORKSPACE_INVALID", "CYFAST_AGENT_WORKSPACE must be absolute")
        root.mkdir(parents=True, exist_ok=True)
        return root
    return pathlib.Path(tempfile.gettempdir(), "cyfast-agent-jobs").resolve()


def _case_preserving_files(files: dict[str, bytes]) -> dict[str, bytes]:
    output: dict[str, bytes] = {}
    for path, content in files.items():
        key = path.casefold()
        if key in output:
            raise PackageValidationError("DUPLICATE_PACKAGE_PATH", f"duplicate package path: {path}")
        output[key] = content
    return output


def _validate_imports(
    file_path: str,
    files: dict[str, bytes],
    visited: set[str],
    depth: int,
) -> None:
    if depth > MAX_IMPORT_DEPTH:
        raise PackageValidationError("IMPORT_DEPTH_EXCEEDED", f"import depth exceeds {MAX_IMPORT_DEPTH}: {file_path}")
    key = file_path.casefold()
    if key in visited:
        return
    visited.add(key)
    content = files.get(key)
    if content is None:
        raise PackageValidationError("PACKAGE_FILE_MISSING", f"package file is missing: {file_path}")
    suffix = pathlib.PurePosixPath(file_path).suffix.lower()
    text = _decode_text(file_path, content)
    _validate_text(file_path, text)
    if suffix not in {".robot", ".resource"}:
        return
    for import_type, raw_value in _IMPORT_PATTERN.findall(text):
        candidate = re.split(r"\s{2,}", raw_value.strip(), maxsplit=1)[0].strip("\"'")
        if "${" in candidate or "%{" in candidate:
            raise PackageValidationError(
                "DYNAMIC_IMPORT_REJECTED",
                f"dynamic {import_type} path is not permitted in {file_path}: {candidate}",
            )
        if import_type.lower() == "library" and not re.search(r"\.(?:py|robot|resource)$", candidate, re.I):
            continue
        candidate = normalize_relative_path(candidate)
        parent = pathlib.PurePosixPath(file_path).parent
        combined = normalize_relative_path((parent / candidate).as_posix() if str(parent) != "." else candidate)
        if combined.casefold() not in files:
            raise PackageValidationError(
                "UNRESOLVED_PACKAGE_IMPORT",
                f"missing {import_type} referenced by {file_path}: {combined}",
            )
        _validate_imports(combined, files, visited, depth + 1)


def _decode_text(path: str, content: bytes) -> str:
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise PackageValidationError("PACKAGE_UTF8_REQUIRED", f"package file is not valid UTF-8: {path}") from exc


def _validate_text(path: str, text: str) -> None:
    if "\x00" in text:
        raise PackageValidationError("BINARY_PACKAGE_FILE_REJECTED", f"binary content is not allowed: {path}")
    if re.search(r"(?:^|[\s\"'])(?:/home/|/tmp/|/var/tmp/)", text, re.I):
        raise PackageValidationError("LINUX_HOST_PATH_REJECTED", f"unresolved Linux host path found in {path}")
    if re.search(r"(?:^|[\s\"'])[A-Za-z]:\\", text) or re.search(r"\\\\[^\\\s]+\\", text):
        raise PackageValidationError("WINDOWS_HOST_PATH_REJECTED", f"unresolved Windows host path found in {path}")
    if re.search(r"\bdesiredCapabilities\b", text, re.I):
        raise PackageValidationError("LEGACY_APPIUM_CAPABILITY_REJECTED", f"legacy desiredCapabilities found in {path}")
    if re.search(r"^\s*(?:#\s*)?(?:TODO|FIXME)\b", text, re.I | re.M) or re.search(
        r"<locator>|replace_me|your_locator|placeholder_locator", text, re.I
    ):
        raise PackageValidationError("PLACEHOLDER_AUTOMATION_REJECTED", f"TODO or placeholder automation remains in {path}")
    if re.search(r"^\s*\$\{(?:PASSWORD|TOKEN|SECRET|API_KEY)\}\s{2,}(?!%\{|\$\{)[^#\s].+$", text, re.I | re.M):
        raise PackageValidationError("PLAINTEXT_CREDENTIAL_REJECTED", f"possible plaintext credential found in {path}")
    if re.search(r"^\s*(?:Run|Run Process|Start Process)\s{2,}(?:powershell|cmd(?:\.exe)?|bash|sh)\b", text, re.I | re.M):
        raise PackageValidationError("ARBITRARY_SHELL_REJECTED", f"arbitrary shell execution found in {path}")


def _count_meaningful(text: str, keywords: Iterable[str]) -> int:
    count = 0
    for line in text.splitlines():
        normalized = line.strip().lower()
        if normalized and not normalized.startswith("#") and any(keyword in normalized for keyword in keywords):
            count += 1
    return count
