#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import re
import subprocess
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


def run_v1() -> None:
    subprocess.run(
        [sys.executable, str(ROOT / "tools/cyfast_full_lifecycle_integrate.py")],
        cwd=ROOT,
        check=True,
    )


def patch_general_management_index(text: str) -> str:
    marker = 'const qualityLifecycleExecutionRoutes = require("./routes/quality-lifecycle-execution-routes");'
    requires = "\n".join(
        [
            'const qualityLifecycleContentRoutes = require("./routes/quality-lifecycle-content-routes");',
            'const qualityGenerationRoutes = require("./routes/quality-generation-routes");',
            'const executionProductFixRoutes = require("./routes/execution-product-fix-routes");',
            'const executionProductVerificationRoutes = require("./routes/execution-product-verification-routes");',
        ]
    )
    if marker not in text:
        fallback = 'const platformExecutionRoutes = require("./routes/platform-execution-routes");'
        marker = fallback
    text = insert_after(text, marker, "\n" + requires)
    register_marker = "fastify.register(qualityLifecycleExecutionRoutes);"
    if register_marker not in text:
        register_marker = "fastify.register(platformExecutionRoutes);"
    registrations = "\n".join(
        [
            "  await fastify.register(qualityLifecycleContentRoutes);",
            "  await fastify.register(qualityGenerationRoutes);",
            "  await fastify.register(executionProductFixRoutes);",
            "  await fastify.register(executionProductVerificationRoutes);",
        ]
    )
    return insert_after(text, register_marker, "\n" + registrations)


def patch_ai_main(text: str) -> str:
    imports = [
        "from app.quality_generation.router import router as quality_generation_router",
        "from app.quality_document.router import router as quality_document_router",
    ]
    lines = text.splitlines()
    for import_line in imports:
        if import_line not in lines:
            import_indexes = [index for index, line in enumerate(lines) if line.startswith(("from ", "import "))]
            lines.insert(import_indexes[-1] + 1 if import_indexes else 0, import_line)
    text = "\n".join(lines) + ("\n" if text.endswith("\n") else "")
    match = re.search(r"(?m)^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*FastAPI\s*\(", text)
    if not match:
        raise ValueError("FastAPI application assignment was not found")
    app_name = match.group(1)
    for router_name in ("quality_generation_router", "quality_document_router"):
        include = f"{app_name}.include_router({router_name})"
        if include in text:
            continue
        include_lines = list(re.finditer(rf"(?m)^\s*{re.escape(app_name)}\.include_router\([^\n]+\)\s*$", text))
        if not include_lines:
            raise ValueError("Existing FastAPI include_router marker was not found")
        position = include_lines[-1].end()
        text = text[:position] + "\n" + include + text[position:]
    return text


def patch_quality_service(text: str) -> str:
    if "LOGICAL_STEPS_APPROVED" not in text:
        text = text.replace(
            '  LOGICAL_STEPS_GENERATED: "LOGICAL_STEPS_GENERATED",\n  SCRIPT_GENERATED:',
            '  LOGICAL_STEPS_GENERATED: "LOGICAL_STEPS_GENERATED",\n  LOGICAL_STEPS_APPROVED: "LOGICAL_STEPS_APPROVED",\n  SCRIPT_GENERATED:',
            1,
        )
        text = text.replace(
            "  [STATES.LOGICAL_STEPS_GENERATED]: 9,\n  [STATES.SCRIPT_GENERATED]: 10,",
            "  [STATES.LOGICAL_STEPS_GENERATED]: 9,\n  [STATES.LOGICAL_STEPS_APPROVED]: 10,\n  [STATES.SCRIPT_GENERATED]: 11,",
            1,
        )
        text = text.replace("  [STATES.SCRIPT_VALIDATED]: 11,", "  [STATES.SCRIPT_VALIDATED]: 12,")
        text = text.replace("  [STATES.READY_FOR_EXECUTION]: 12,", "  [STATES.READY_FOR_EXECUTION]: 13,")
        text = text.replace("  [STATES.EXECUTING]: 13,", "  [STATES.EXECUTING]: 14,")
        text = text.replace("  [STATES.COMPLETED]: 14,", "  [STATES.COMPLETED]: 15,")
        text = text.replace("  [STATES.FAILED]: 14,", "  [STATES.FAILED]: 15,")
        text = text.replace("  [STATES.CANCELLED]: 14,", "  [STATES.CANCELLED]: 15,")
        text = text.replace(
            "  [STATES.LOGICAL_STEPS_GENERATED]: new Set([STATES.SCRIPT_GENERATED]),",
            "  [STATES.LOGICAL_STEPS_GENERATED]: new Set([STATES.LOGICAL_STEPS_APPROVED]),\n  [STATES.LOGICAL_STEPS_APPROVED]: new Set([STATES.SCRIPT_GENERATED]),",
            1,
        )
    text = text.replace(
        "  [STATES.FAILED]: new Set([]),",
        "  [STATES.FAILED]: new Set([STATES.EXECUTING]),",
        1,
    )
    if '"APPLICATION"' not in text.partition("const ITEM_TYPES")[2].partition("]);")[0]:
        text = text.replace(
            '  "LOGICAL_STEP",\n  "TEST_SCRIPT",',
            '  "LOGICAL_STEP",\n  "APPLICATION",\n  "DEVICE",\n  "LOCATOR_SET",\n  "TARGET_PROFILE",\n  "TEST_SCRIPT",',
            1,
        )
    if '"APPLICATION"' not in text.partition("const APPROVAL_REQUIRED_TYPES")[2].partition("]);")[0]:
        text = text.replace(
            '  "LOGICAL_STEP",\n  "TEST_SCRIPT",',
            '  "LOGICAL_STEP",\n  "APPLICATION",\n  "DEVICE",\n  "LOCATOR_SET",\n  "TARGET_PROFILE",\n  "TEST_SCRIPT",',
            1,
        )
    binding_guard = '''  if (["APPLICATION", "DEVICE", "LOCATOR_SET", "TARGET_PROFILE", "AUTOMATION_PROJECT_PROFILE"].includes(itemType) &&
      ![STATES.COMPLETED, STATES.CANCELLED].includes(status)) return;
'''
    marker = "function assertItemAllowedForState(status, itemType) {\n"
    if binding_guard.strip() not in text:
        text = insert_after(text, marker, binding_guard)
    if "[STATES.LOGICAL_STEPS_APPROVED]: [\"LOGICAL_STEP\"]" not in text:
        text = text.replace(
            '    [STATES.TEST_DATA_APPROVED]: ["TEST_DATA"],\n',
            '    [STATES.TEST_DATA_APPROVED]: ["TEST_DATA"],\n    [STATES.LOGICAL_STEPS_APPROVED]: ["LOGICAL_STEP"],\n',
            1,
        )
    readiness_binding = '''  const approvedTypes = new Set(values
    .filter((item) => item.approval_status === "APPROVED")
    .map((item) => item.item_type));
  const selectedPlatform = String(lifecycle.generation_policy?.selected_platform || lifecycle.generation_policy?.platform || "").toUpperCase();
  const bindingTypes = {
    WINDOWS: ["APPLICATION", "LOCATOR_SET"],
    LINUX: ["TARGET_PROFILE"],
    ANDROID: ["APPLICATION", "DEVICE", "LOCATOR_SET"],
    EMBEDDED: ["DEVICE", "TARGET_PROFILE"],
  }[selectedPlatform] || [];
  for (const type of bindingTypes) {
    if (!approvedTypes.has(type)) errors.push(`Approved ${type} binding is required for ${selectedPlatform}`);
  }
'''
    if readiness_binding.strip() not in text:
        marker = "  const traceabilityErrors = validateTraceability(values);"
        text = insert_before(text, marker, readiness_binding)
    return text


def patch_content_service(text: str) -> str:
    old = '''  const rawContent = input.content !== undefined
    ? input.content
    : input.content_json !== undefined
      ? input.content_json
      : input.content_text;'''
    new = '''  const rawContent = ["TEXT", "ROBOT"].includes(format)
    ? (input.content_text !== undefined ? input.content_text : input.content)
    : (input.content !== undefined ? input.content : input.content_json);'''
    if old in text:
        text = text.replace(old, new, 1)
    if "[\"TEXT\", \"ROBOT\"].includes(format)" not in text:
        raise ValueError("quality content raw-content normalization marker was not patched")
    return text


def patch_hydrator(text: str) -> str:
    if "loadQualityLifecycleScript" not in text:
        helper = r'''
async function loadQualityLifecycleScript(db, { organizationId, projectId, testScriptId }) {
  if (!db.QualityLifecycleItem || !db.QualityLifecycleContent) return null;
  const item = await db.QualityLifecycleItem.findOne({
    where: {
      organization_id: Number(organizationId),
      project_id: Number(projectId),
      item_type: "TEST_SCRIPT",
      resource_id: String(testScriptId),
      approval_status: "APPROVED",
      deleted_date: null,
    },
    order: [["created_date", "DESC"]],
  });
  if (!item) return null;
  const content = await db.QualityLifecycleContent.findOne({
    where: {
      quality_lifecycle_item_id: item.quality_lifecycle_item_id,
      organization_id: Number(organizationId),
      project_id: Number(projectId),
      generation_status: "VALIDATED",
      deleted_date: null,
    },
  });
  if (!content || !String(content.content_text || "").trim()) return null;
  const metadata = content.content_json || {};
  return {
    id: item.resource_id,
    test_script_id: item.resource_id,
    name: content.title,
    test_script_name: content.title,
    version: item.resource_version,
    test_script_version: item.resource_version,
    content: content.content_text,
    script: content.content_text,
    script_content: content.content_text,
    code: content.content_text,
    suite_path: metadata.suite_path || metadata.filename || `${item.resource_id}.robot`,
    resource_files: Array.isArray(metadata.resource_files) ? metadata.resource_files : [],
    resources: Array.isArray(metadata.resource_files) ? metadata.resource_files : [],
    variables: metadata.variables || {},
    environment_references: metadata.environment_references || {},
    quality_lifecycle_id: item.quality_lifecycle_id,
    content_hash: content.content_hash,
  };
}

'''
        marker = "module.exports = {"
        text = insert_before(text, marker, helper)
    if "const qualityLifecycleScript = await loadQualityLifecycleScript" not in text:
        patterns = [
            re.compile(r"(async\s+loadScript\s*\(\s*\{[^)]*testScriptId[^)]*\}\s*\)\s*\{)", re.S),
            re.compile(r"(loadScript\s*:\s*async\s*\(\s*\{[^)]*testScriptId[^)]*\}\s*\)\s*=>\s*\{)", re.S),
        ]
        addition = '''
      const qualityLifecycleScript = await loadQualityLifecycleScript(db, { organizationId, projectId, testScriptId });
      if (qualityLifecycleScript) return qualityLifecycleScript;
'''
        for pattern in patterns:
            match = pattern.search(text)
            if match:
                text = text[: match.end()] + addition + text[match.end() :]
                break
        else:
            raise ValueError("createSequelizeScriptRepository loadScript method was not found")
    return text


def patch_quality_execution(text: str) -> str:
    if "QUALITY_EXECUTION_TARGET_PLATFORM_MISMATCH" not in text:
        marker = "  const run = await execution.startRun({"
        addition = '''  const target = await db.ExecutionTarget.findOne({
    where: {
      execution_target_id: input.execution_target_id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
  if (!target) throw typedError("EXECUTION_TARGET_NOT_FOUND", "Execution target was not found", 404);
  const scriptContent = await db.QualityLifecycleContent.findOne({
    where: {
      quality_lifecycle_item_id: selected.quality_lifecycle_item_id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      generation_status: "VALIDATED",
      deleted_date: null,
    },
  });
  if (!scriptContent) throw typedError("VALIDATED_TEST_SCRIPT_REQUIRED", "Selected Test Script content is not validated", 422);
  const scriptPlatform = String(scriptContent.content_json?.platform || lifecycle.generation_policy?.selected_platform || "").toUpperCase();
  if (scriptPlatform && scriptPlatform !== target.platform) {
    throw typedError(
      "QUALITY_EXECUTION_TARGET_PLATFORM_MISMATCH",
      `Validated ${scriptPlatform} script cannot execute on ${target.platform}`,
      409,
    );
  }
'''
        text = insert_before(text, marker, addition)
    transition_call = '''  await quality.transition(lifecycleId, quality.STATES.EXECUTING, actor, {
    active_execution_run_id: run.execution_run_id,
  });'''
    if "await synchronizeRun(run, actor);" not in text.partition(transition_call)[2][:200]:
        if transition_call not in text:
            raise ValueError("quality lifecycle EXECUTING transition marker was not found")
        text = text.replace(transition_call, transition_call + "\n  await synchronizeRun(run, actor);", 1)
    if "let lifecycle = await quality.getLifecycle" not in text:
        text = text.replace(
            "  const lifecycle = await quality.getLifecycle(link.quality_lifecycle_id, actor);",
            "  let lifecycle = await quality.getLifecycle(link.quality_lifecycle_id, actor);",
            1,
        )
    restart = '''  if (lifecycle.status === quality.STATES.FAILED && !["CANCELLED"].includes(runValue.status)) {
    lifecycle = await quality.transition(lifecycle.quality_lifecycle_id, quality.STATES.EXECUTING, actor, {
      restarted_by_execution_run_id: runValue.execution_run_id,
      relationship: link.relationship,
    });
  }
'''
    if restart.strip() not in text:
        marker = "  if (runValue.status === \"PASSED\" && lifecycle.status === quality.STATES.EXECUTING) {"
        text = insert_before(text, marker, restart)
    return text


def patch_linked_rerun(text: str) -> str:
    if "qualityExecution.synchronizeRun" not in text:
        marker = "  return run;"
        addition = '''  try {
    const qualityExecution = require("../quality-lifecycle-execution-service");
    await qualityExecution.synchronizeRun(run, actor);
  } catch (error) {
    await store.appendEvent(run, {
      event_type: "execution.linked_rerun.quality_sync.warning.v1",
      actor_type: "SYSTEM",
      actor_id: "quality-lifecycle-sync",
      payload: { code: error.code || "QUALITY_LIFECYCLE_SYNC_FAILED", message: error.message },
    });
  }
'''
        text = insert_before(text, marker, addition)
    return text


def patch_execution_lifecycle(text: str) -> str:
    marker = "      await qualityExecution.synchronizeRun(terminal, actor);"
    addition = '''
      try {
        const productFix = require("./execution-product-fix-service");
        await productFix.synchronizeVerification(terminal, actor);
      } catch (productFixError) {
        await store.appendEvent(terminal, {
          event_type: "execution.product_fix_sync.warning.v1",
          actor_type: "SYSTEM",
          actor_id: "product-fix-sync",
          payload: { code: productFixError.code || "PRODUCT_FIX_SYNC_FAILED", message: productFixError.message },
        });
      }
'''
    if "execution.product_fix_sync.warning.v1" not in text:
        if marker not in text:
            raise ValueError("quality lifecycle synchronization marker was not found")
        text = text.replace(marker, marker + addition, 1)
    return text


def patch_metrics(text: str) -> str:
    text = text.replace("INTERVAL :days DAY", "INTERVAL ${days} DAY")
    return text


def patch_workspace(text: str) -> str:
    import_line = 'import "./quality-lifecycle-workspace.css";'
    if import_line not in text:
        lines = text.splitlines()
        indexes = [index for index, line in enumerate(lines) if line.startswith("import ")]
        lines.insert(indexes[-1] + 1 if indexes else 0, import_line)
        text = "\n".join(lines) + ("\n" if text.endswith("\n") else "")
    return text


def patch_console(text: str) -> str:
    text = text.replace(
        'import QualityLifecyclePanel from "./QualityLifecyclePanel";',
        'import QualityLifecycleWorkspace from "./QualityLifecycleWorkspace";',
    )
    if 'import QualityLifecycleWorkspace from "./QualityLifecycleWorkspace";' not in text:
        marker = 'import ExecutionProofPanel from "./ExecutionProofPanel";'
        text = insert_after(text, marker, '\nimport QualityLifecycleWorkspace from "./QualityLifecycleWorkspace";')
    pattern = re.compile(
        r'\{activeTab === "lifecycle" \? \(\s*<QualityLifecyclePanel[\s\S]*?/>\s*\) : null\}',
        re.M,
    )
    replacement = '''{activeTab === "lifecycle" ? (
        <QualityLifecycleWorkspace
          projectId={projectId}
          targets={targets}
          onExecutionStarted={(value) => {
            setRuns((current) => [value, ...current.filter((item) => item.execution_run_id !== value.execution_run_id)]);
            setSelectedRunId(value.execution_run_id);
            setActiveTab("runs");
          }}
        />
      ) : null}'''
    if pattern.search(text):
        text = pattern.sub(replacement, text, count=1)
    elif "<QualityLifecycleWorkspace" not in text:
        raise ValueError("QualityLifecyclePanel JSX block was not found")
    return text


def patch_proof_panel(text: str) -> str:
    import_line = 'import ProductFixPanel from "./ProductFixPanel";'
    if import_line not in text:
        text = insert_after(text, 'import React, { useMemo, useState } from "react";', "\n" + import_line)
    component = "      <ProductFixPanel projectId={projectId} run={run} defects={defects} />\n\n"
    marker = '      <Section title="Repair attempts" count={repairs.length}>'
    if component.strip() not in text:
        text = insert_before(text, marker, component)
    return text


def patch_product_fix_api(text: str) -> str:
    if "startVerification(projectId" not in text:
        marker = "  verification(projectId, fixId, executionRunId) {"
        addition = '''  startVerification(projectId, fixId, input = {}) {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return request(`/execution_product_fixes/${encodeURIComponent(fixId)}/verification_rerun`, {
      method: "POST",
      projectId,
      body: { ...input, idempotency_key: input.idempotency_key || `product-fix-${random}` },
    });
  },
'''
        text = insert_before(text, marker, addition)
    return text


def patch_product_fix_panel(text: str) -> str:
    if "async function startVerification" not in text:
        marker = "  async function verification(event) {"
        addition = '''  async function startVerification(fix) {
    setLoading(true);
    setError("");
    try {
      const value = await executionProductFixApi.startVerification(projectId, fix.execution_product_fix_id, {
        timeout_seconds: 900,
        evidence_policy: {
          screen_recording: true,
          screenshots: true,
          device_logs: true,
          protocol_trace: true,
        },
      });
      setNotice(`Verification rerun ${value.execution_run_id} was created with the original root lineage.`);
      await load();
    } catch (reason) {
      setError(`${reason.code ? `${reason.code}: ` : ""}${reason.message || reason}`);
    } finally {
      setLoading(false);
    }
  }

'''
        text = insert_before(text, marker, addition)
    old = '{fix.deployment_status === "DEPLOYED" && !fix.verification_execution_run_id ? <button type="button" className="cyfast-link-button" onClick={() => setVerifying(fix)}>Link verification rerun</button> : null}'
    new = '{fix.deployment_status === "DEPLOYED" && !fix.verification_execution_run_id ? <button type="button" className="cyfast-link-button" onClick={() => startVerification(fix)} disabled={loading}>Start verification rerun</button> : null}'
    text = text.replace(old, new)
    return text


def patch_platform_api(text: str) -> str:
    if "globalThis.crypto?.randomUUID" not in text:
        text = text.replace(
            "const idempotencyKey = input.idempotency_key || `ui-${Date.now()}-${crypto.randomUUID()}`;",
            "const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;\n    const idempotencyKey = input.idempotency_key || `ui-${random}`;",
        )
        text = text.replace(
            "const idempotencyKey = input.idempotency_key || `repair-${Date.now()}-${crypto.randomUUID()}`;",
            "const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;\n    const idempotencyKey = input.idempotency_key || `repair-${random}`;",
        )
    return text


def class_block(text: str, class_name: str) -> tuple[int, int, str]:
    match = re.search(rf"(?m)^class\s+{re.escape(class_name)}\b[^:]*:\s*$", text)
    if not match:
        raise ValueError(f"class {class_name} was not found")
    next_class = re.search(r"(?m)^class\s+[A-Za-z_]", text[match.end() :])
    end = match.end() + next_class.start() if next_class else len(text)
    return match.start(), end, text[match.start() : end]


def add_recording_hooks_to_class(text: str, class_name: str, platform: str) -> str:
    start, end, block = class_block(text, class_name)
    if "start_desktop_recording" in block:
        return text
    before = re.search(r"(?m)^(\s+)(async\s+)?def\s+before_execution\s*\(", block)
    after = re.search(r"(?m)^(\s+)(async\s+)?def\s+after_execution\s*\(", block)
    indent = (before or after).group(1) if (before or after) else "    "
    if before:
        block = re.sub(
            r"(?m)^(\s+)(async\s+)?def\s+before_execution\s*\(",
            lambda match: f"{match.group(1)}def _cyfast_original_before_execution(",
            block,
            count=1,
        )
        before_call = "self._cyfast_original_before_execution(request, workspace, output_directory, cancellation)"
    else:
        before_call = "super().before_execution(request, workspace, output_directory, cancellation)"
    if after:
        block = re.sub(
            r"(?m)^(\s+)(async\s+)?def\s+after_execution\s*\(",
            lambda match: f"{match.group(1)}def _cyfast_original_after_execution(",
            block,
            count=1,
        )
        after_call = "self._cyfast_original_after_execution(request, workspace, output_directory, context, cancellation)"
    else:
        after_call = "super().after_execution(request, workspace, output_directory, context, cancellation)"
    methods = f'''\n{indent}def before_execution(self, request, workspace, output_directory, cancellation):
{indent}    context = {before_call}
{indent}    start_desktop_recording(request, output_directory, "{platform}")
{indent}    return context

{indent}def after_execution(self, request, workspace, output_directory, context, cancellation):
{indent}    try:
{indent}        return {after_call}
{indent}    finally:
{indent}        stop_desktop_recording(request)
'''
    block = block.rstrip() + methods + "\n\n"
    return text[:start] + block + text[end:]


def patch_executors(text: str) -> str:
    import_line = "from .recording_hooks import start_desktop_recording, stop_desktop_recording"
    if import_line not in text:
        lines = text.splitlines()
        indexes = [index for index, line in enumerate(lines) if line.startswith(("from ", "import "))]
        lines.insert(indexes[-1] + 1 if indexes else 0, import_line)
        text = "\n".join(lines) + ("\n" if text.endswith("\n") else "")
    text = add_recording_hooks_to_class(text, "WindowsExecutor", "WINDOWS")
    text = add_recording_hooks_to_class(text, "LinuxExecutor", "LINUX")
    return text


def write_marker() -> None:
    path = ROOT / "docs/implementation/CYFAST_FULL_LIFECYCLE_V2_INTEGRATED.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    content = """# CyFAST full lifecycle v2 integration marker

This marker confirms that automatic document extraction, schema-validated local-model generation, immutable generated content, application/device/locator binding, script validation, four-platform real execution, recordings, defects, bounded script repair, reviewed product fixes, verification reruns, traceability, and metrics are connected through the existing CyFAST services.

Real platform acceptance remains dependent on the dedicated self-hosted runner evidence workflow.
"""
    original = path.read_text(encoding="utf-8") if path.exists() else ""
    if original != content:
        path.write_text(content, encoding="utf-8")
        CHANGED.append(str(path.relative_to(ROOT)))


def main() -> int:
    run_v1()
    patch("apis/general_management/index.js", patch_general_management_index)
    patch("ai_engine/app/main.py", patch_ai_main)
    patch("apis/general_management/services/quality-lifecycle-service.js", patch_quality_service)
    patch("apis/general_management/services/quality-lifecycle-content-service.js", patch_content_service)
    patch("apis/general_management/services/execution/script-package-hydrator.js", patch_hydrator)
    patch("apis/general_management/services/quality-lifecycle-execution-service.js", patch_quality_execution)
    patch("apis/general_management/services/execution/execution-linked-rerun-service.js", patch_linked_rerun)
    patch("apis/general_management/services/execution/execution-lifecycle-service.js", patch_execution_lifecycle)
    patch("apis/general_management/services/execution/execution-metrics-service.js", patch_metrics)
    patch("ui/src/pages/execution/QualityLifecycleWorkspace.jsx", patch_workspace)
    patch("ui/src/pages/execution/PlatformExecutionConsole.jsx", patch_console)
    patch("ui/src/pages/execution/ExecutionProofPanel.jsx", patch_proof_panel)
    patch("ui/src/pages/execution/ProductFixPanel.jsx", patch_product_fix_panel)
    patch("ui/src/services/executionProductFixApi.js", patch_product_fix_api)
    patch("ui/src/services/platformExecutionApi.js", patch_platform_api)
    patch("test_agent/test_agent/platform_runtime/executors.py", patch_executors)
    write_marker()
    print({"changed_count": len(CHANGED), "changed_files": CHANGED})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
