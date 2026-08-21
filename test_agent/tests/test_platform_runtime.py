from __future__ import annotations

import base64
import http.client
import json
import pathlib
import tempfile
import threading
import unittest

from test_agent.platform_runtime.contracts import ExecutionPackage, ExecutionRequest, ExecutionResult, JobSnapshot, JobState, Platform, RuntimeHealth, utc_now
from test_agent.platform_runtime.package import PackageValidationError, validate_package
from test_agent.platform_runtime.server import build_server


SUITE = """*** Test Cases ***
Valid Flow
    Click Button    save
    Element Should Be Visible    success
"""


def encoded_file(path: str, content: str) -> dict[str, object]:
    raw = content.encode("utf-8")
    import hashlib

    return {
        "path": path,
        "content_base64": base64.b64encode(raw).decode("ascii"),
        "size": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
    }


class PackageTests(unittest.TestCase):
    def test_valid_package_is_hydrated_with_meaningful_proof(self) -> None:
        package = ExecutionPackage.from_mapping(
            {
                "suite_path": "suite.robot",
                "files": [encoded_file("suite.robot", SUITE)],
            }
        )
        result = validate_package(package)
        self.assertEqual(result.meaningful_actions, 1)
        self.assertEqual(result.meaningful_assertions, 1)

    def test_absolute_and_traversing_paths_are_rejected(self) -> None:
        for path in ("../suite.robot", "/tmp/suite.robot", "C:\\suite.robot"):
            with self.subTest(path=path):
                package = ExecutionPackage.from_mapping(
                    {"suite_path": path, "files": [encoded_file(path, SUITE)]}
                )
                with self.assertRaises(PackageValidationError):
                    validate_package(package)

    def test_checksum_mismatch_is_rejected(self) -> None:
        item = encoded_file("suite.robot", SUITE)
        item["sha256"] = "0" * 64
        package = ExecutionPackage.from_mapping({"suite_path": "suite.robot", "files": [item]})
        with self.assertRaisesRegex(PackageValidationError, "checksum mismatch"):
            validate_package(package)

    def test_todo_shell_and_plaintext_secret_are_rejected(self) -> None:
        invalid = (
            "# TODO replace locator\n" + SUITE,
            "*** Test Cases ***\nUnsafe\n    Run Process    powershell    whoami\n    Should Be True    ${TRUE}\n",
            "*** Variables ***\n${PASSWORD}    plaintext\n" + SUITE,
        )
        for content in invalid:
            package = ExecutionPackage.from_mapping(
                {"suite_path": "suite.robot", "files": [encoded_file("suite.robot", content)]}
            )
            with self.assertRaises(PackageValidationError):
                validate_package(package)

    def test_execution_result_emits_explicit_meaningful_proof_flags(self) -> None:
        timestamp = utc_now()
        result = ExecutionResult(
            execution_id="run-1",
            correlation_id="corr-1",
            platform=Platform.WINDOWS,
            status="PASSED",
            real_execution=True,
            simulated=False,
            target_connected=True,
            session_created=True,
            exit_code=0,
            meaningful_actions=2,
            meaningful_assertions=1,
            started_at=timestamp,
            finished_at=timestamp,
            duration_ms=1,
            artifacts=(),
            desktop_execution=True,
            interactive_desktop=True,
            application_controlled=True,
        ).to_dict()
        self.assertTrue(result["meaningful_actions_executed"])
        self.assertTrue(result["meaningful_assertions_executed"])
        self.assertEqual(result["robot_exit_code"], 0)


class FakeExecutor:
    platform = Platform.LINUX

    def check(self, runtime: object) -> RuntimeHealth:
        return RuntimeHealth(
            platform=Platform.LINUX,
            ready=True,
            status="READY",
            real_execution=True,
            simulated=False,
            target_connected=True,
            session_created=False,
            components=(),
            capabilities=("linux_robot",),
            checked_at=utc_now(),
        )

    def cancel(self, execution_id: str) -> None:
        return None


class FakeRegistry:
    def __init__(self) -> None:
        self.executor = FakeExecutor()

    def get(self, platform: Platform) -> FakeExecutor:
        if platform is not Platform.LINUX:
            raise ValueError("unsupported")
        return self.executor

    def platforms(self) -> tuple[Platform, ...]:
        return (Platform.LINUX,)


class FakeJobs:
    def __init__(self) -> None:
        self.created: ExecutionRequest | None = None

    def create(self, request: ExecutionRequest) -> JobSnapshot:
        self.created = request
        return JobSnapshot(
            execution_id=request.execution_id,
            platform=request.platform,
            state=JobState.CREATED,
            created_at=utc_now(),
            updated_at=utc_now(),
        )

    def get(self, execution_id: str) -> JobSnapshot | None:
        if not self.created or execution_id != self.created.execution_id:
            return None
        return JobSnapshot(
            execution_id=execution_id,
            platform=self.created.platform,
            state=JobState.RUNNING,
            created_at=utc_now(),
            updated_at=utc_now(),
        )

    def cancel(self, execution_id: str) -> JobSnapshot | None:
        snapshot = self.get(execution_id)
        if snapshot:
            snapshot.state = JobState.CANCELLED
        return snapshot

    def close(self) -> None:
        return None


class ServerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.token = "x" * 40
        self.jobs = FakeJobs()
        self.server = build_server(
            host="127.0.0.1",
            port=0,
            token=self.token,
            registry=FakeRegistry(),
            jobs=self.jobs,
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)

    def request(self, method: str, path: str, body: dict[str, object] | None, token: str | None = None) -> tuple[int, dict[str, object]]:
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {
            "authorization": f"Bearer {token or self.token}",
            "content-type": "application/json",
        }
        connection.request(method, path, body=payload, headers=headers)
        response = connection.getresponse()
        value = json.loads(response.read().decode("utf-8"))
        connection.close()
        return response.status, value

    def test_authentication_is_mandatory(self) -> None:
        status, value = self.request("GET", "/health", None, token="wrong")
        self.assertEqual(status, 401)
        self.assertEqual(value["code"], "UNAUTHORIZED")

    def test_runtime_check_uses_fixed_platform_route(self) -> None:
        status, value = self.request("POST", "/v1/linux/runtime/check", {"configuration": {}})
        self.assertEqual(status, 200)
        self.assertTrue(value["ready"])
        self.assertFalse(value["simulated"])

    def test_execution_acceptance_does_not_claim_real_pass(self) -> None:
        status, value = self.request(
            "POST",
            "/v1/linux/executions",
            {
                "execution_id": "run-1",
                "correlation_id": "corr-1",
                "platform": "LINUX",
                "organization_id": 1,
                "project_id": 2,
                "package": {
                    "suite_path": "suite.robot",
                    "manifest": {"organization_id": 1, "project_id": 2},
                    "files": [encoded_file("suite.robot", SUITE)],
                },
                "runtime": {},
                "evidence_policy": {},
                "timeout_seconds": 60,
            },
        )
        self.assertEqual(status, 202)
        self.assertEqual(value["status"], "CREATED")
        self.assertFalse(value["real_execution"])
        self.assertFalse(value["target_connected"])


if __name__ == "__main__":
    unittest.main()
