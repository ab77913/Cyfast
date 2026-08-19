"use strict";

const path = require("path");

function assertSafeExecutablePath(executablePath, allowUnc = false) {
  if (!executablePath || typeof executablePath !== "string") {
    throw Object.assign(new Error("executable_path is required"), {
      code: "APPLICATION_NOT_APPROVED",
      statusCode: 400,
    });
  }
  if (executablePath.includes("..")) {
    throw Object.assign(new Error("Path traversal is not allowed"), {
      code: "APPLICATION_NOT_APPROVED",
      statusCode: 400,
    });
  }
  if (executablePath.startsWith("\\\\") && !allowUnc) {
    throw Object.assign(new Error("UNC paths are not allowed by policy"), {
      code: "APPLICATION_NOT_APPROVED",
      statusCode: 400,
    });
  }
  if (!path.isAbsolute(executablePath)) {
    throw Object.assign(new Error("executable_path must be absolute"), {
      code: "APPLICATION_NOT_APPROVED",
      statusCode: 400,
    });
  }
}

function normalizeProfile(data) {
  const configuration = {
    ...(data.configuration || {}),
    executable_sha256: data.executable_sha256 || data.configuration?.executable_sha256 || null,
    working_directory: data.working_directory || data.configuration?.working_directory || null,
    approved_arguments: data.approved_arguments || data.configuration?.approved_arguments || [],
    environment_variable_refs:
      data.environment_variable_refs || data.configuration?.environment_variable_refs || [],
    launch_timeout_ms: data.launch_timeout_ms || data.configuration?.launch_timeout_ms || 30000,
    attach_strategy: data.attach_strategy || data.configuration?.attach_strategy || "process_name",
    expected_process_name: data.expected_process_name || data.configuration?.expected_process_name || null,
    expected_window_title: data.expected_window_title || data.configuration?.expected_window_title || null,
    allowed_child_processes:
      data.allowed_child_processes || data.configuration?.allowed_child_processes || [],
    allow_terminate: Boolean(data.allow_terminate ?? data.configuration?.allow_terminate ?? false),
    screenshot_redaction_policy:
      data.screenshot_redaction_policy || data.configuration?.screenshot_redaction_policy || { maskPasswords: true },
    enabled: data.enabled !== false,
    allow_unc_paths: Boolean(data.allow_unc_paths || data.configuration?.allow_unc_paths),
  };
  assertSafeExecutablePath(data.executable_path, configuration.allow_unc_paths);
  return {
    organization_id: data.organization_id,
    project_id: data.project_id || null,
    name: data.name,
    executable_path: data.executable_path,
    allowlist: data.allowlist || [],
    configuration,
  };
}

module.exports = { assertSafeExecutablePath, normalizeProfile };
