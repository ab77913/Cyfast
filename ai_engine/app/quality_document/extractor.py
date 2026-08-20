from __future__ import annotations

import base64
import binascii
import csv
import hashlib
import html
import io
import json
import pathlib
import re
import zipfile
from dataclasses import dataclass
from typing import Any, Iterable
from xml.etree import ElementTree as ET


MAX_DOCUMENT_BYTES = 25 * 1024 * 1024
MAX_EXTRACTED_CHARACTERS = 2_000_000


class DocumentExtractionError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True, slots=True)
class ExtractedSection:
    section_id: str
    title: str
    text: str
    source_anchor: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "section_id": self.section_id,
            "title": self.title,
            "text": self.text,
            "source_anchor": self.source_anchor,
        }


@dataclass(frozen=True, slots=True)
class ExtractedDocument:
    filename: str
    content_type: str
    sha256: str
    size_bytes: int
    text: str
    sections: tuple[ExtractedSection, ...]
    warnings: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "filename": self.filename,
            "content_type": self.content_type,
            "sha256": self.sha256,
            "size_bytes": self.size_bytes,
            "text": self.text,
            "sections": [section.to_dict() for section in self.sections],
            "warnings": list(self.warnings),
        }


def extract_document(*, filename: str, content_type: str, content_base64: str) -> ExtractedDocument:
    safe_name = safe_filename(filename)
    try:
        raw = base64.b64decode(content_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise DocumentExtractionError("DOCUMENT_BASE64_INVALID", "Uploaded document content is not valid base64") from exc
    if not raw:
        raise DocumentExtractionError("DOCUMENT_EMPTY", "Uploaded document is empty")
    if len(raw) > MAX_DOCUMENT_BYTES:
        raise DocumentExtractionError(
            "DOCUMENT_SIZE_LIMIT_EXCEEDED",
            f"Uploaded document exceeds the {MAX_DOCUMENT_BYTES}-byte extraction limit",
        )

    suffix = pathlib.PurePath(safe_name).suffix.lower()
    normalized_type = str(content_type or "application/octet-stream").lower().split(";", 1)[0].strip()
    warnings: list[str] = []
    if suffix == ".pdf" or normalized_type == "application/pdf":
        sections = _extract_pdf(raw, warnings)
    elif suffix == ".docx" or normalized_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        sections = _extract_docx(raw)
    elif suffix == ".pptx" or normalized_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        sections = _extract_pptx(raw)
    elif suffix == ".xlsx" or normalized_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        sections = _extract_xlsx(raw)
    elif suffix in {".json", ".jsonl"} or normalized_type in {"application/json", "application/x-ndjson"}:
        sections = _extract_json(raw)
    elif suffix == ".csv" or normalized_type == "text/csv":
        sections = _extract_csv(raw)
    elif suffix in {".xml", ".xhtml"} or normalized_type in {"application/xml", "text/xml", "application/xhtml+xml"}:
        sections = _extract_xml(raw)
    elif suffix in {".html", ".htm"} or normalized_type == "text/html":
        sections = _extract_html(raw)
    elif suffix in {".txt", ".md", ".rst", ".log", ".yaml", ".yml"} or normalized_type.startswith("text/"):
        sections = _extract_plain_text(raw)
    else:
        raise DocumentExtractionError(
            "DOCUMENT_TYPE_UNSUPPORTED",
            f"Unsupported document type: {suffix or normalized_type}",
        )

    normalized_sections = tuple(_normalize_sections(sections))
    if not normalized_sections:
        raise DocumentExtractionError(
            "DOCUMENT_TEXT_NOT_FOUND",
            "No readable text was extracted. Scanned documents require an approved OCR preprocessing step.",
        )
    text = "\n\n".join(f"[{section.title}]\n{section.text}" for section in normalized_sections)
    if len(text) > MAX_EXTRACTED_CHARACTERS:
        warnings.append(
            f"Extracted text was truncated from {len(text)} to {MAX_EXTRACTED_CHARACTERS} characters"
        )
        text = text[:MAX_EXTRACTED_CHARACTERS]
    return ExtractedDocument(
        filename=safe_name,
        content_type=normalized_type,
        sha256=hashlib.sha256(raw).hexdigest(),
        size_bytes=len(raw),
        text=text,
        sections=normalized_sections,
        warnings=tuple(warnings),
    )


def _extract_pdf(raw: bytes, warnings: list[str]) -> list[ExtractedSection]:
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError as exc:
        raise DocumentExtractionError(
            "PDF_EXTRACTOR_UNAVAILABLE",
            "PDF extraction requires the pypdf dependency in the AI Engine image",
        ) from exc
    try:
        reader = PdfReader(io.BytesIO(raw), strict=False)
    except Exception as exc:
        raise DocumentExtractionError("PDF_INVALID", f"PDF could not be parsed: {exc}") from exc
    sections: list[ExtractedSection] = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception as exc:
            warnings.append(f"PDF page {index} could not be extracted: {exc}")
            text = ""
        if text.strip():
            sections.append(
                ExtractedSection(
                    section_id=f"page-{index}",
                    title=f"Page {index}",
                    text=text,
                    source_anchor={"page": index},
                )
            )
    if not sections:
        warnings.append("The PDF may contain scanned images without an embedded text layer")
    return sections


def _extract_docx(raw: bytes) -> list[ExtractedSection]:
    with _open_zip(raw, "DOCX") as archive:
        paths = [
            name
            for name in archive.namelist()
            if name == "word/document.xml"
            or re.fullmatch(r"word/(?:header|footer)\d+\.xml", name)
            or name in {"word/footnotes.xml", "word/endnotes.xml"}
        ]
        sections: list[ExtractedSection] = []
        for path in sorted(paths, key=_natural_key):
            root = _parse_xml(archive.read(path), path)
            paragraphs = []
            for paragraph in root.iter():
                if _local_name(paragraph.tag) != "p":
                    continue
                text = "".join(
                    node.text or ""
                    for node in paragraph.iter()
                    if _local_name(node.tag) in {"t", "tab", "br"}
                ).strip()
                if text:
                    paragraphs.append(text)
            if paragraphs:
                sections.append(
                    ExtractedSection(
                        section_id=path.replace("/", "-"),
                        title=_docx_title(path),
                        text="\n".join(paragraphs),
                        source_anchor={"part": path},
                    )
                )
        return sections


def _extract_pptx(raw: bytes) -> list[ExtractedSection]:
    with _open_zip(raw, "PPTX") as archive:
        paths = sorted(
            (name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
            key=_natural_key,
        )
        sections = []
        for index, path in enumerate(paths, start=1):
            root = _parse_xml(archive.read(path), path)
            text = "\n".join(
                value.strip()
                for value in (node.text or "" for node in root.iter() if _local_name(node.tag) == "t")
                if value.strip()
            )
            if text:
                sections.append(
                    ExtractedSection(
                        section_id=f"slide-{index}",
                        title=f"Slide {index}",
                        text=text,
                        source_anchor={"slide": index, "part": path},
                    )
                )
        return sections


def _extract_xlsx(raw: bytes) -> list[ExtractedSection]:
    with _open_zip(raw, "XLSX") as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = _parse_xml(archive.read("xl/sharedStrings.xml"), "xl/sharedStrings.xml")
            for item in (node for node in root.iter() if _local_name(node.tag) == "si"):
                shared_strings.append(
                    "".join(node.text or "" for node in item.iter() if _local_name(node.tag) == "t")
                )
        sheet_paths = sorted(
            (name for name in archive.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name)),
            key=_natural_key,
        )
        sections: list[ExtractedSection] = []
        for index, path in enumerate(sheet_paths, start=1):
            root = _parse_xml(archive.read(path), path)
            lines: list[str] = []
            for row in (node for node in root.iter() if _local_name(node.tag) == "row"):
                values: list[str] = []
                for cell in (node for node in row if _local_name(node.tag) == "c"):
                    cell_type = cell.attrib.get("t")
                    value_node = next((node for node in cell if _local_name(node.tag) == "v"), None)
                    inline_node = next((node for node in cell.iter() if _local_name(node.tag) == "t"), None)
                    value = value_node.text if value_node is not None else inline_node.text if inline_node is not None else ""
                    if cell_type == "s" and value:
                        try:
                            value = shared_strings[int(value)]
                        except (ValueError, IndexError):
                            pass
                    values.append(str(value or ""))
                if any(value.strip() for value in values):
                    lines.append("\t".join(values))
            if lines:
                sections.append(
                    ExtractedSection(
                        section_id=f"sheet-{index}",
                        title=f"Worksheet {index}",
                        text="\n".join(lines),
                        source_anchor={"worksheet": index, "part": path},
                    )
                )
        return sections


def _extract_json(raw: bytes) -> list[ExtractedSection]:
    text = _decode(raw)
    try:
        value = json.loads(text)
    except json.JSONDecodeError as exc:
        raise DocumentExtractionError("JSON_INVALID", f"JSON document is invalid: {exc}") from exc
    rendered = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)
    return [ExtractedSection("json-root", "JSON document", rendered, {"path": "$"})]


def _extract_csv(raw: bytes) -> list[ExtractedSection]:
    text = _decode(raw)
    reader = csv.reader(io.StringIO(text))
    lines = ["\t".join(row) for row in reader if any(cell.strip() for cell in row)]
    return [ExtractedSection("csv-root", "CSV document", "\n".join(lines), {"row_start": 1})]


def _extract_xml(raw: bytes) -> list[ExtractedSection]:
    root = _parse_xml(raw, "document.xml")
    lines: list[str] = []
    for node in root.iter():
        text = (node.text or "").strip()
        if text:
            lines.append(f"{_local_name(node.tag)}: {text}")
    return [ExtractedSection("xml-root", _local_name(root.tag), "\n".join(lines), {"xpath": "/"})]


def _extract_html(raw: bytes) -> list[ExtractedSection]:
    text = _decode(raw)
    without_scripts = re.sub(r"(?is)<(?:script|style)[^>]*>.*?</(?:script|style)>", " ", text)
    normalized = re.sub(r"(?i)</(?:p|div|li|tr|h[1-6]|section|article)>", "\n", without_scripts)
    normalized = re.sub(r"(?s)<[^>]+>", " ", normalized)
    normalized = html.unescape(normalized)
    return [ExtractedSection("html-root", "HTML document", normalized, {"selector": "document"})]


def _extract_plain_text(raw: bytes) -> list[ExtractedSection]:
    text = _decode(raw)
    sections: list[ExtractedSection] = []
    current_title = "Document"
    current_lines: list[str] = []
    section_index = 1
    for line in text.splitlines():
        if re.match(r"^\s*(?:#{1,6}\s+|\d+(?:\.\d+)*[.)]?\s+)[^\s]", line):
            if any(value.strip() for value in current_lines):
                sections.append(
                    ExtractedSection(
                        f"section-{section_index}",
                        current_title,
                        "\n".join(current_lines),
                        {"section": section_index},
                    )
                )
                section_index += 1
            current_title = re.sub(r"^\s*#{1,6}\s+", "", line).strip()
            current_lines = []
        else:
            current_lines.append(line)
    if any(value.strip() for value in current_lines):
        sections.append(
            ExtractedSection(
                f"section-{section_index}",
                current_title,
                "\n".join(current_lines),
                {"section": section_index},
            )
        )
    return sections or [ExtractedSection("document", "Document", text, {"line_start": 1})]


def _normalize_sections(sections: Iterable[ExtractedSection]) -> Iterable[ExtractedSection]:
    for section in sections:
        text = re.sub(r"[ \t]+", " ", section.text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if not text:
            continue
        yield ExtractedSection(
            section_id=section.section_id,
            title=section.title.strip()[:512] or section.section_id,
            text=text,
            source_anchor=section.source_anchor,
        )


def _open_zip(raw: bytes, label: str) -> zipfile.ZipFile:
    try:
        return zipfile.ZipFile(io.BytesIO(raw))
    except (zipfile.BadZipFile, OSError) as exc:
        raise DocumentExtractionError(f"{label}_INVALID", f"{label} document is not a valid Open XML package") from exc


def _parse_xml(raw: bytes, path: str) -> ET.Element:
    try:
        return ET.fromstring(raw)
    except ET.ParseError as exc:
        raise DocumentExtractionError("DOCUMENT_XML_INVALID", f"XML part could not be parsed: {path}") from exc


def _decode(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-16", "cp1252"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise DocumentExtractionError("DOCUMENT_ENCODING_UNSUPPORTED", "Document text encoding is unsupported")


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _natural_key(value: str) -> list[Any]:
    return [int(part) if part.isdigit() else part for part in re.split(r"(\d+)", value)]


def _docx_title(path: str) -> str:
    if path == "word/document.xml":
        return "Main document"
    if "header" in path:
        return "Header"
    if "footer" in path:
        return "Footer"
    if "footnote" in path:
        return "Footnotes"
    if "endnote" in path:
        return "Endnotes"
    return path


def safe_filename(value: str) -> str:
    text = "".join("_" if character in '\\/:*?\"<>|\r\n' else character for character in str(value))
    return text[:255] or "document.bin"
