from __future__ import annotations

import base64
import io
import unittest
import zipfile

from app.quality_document.extractor import DocumentExtractionError, extract_document


def encoded(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


class DocumentExtractionTests(unittest.TestCase):
    def test_markdown_sections_preserve_source_anchors(self) -> None:
        document = b"# Purpose\nVerify saving records.\n\n## Rules\nA valid record shall remain visible.\n"
        result = extract_document(
            filename="requirements.md",
            content_type="text/markdown",
            content_base64=encoded(document),
        )
        self.assertEqual(result.sha256, __import__("hashlib").sha256(document).hexdigest())
        self.assertGreaterEqual(len(result.sections), 2)
        self.assertIn("valid record", result.text)
        self.assertTrue(result.sections[0].source_anchor)

    def test_docx_open_xml_text_is_extracted_without_office(self) -> None:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr(
                "word/document.xml",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>The application shall save a record.</w:t></w:r></w:p></w:body>
</w:document>""",
            )
        result = extract_document(
            filename="requirements.docx",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            content_base64=encoded(buffer.getvalue()),
        )
        self.assertIn("shall save a record", result.text)
        self.assertEqual(result.sections[0].source_anchor["part"], "word/document.xml")

    def test_unsupported_binary_is_rejected(self) -> None:
        with self.assertRaisesRegex(DocumentExtractionError, "Unsupported document type"):
            extract_document(
                filename="requirements.bin",
                content_type="application/octet-stream",
                content_base64=encoded(b"\x00\x01\x02"),
            )

    def test_empty_or_unreadable_text_is_not_invented(self) -> None:
        with self.assertRaises(DocumentExtractionError) as context:
            extract_document(
                filename="empty.txt",
                content_type="text/plain",
                content_base64=encoded(b"   \n\n"),
            )
        self.assertEqual(context.exception.code, "DOCUMENT_TEXT_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
