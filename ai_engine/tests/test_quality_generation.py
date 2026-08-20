from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from app.quality_generation.schemas import (
    GenerationStage,
    GenerationValidationError,
    validate_generation_output,
)
from app.quality_generation.service import QualityGenerationService


SOURCE_REQUIREMENT = {
    "item_type": "REQUIREMENT",
    "resource_id": "REQ-1",
    "resource_version": "1",
    "title": "Save a record",
    "source_anchor": {"section": "3.1"},
    "content": {
        "description": "The user shall be able to save a valid record.",
        "acceptance_criteria": ["The record is visible after save."],
    },
}


class SchemaTests(unittest.TestCase):
    def test_valid_scenario_retains_source_and_platform(self) -> None:
        value = {
            "items": [
                {
                    "resource_id": "SCN-1",
                    "item_type": "TEST_SCENARIO",
                    "title": "Save valid record",
                    "source_resource_ids": ["REQ-1"],
                    "source_anchor": {"requirement": "REQ-1"},
                    "content": {
                        "objective": "Verify a valid record can be saved and observed.",
                        "category": "POSITIVE",
                        "preconditions": ["Application is available"],
                        "expected_outcome": "The saved record is visible.",
                        "platforms": ["WINDOWS"],
                    },
                }
            ]
        }
        items = validate_generation_output(
            GenerationStage.TEST_SCENARIOS,
            value,
            source_items=[SOURCE_REQUIREMENT],
            platform="WINDOWS",
        )
        self.assertEqual(items[0].source_resource_ids, ("REQ-1",))
        self.assertEqual(items[0].item_type, "TEST_SCENARIO")
        self.assertEqual(len(items[0].content_hash), 64)

    def test_unknown_source_is_rejected(self) -> None:
        value = {
            "items": [
                {
                    "item_type": "TEST_SCENARIO",
                    "title": "Invalid source",
                    "source_resource_ids": ["REQ-MISSING"],
                    "source_anchor": {"requirement": "REQ-MISSING"},
                    "content": {
                        "objective": "Verify source validation rejects unknown references.",
                        "category": "NEGATIVE",
                        "expected_outcome": "The invalid source is rejected.",
                        "platforms": ["WINDOWS"],
                    },
                }
            ]
        }
        with self.assertRaises(GenerationValidationError):
            validate_generation_output(
                GenerationStage.TEST_SCENARIOS,
                value,
                source_items=[SOURCE_REQUIREMENT],
                platform="WINDOWS",
            )

    def test_script_placeholders_shell_and_missing_assertion_are_rejected(self) -> None:
        source = {
            "item_type": "LOGICAL_STEP",
            "resource_id": "LS-1",
            "content": {"steps": [{"action": "Save", "assertion": "Record visible"}]},
        }
        scripts = (
            "*** Test Cases ***\nUnsafe\n    Run Process    powershell    whoami\n    Should Be True    ${TRUE}\n",
            "*** Test Cases ***\nPlaceholder\n    Click Button    <locator>\n    Element Should Be Visible    success\n",
            "*** Test Cases ***\nNo assertion\n    Click Button    save\n",
        )
        for script in scripts:
            with self.subTest(script=script):
                value = {
                    "items": [
                        {
                            "item_type": "TEST_SCRIPT",
                            "title": "Generated script",
                            "source_resource_ids": ["LS-1"],
                            "source_anchor": {"logical_step": "LS-1"},
                            "content": {
                                "platform": "WINDOWS",
                                "filename": "generated.robot",
                                "script": script,
                            },
                        }
                    ]
                }
                with self.assertRaises(GenerationValidationError):
                    validate_generation_output(
                        GenerationStage.TEST_SCRIPTS,
                        value,
                        source_items=[source],
                        platform="WINDOWS",
                    )


class ServiceTests(unittest.TestCase):
    def test_local_model_response_is_validated(self) -> None:
        response_content = {
            "items": [
                {
                    "item_type": "TEST_SCENARIO",
                    "title": "Save valid record",
                    "source_resource_ids": ["REQ-1"],
                    "source_anchor": {"requirement": "REQ-1"},
                    "content": {
                        "objective": "Verify a valid record can be saved and observed.",
                        "category": "POSITIVE",
                        "preconditions": [],
                        "expected_outcome": "The record is visible.",
                        "platforms": ["WINDOWS"],
                    },
                }
            ]
        }
        service = QualityGenerationService(endpoint="http://127.0.0.1:11434/api/chat", model="test-model")
        with patch.object(
            service,
            "_invoke",
            return_value={"message": {"content": json.dumps(response_content)}},
        ):
            result = service.generate(
                stage="TEST_SCENARIOS",
                source_items=[SOURCE_REQUIREMENT],
                platform="WINDOWS",
            )
        self.assertEqual(result.model, "test-model")
        self.assertEqual(result.items[0].item_type, "TEST_SCENARIO")
        self.assertTrue(result.to_dict()["approval_required"])


if __name__ == "__main__":
    unittest.main()
