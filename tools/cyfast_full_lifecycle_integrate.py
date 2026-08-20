#!/usr/bin/env python3
from __future__ import annotations

import os
import pathlib
import re
import sys
from typing import Callable


ROOT = pathlib.Path(__file__).resolve().parents[1]
CHANGED: list[str] = []


def patch(relative: str, transform: Callable[[str], str]) -> None:
    path = ROOT / relative
    if not path.exists():
        raise FileNotFoundError(f"required integration file is missing: {relative}")
    original = path.read_text(encoding="utf-8-sig")
    updated = transform(original)
    if updated == original:
        return
    path.write_text(updated, encoding="utf-8")
    CHANGED.append(relative)


def insert_after(text: str, marker: str, addition: str) -> str:
    if addition.strip() in text:
        return text
    if marker not in text:
        raise ValueError(f"integration marker was not found: {marker}")
    return text.replace(marker, marker + addition, 1)


def insert_before(text: str, marker: str, addition: str) -> str:
    if addition.strip() in text:
        return text
    if marker not in text:
        raise ValueError(f"integration marker was not found: {marker}")
    return text.replace(marker, addition + marker, 1)


def patch_general_management_index(text: str) -> str:
    require_marker = 'const platformExecutionRoutes = require("./routes/platform-execution-routes");'
    requires = "\n".join(
        [
            'const executionTraceRoutes = require("./routes/execution-trace-routes");',
            'const executionMetricsRoutes = require("./routes/execution-metrics-routes");',
            'const executionAiRepairRoutes = require("./routes/execution-ai-repair-routes");',
            'const qualityLifecycleRoutes = require("./routes/quality-lifecycle-routes");',
            'const qualityLifecycleExecutionRoutes = require("./routes/quality-lifecycle-execution-routes");',
        ]
    )
    text = insert_after(text, require_marker, "\n" + requires)
    register_marker = "fastify.register(platformExecutionRoutes);"
    registrations = "\n".join(
        [
            "fastify.register(executionTraceRoutes);",
            "fastify.register(executionMetricsRoutes);",
            "fastify.register(executionAiRepairRoutes);",
            "fastify.register(qualityLifecycleRoutes);",
            "fastify.register(qualityLifecycleExecutionRoutes);",
        ]
    )
    return insert_after(text, register_marker, "\n" + registrations)


def patch_ai_main(text: str) -> str:
    import_line = "from app.script_repair.router import router as script_repair_router"
    if import_line not in text:
        lines = text.splitlines()
        insert_index = 0
        for index, line in enumerate(lines):
            if line.startswith(("from ", "import ")):
                insert_index = index + 1
        lines.insert(insert_index, import_line)
        text = "\n".join(lines) + ("\n" if text.endswith("\n") else "")
    if "include_router(script_repair_router)" in text:
        return text
    match = re.search(r"(?m)^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*FastAPI\s*\(", text)
    if not match:
        raise ValueError("FastAPI application assignment was not found in ai_engine/app/main.py")
    app_name = match.group(1)
    include_lines = list(re.finditer(rf"(?m)^\s*{re.escape(app_name)}\.include_router\([^\n]+\)\s*$", text))
    addition = f"\n{app_name}.include_router(script_repair_router)"
    if include_lines:
        position = include_lines[-1].end()
        return text[:position] + addition + text[position:]
    assignment_end = text.find("\n", match.end())
    return text[:assignment_end] + addition + text[assignment_end:]


def find_routes_file() -> pathlib.Path:
    candidates = [
        ROOT / "ui/src/Routes.jsx",
        ROOT / "ui/src/routes/Routes.jsx",
        ROOT / "ui/src/router/Routes.jsx",
    ]
    candidates.extend(sorted((ROOT / "ui/src").rglob("*Routes*.jsx")))
    for candidate in candidates:
        if candidate.exists() and "<Route" in candidate.read_text(encoding="utf-8-sig"):
            return candidate
    raise FileNotFoundError("React Routes JSX file was not found")


def patch_ui_routes_file(path: pathlib.Path) -> None:
    original = path.read_text(encoding="utf-8-sig")
    target = ROOT / "ui/src/pages/execution/PlatformExecutionConsole.jsx"
    relative = os.path.relpath(target.with_suffix(""), path.parent).replace(os.sep, "/")
    if not relative.startswith("."):
        relative = "./" + relative
    import_line = f'import PlatformExecutionConsole from "{relative}";'
    text = original
    if import_line not in text:
        lines = text.splitlines()
        import_indexes = [index for index, line in enumerate(lines) if line.strip().startswith("import ")]
        insert_index = import_indexes[-1] + 1 if import_indexes else 0
        lines.insert(insert_index, import_line)
        text = "\n".join(lines) + ("\n" if original.endswith("\n") else "")
    if "execution-lifecycle" not in text:
        if "</Routes>" in text:
            route = '        <Route path="/projects/:projectId/execution-lifecycle" element={<PlatformExecutionConsole />} />\n'
            text = text.replace("</Routes>", route + "      </Routes>", 1)
        elif "</Switch>" in text:
            route = '        <Route exact path="/projects/:projectId/execution-lifecycle" component={PlatformExecutionConsole} />\n'
            text = text.replace("</Switch>", route + "      </Switch>", 1)
        else:
            raise ValueError(f"Unable to identify React Router version in {path.relative_to(ROOT)}")
    if text != original:
        path.write_text(text, encoding="utf-8")
        CHANGED.append(str(path.relative_to(ROOT)))


def patch_execution_api(text: str) -> str:
    if "proposeAiRepair(projectId" not in text:
        marker = "  proposeRepair(projectId, runId, proposal) {"
        addition = '''  proposeAiRepair(projectId, runId) {
    return request(`/execution_runs/${encodeURIComponent(runId)}/ai_repair`, {
      method: "POST",
      projectId,
      body: { project_id: Number(projectId) },
    });
  },
'''
        text = insert_before(text, marker, addition)
    if "startLifecycleExecution(projectId" not in text:
        marker = "  lifecycleEvents(projectId, lifecycleId) {"
        addition = '''  startLifecycleExecution(projectId, lifecycleId, input) {
    const idempotencyKey = input.idempotency_key || `lifecycle-${Date.now()}-${crypto.randomUUID()}`;
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/executions`, {
      method: "POST",
      projectId,
      headers: { "idempotency-key": idempotencyKey },
      body: { ...input, project_id: Number(projectId), idempotency_key: idempotencyKey },
    });
  },
  lifecycleExecutions(projectId, lifecycleId, options = {}) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/executions${queryString({ project_id: projectId, page_size: 100, ...options })}`, { projectId });
  },
'''
        text = insert_before(text, marker, addition)
    return text


def patch_proof_panel(text: str) -> str:
    if "onGenerateAiRepair" not in text:
        text = text.replace(
            "  onApproveRepair,\n  artifactUrl,",
            "  onApproveRepair,\n  onGenerateAiRepair,\n  aiRepairLoading,\n  artifactUrl,",
            1,
        )
    marker = '      <Section title="Repair attempts" count={repairs.length}>'
    if "Generate bounded AI repair" not in text:
        addition = '''      {run.status === "REPAIR_PENDING" ? (
        <section className="cyfast-subpanel">
          <div className="cyfast-subpanel-heading">
            <div>
              <h4>Bounded AI script repair</h4>
              <p>Only locator, timing, import, or script defects are eligible. Approval and a saved script version remain required.</p>
            </div>
            <button type="button" className="cyfast-button" onClick={() => onGenerateAiRepair(run)} disabled={aiRepairLoading}>
              {aiRepairLoading ? "Generating…" : "Generate bounded AI repair"}
            </button>
          </div>
        </section>
      ) : null}

'''
        text = insert_before(text, marker, addition)
    return text


def patch_console(text: str) -> str:
    if "const [aiRepairLoading" not in text:
        text = text.replace(
            '  const [repairApproval, setRepairApproval] = useState(null);',
            '  const [repairApproval, setRepairApproval] = useState(null);\n  const [aiRepairLoading, setAiRepairLoading] = useState(false);',
            1,
        )
    if "async function generateAiRepair" not in text:
        marker = "  async function approveRepair(event) {"
        addition = '''  async function generateAiRepair(value) {
    clearMessages();
    setAiRepairLoading(true);
    try {
      const generated = await platformExecutionApi.proposeAiRepair(projectId, value.execution_run_id);
      setNotice(`AI repair attempt ${generated.repair.attempt_number} was generated and is awaiting review.`);
      await loadRunDetails(value.execution_run_id);
    } catch (reason) {
      reportError(reason);
    } finally {
      setAiRepairLoading(false);
    }
  }

'''
        text = insert_before(text, marker, addition)
    if "async function startQualityLifecycleExecution" not in text:
        marker = "  async function transitionLifecycle(status) {"
        addition = '''  async function startQualityLifecycleExecution(input) {
    clearMessages();
    setLoading(true);
    try {
      const value = await platformExecutionApi.startLifecycleExecution(
        projectId,
        selectedLifecycle.quality_lifecycle_id,
        input,
      );
      setNotice(`Lifecycle execution ${value.run.execution_run_id} was started.`);
      await loadLifecycles();
      await loadTargetsAndRuns();
      setSelectedRunId(value.run.execution_run_id);
      setActiveTab("runs");
    } catch (reason) {
      reportError(reason);
    } finally {
      setLoading(false);
    }
  }

'''
        text = insert_before(text, marker, addition)
    if "onGenerateAiRepair={generateAiRepair}" not in text:
        text = text.replace(
            "            onApproveRepair={(repair) => setRepairApproval({ ...repair, approved_test_script_id: \"\", approved_test_script_version: \"\", timeout_seconds: runForm.timeout_seconds })}\n            artifactUrl={platformExecutionApi.artifactUrl}",
            "            onApproveRepair={(repair) => setRepairApproval({ ...repair, approved_test_script_id: \"\", approved_test_script_version: \"\", timeout_seconds: runForm.timeout_seconds })}\n            onGenerateAiRepair={generateAiRepair}\n            aiRepairLoading={aiRepairLoading}\n            artifactUrl={platformExecutionApi.artifactUrl}",
            1,
        )
    if "onStartExecution={startQualityLifecycleExecution}" not in text:
        text = text.replace(
            "          onTransition={transitionLifecycle}\n          onRefresh={loadLifecycles}",
            "          onTransition={transitionLifecycle}\n          onStartExecution={startQualityLifecycleExecution}\n          targets={targets}\n          onRefresh={loadLifecycles}",
            1,
        )
    return text


def patch_quality_panel(text: str) -> str:
    if "onStartExecution" not in text.split(") {")[0]:
        text = text.replace(
            "  onTransition,\n  onRefresh,",
            "  onTransition,\n  onStartExecution,\n  targets = [],\n  onRefresh,",
            1,
        )
    if "executionTargetId" not in text:
        text = text.replace(
            '  const [localError, setLocalError] = useState("");',
            '  const [localError, setLocalError] = useState("");\n  const [executionTargetId, setExecutionTargetId] = useState("");',
            1,
        )
    marker = "          {nextState ? ("
    if "Start approved script in real environment" not in text:
        addition = '''          {selected.status === "READY_FOR_EXECUTION" ? (
            <div className="cyfast-transition-box">
              <div>
                <strong>Start approved script in real environment</strong>
                <span>The run is linked to this lifecycle and cannot PASS without real proof.</span>
              </div>
              <div className="cyfast-actions">
                <select value={executionTargetId} onChange={(event) => setExecutionTargetId(event.target.value)}>
                  <option value="">Select ready target</option>
                  {targets.filter((target) => target.status === "READY").map((target) => (
                    <option value={target.execution_target_id} key={target.execution_target_id}>{target.name} · {target.platform}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="cyfast-button"
                  disabled={!executionTargetId || loading}
                  onClick={() => onStartExecution({
                    execution_target_id: executionTargetId,
                    timeout_seconds: 900,
                    evidence_policy: {
                      screen_recording: true,
                      screenshots: true,
                      device_logs: true,
                      protocol_trace: true,
                    },
                  })}
                >
                  Start real execution
                </button>
              </div>
            </div>
          ) : null}

'''
        text = insert_before(text, marker, addition)
    return text


def patch_contract(text: str) -> str:
    if "CYFAST_BLOCKING_RUNTIME_CODES" not in text:
        marker = "function classifyFailure("
        position = text.find(marker)
        if position < 0:
            raise ValueError("classifyFailure function was not found")
        opening = text.find("{", position)
        if opening < 0:
            raise ValueError("classifyFailure opening brace was not found")
        insertion = '''
  const normalizedCode = String(input.code || input.error_code || input.errorCode || "").toUpperCase();
  const normalizedMessage = String(input.message || input.failure_message || input.failureMessage || "").toLowerCase();
  const CYFAST_BLOCKING_RUNTIME_CODES = /(?:TARGET|AGENT|DEVICE|APPIUM|WINAPPDRIVER|DRIVER|RUNTIME|DESKTOP|SESSION|INTERFACE|BENCH).*(?:UNAVAILABLE|OFFLINE|DISCONNECTED|LOCKED|NOT_READY|NOT_FOUND|FAILED|REQUIRED)|ANDROID_DEVICE_DISCONNECTED|WINDOWS_RUNTIME_NOT_READY/;
  if (CYFAST_BLOCKING_RUNTIME_CODES.test(normalizedCode) || /(?:device|agent|target|desktop|interface|bench).*(?:disconnected|offline|locked|unavailable|not ready)/.test(normalizedMessage)) {
    return FAILURE_CLASSES.TARGET_UNAVAILABLE;
  }
'''
        text = text[: opening + 1] + insertion + text[opening + 1 :]
    return text


def patch_trace_service(text: str) -> str:
    if '"LOGICAL_STEP",' not in text:
        text = text.replace('  "TEST_DATA",\n  "TEST_SCRIPT",', '  "TEST_DATA",\n  "LOGICAL_STEP",\n  "TEST_SCRIPT",', 1)
    return text


def patch_hydrator(text: str) -> str:
    if "organization_id: Number(organizationId)" not in text:
        marker = "const manifest = {"
        position = text.find(marker)
        if position < 0:
            raise ValueError("script package manifest was not found")
        opening = text.find("{", position)
        insertion = "\n    organization_id: Number(organizationId),\n    project_id: Number(projectId),"
        text = text[: opening + 1] + insertion + text[opening + 1 :]
    return text


def patch_execution_store(text: str) -> str:
    if "const previousStatus = run.status;" not in text:
        marker = "    const safePatch = redactSecrets(patch || {});"
        if marker not in text:
            raise ValueError("transitionRun safePatch marker was not found")
        text = text.replace(marker, "    const previousStatus = run.status;\n" + marker, 1)
        text = text.replace(
            "previous_status: run._previousDataValues?.status",
            "previous_status: previousStatus",
            1,
        )
    return text


def patch_execution_lifecycle(text: str) -> str:
    if 'const traceService = require("./execution-trace-service");' not in text:
        require_marker = 'const defaultArtifacts = require("./execution-artifact-service");'
        text = insert_after(text, require_marker, '\nconst traceService = require("./execution-trace-service");')
    if "execution.test_script.bound.v1" not in text:
        marker = "      const adapter = registry.get(platform);"
        addition = '''      await traceService.appendTraceLinks(run, [
        {
          link_type: "TEST_SCRIPT",
          resource_id: String(input.test_script_id),
          resource_version: String(packageValue.manifest.test_script_version || input.test_script_version || "current"),
          relationship: "USES",
          source_system: "CYFAST",
          metadata: {
            package_sha256: packageValue.package_sha256,
            suite_path: packageValue.suite_path,
          },
        },
        ...(Array.isArray(input.traceability) ? input.traceability : []),
      ], actor);
      await store.appendEvent(run, {
        event_type: "execution.test_script.bound.v1",
        actor_type: "SYSTEM",
        actor_id: "execution-lifecycle",
        payload: { test_script_id: String(input.test_script_id), package_sha256: packageValue.package_sha256 },
      });

'''
        text = insert_before(text, marker, addition)
    text = text.replace("return store.transitionRun(runId, actor, RUN_STATES.PASSED,", "return transitionAndSynchronize(runId, actor, RUN_STATES.PASSED,")
    text = text.replace("return store.transitionRun(runId, actor, RUN_STATES.BLOCKED,", "return transitionAndSynchronize(runId, actor, RUN_STATES.BLOCKED,")
    text = text.replace("return store.transitionRun(runId, actor, RUN_STATES.FAILED,", "return transitionAndSynchronize(runId, actor, RUN_STATES.FAILED,")
    text = text.replace("return store.transitionRun(runId, actor, RUN_STATES.CANCELLED,", "return transitionAndSynchronize(runId, actor, RUN_STATES.CANCELLED,")
    if "async function transitionAndSynchronize" not in text:
        marker = "  return {\n    registerTarget,"
        helper = '''  async function transitionAndSynchronize(...arguments_) {
    const terminal = await store.transitionRun(...arguments_);
    if (!terminal) return terminal;
    const actor = arguments_[1];
    try {
      const qualityExecution = require("../quality-lifecycle-execution-service");
      await qualityExecution.synchronizeRun(terminal, actor);
    } catch (error) {
      await store.appendEvent(terminal, {
        event_type: "execution.quality_lifecycle_sync.warning.v1",
        actor_type: "SYSTEM",
        actor_id: "quality-lifecycle-sync",
        payload: { code: error.code || "QUALITY_LIFECYCLE_SYNC_FAILED", message: error.message },
      });
    }
    return terminal;
  }

'''
        text = insert_before(text, marker, helper)
    if "execution.repair.superseded.v1" not in text:
        marker = "    return rerun;\n  }\n\n  async function failRunFromError"
        addition = '''    await store.transitionRun(run.execution_run_id, actor, RUN_STATES.FAILED, {
      result_summary: {
        ...(run.result_summary || {}),
        superseded_by_execution_run_id: rerun.execution_run_id,
        repair_attempt_id: repairId,
      },
    }, {
      event_type: "execution.repair.superseded.v1",
      actor_type: "USER",
      actor_id: actor.userId,
      payload: { rerun_execution_run_id: rerun.execution_run_id, execution_repair_attempt_id: repairId },
    });
'''
        if marker not in text:
            raise ValueError("repair rerun return marker was not found")
        text = text.replace("    return rerun;\n  }\n\n  async function failRunFromError", addition + "    return rerun;\n  }\n\n  async function failRunFromError", 1)
    return text


def patch_quality_states(text: str) -> str:
    # LOGICAL_STEP is a trace type; no extra state mutation is required. Keep this hook for idempotent future schema evolution.
    return text


def write_marker() -> None:
    path = ROOT / "docs/implementation/CYFAST_FULL_LIFECYCLE_INTEGRATED.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    content = """# CyFAST full lifecycle integration marker

This branch integrates the document-to-requirement-to-scenario-to-case-to-data-to-script workflow with the common Windows, Linux, Android, and embedded execution contract, evidence retention, defect classification, bounded AI repair, rerun lineage, traceability, and performance metrics.

The marker is generated by `tools/cyfast_full_lifecycle_integrate.py`. The script is repeat-safe and is executed by the branch validation workflow.
"""
    original = path.read_text(encoding="utf-8") if path.exists() else ""
    if original != content:
        path.write_text(content, encoding="utf-8")
        CHANGED.append(str(path.relative_to(ROOT)))


def main() -> int:
    patch("apis/general_management/index.js", patch_general_management_index)
    patch("ai_engine/app/main.py", patch_ai_main)
    patch_ui_routes_file(find_routes_file())
    patch("ui/src/services/platformExecutionApi.js", patch_execution_api)
    patch("ui/src/pages/execution/ExecutionProofPanel.jsx", patch_proof_panel)
    patch("ui/src/pages/execution/PlatformExecutionConsole.jsx", patch_console)
    patch("ui/src/pages/execution/QualityLifecyclePanel.jsx", patch_quality_panel)
    patch("apis/general_management/services/execution/execution-contract.js", patch_contract)
    patch("apis/general_management/services/execution/execution-trace-service.js", patch_trace_service)
    patch("apis/general_management/services/execution/script-package-hydrator.js", patch_hydrator)
    patch("apis/general_management/services/execution/execution-store.js", patch_execution_store)
    patch("apis/general_management/services/execution/execution-lifecycle-service.js", patch_execution_lifecycle)
    patch("apis/general_management/services/quality-lifecycle-service.js", patch_quality_states)
    write_marker()
    print(json_summary())
    return 0


def json_summary() -> str:
    import json

    return json.dumps({"changed_files": CHANGED, "changed_count": len(CHANGED)}, indent=2)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"CyFAST integration failed: {exc}", file=sys.stderr)
        raise
