from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from app.script_repair.policy import RepairPolicyError, validate_repair
from app.script_repair.service import ScriptRepairService, parse_json_object


BEFORE = """*** Test Cases ***
Save Item
    Click Button    save
    Element Should Be Visible    success
"""


class RepairPolicyTests(unittest.TestCase):
    def test_valid_locator_wait_repair_is_accepted(self) -> None:
        after = """*** Test Cases ***
Save Item
    Wait Until Element Is Visible    save
    Click Button    save
    Element Should Be Visible    success
"""
        result = validate_repair(
            failure_classification="LOCATOR_FAILURE",
            attempt_number=1,
            before_script=BEFORE,
            after_script=after,
            proposed_changes=["add bounded semantic wait"],
        )
        self.assertTrue(result.valid)
        self.assertGreaterEqual(result.after_actions, result.before_actions)
        self.assertGreaterEqual(result.after_assertions, result.before_assertions)

    def test_product_defect_is_not_script_repairable(self) -> None:
        result = validate_repair(
            failure_classification="PRODUCT_DEFECT",
            attempt_number=1,
            before_script=BEFORE,
            after_script=BEFORE,
        )
        self.assertFalse(result.valid)

    def test_assertion_or_action_removal_is_rejected(self) -> None:
        result = validate_repair(
            failure_classification="LOCATOR_FAILURE",
            attempt_number=1,
            before_script=BEFORE,
            after_script="*** Test Cases ***\nSave Item\n    Log    PASS\n",
        )
        self.assertFalse(result.valid)
        self.assertIn("repair may not remove business actions", result.errors)
        self.assertIn("repair may not remove or weaken assertions", result.errors)

    def test_shell_and_plaintext_credentials_are_rejected(self) -> None:
        result = validate_repair(
            failure_classification="SCRIPT_DEFECT",
            attempt_number=1,
            before_script=BEFORE,
            after_script=BEFORE + "\n    Run Process    powershell    whoami\n${PASSWORD}    plain\n",
            proposed_changes=["run powershell"],
        )
        self.assertFalse(result.valid)
        self.assertTrue(any("shell" in error for error in result.errors))
        self.assertTrue(any("plaintext" in error for error in result.errors))


class RepairServiceTests(unittest.TestCase):
    def test_model_proposal_is_parsed_validated_and_diffed(self) -> None:
        after = BEFORE.replace("Click Button    save", "Wait Until Element Is Visible    save\n    Click Button    save")
        response = {
            "message": {
                "content": json.dumps(
                    {
                        "proposed_script": after,
                        "rationale": "The semantic locator is available after the transition.",
                        "changes": ["Add a bounded wait before the existing click."],
                    }
                )
            }
        }
        service = ScriptRepairService(endpoint="http://127.0.0.1:11434/api/chat", model="test-model")
        with patch.object(service, "_invoke", return_value=response):
            proposal = service.propose(
                failure_classification="LOCATOR_FAILURE",
                attempt_number=1,
                platform="WINDOWS",
                before_script=BEFORE,
                failure_message="Element not found",
            )
        self.assertIn("Wait Until Element Is Visible", proposal.proposed_script)
        self.assertIn("+    Wait Until Element Is Visible", proposal.unified_diff)
        self.assertTrue(proposal.validation["valid"])

    def test_non_json_content_is_rejected(self) -> None:
        with self.assertRaises(Exception):
            parse_json_object("not json")


if __name__ == "__main__":
    unittest.main()
