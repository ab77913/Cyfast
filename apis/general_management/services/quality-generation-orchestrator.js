"use strict";

const axios = require("axios");
const crypto = require("crypto");
const db = require("../database/mysql/models");
const quality = require("./quality-lifecycle-service");
const contentService = require("./quality-lifecycle-content-service");
const {
  canonicalJson,
  sha256,
  redactSecrets,
  typedError,
} = require("./execution/execution-contract");
const {
  hydrateScriptPackage,
  createSequelizeScriptRepository,
  PACKAGE_LIMIT_BYTES,
} = require("./execution/script-package-hydrator");
const { getInternalApiToken } = require("./windows/windows-security-config");

const STAGE_BY_STATUS = Object.freeze({
  DOCUMENT_UPLOADED: "REQUIREMENTS",
  REQUIREMENTS_APPROVED: "TEST_SCENARIOS",
  SCENARIOS_APPROVED: "TEST_CASES",
  TEST_CASES_APPROVED: "TEST_DATA",
  TEST_DATA_APPROVED: "LOGICAL_STEPS",
  LOGICAL_STEPS_APPROVED: "TEST_SCRIPTS",
});

const GENERATED_STATUS_BY_STAGE = Object.freeze({
  REQUIREMENTS: "REQUIREMENTS_GENERATED",
  TEST_SCENARIOS: "SCENARIOS_GENERATED",
  TEST_CASES: "TEST_CASES_GENERATED",
  TEST_DATA: "TEST_DATA_GENERATED",
  LOGICAL_STEPS: "LOGICAL_STEPS_GENERATED",
  TEST_SCRIPTS: "SCRIPT_GENERATED",
});

const SOURCE_TYPES_BY_STAGE = Object.freeze({
  REQUIREMENTS: ["DOCUMENT"],
  TEST_SCENARIOS: ["REQUIREMENT", "RISK"],
  TEST_CASES: ["TEST_SCENARIO"],
  TEST_DATA: ["TEST_CASE"],
  LOGICAL_STEPS: ["TEST_CASE", "TEST_DATA"],
  TEST_SCRIPTS: [
    "LOGICAL_STEP",
    "TEST_CASE",
    "TEST_DATA",
    "APPLICATION",
    "DEVICE",
    "LOCATOR_SET",
    "TARGET_PROFILE",
    "AUTOMATION_PROJECT_PROFILE",
  ],
});

async function generateNextStage(lifecycleId, input, actor) {
  const lifecycle = await quality.getLifecycle(lifecycleId, actor);
  if (!lifecycle) throw typedError("QUALITY_LIFECYCLE_NOT_FOUND", "Quality lifecycle was not found", 404);
  const expectedStage = STAGE_BY_STATUS[lifecycle.status];
  const requestedStage = String(input.stage || expectedStage || "").toUpperCase();
  if (!expectedStage) {
    throw typedError(
      "QUALITY_GENERATION_NOT_ALLOWED",
      `Lifecycle state ${lifecycle.status} does not permit generation`,
      409,
    );
  }
  if (requestedStage !== expectedStage) {
    throw typedError(
      "QUALITY_GENERATION_STAGE_MISMATCH",
      `Lifecycle state ${lifecycle.status} requires ${expectedStage}, not ${requestedStage}`,
      409,
    );
  }

  const generationPolicy = lifecycle.generation_policy || {};
  const selectedPlatform = String(
    input.platform
      || generationPolicy.selected_platform
      || generationPolicy.platform
      || "",
  ).toUpperCase();
  if (requestedStage === "TEST_SCRIPTS" && !["WINDOWS", "LINUX", "ANDROID", "EMBEDDED"].includes(selectedPlatform)) {
    throw typedError("QUALITY_PLATFORM_REQUIRED", "TEST_SCRIPTS generation requires a selected platform", 422);
  }

  const source = requestedStage === "REQUIREMENTS"
    ? await loadUploadedDocumentSource(lifecycle, actor)
    : await loadApprovedSources(lifecycle, requestedStage, actor);
  assertStageBindings(requestedStage, selectedPlatform, source.items);

  const generatedResponse = await callQualityGeneration({
    stage: requestedStage,
    platform: selectedPlatform || null,
    source_items: source.items,
    context: redactSecrets({
      quality_lifecycle_id: lifecycleId,
      project_id: actor.projectId,
      organization_id: actor.organizationId,
      lifecycle_name: lifecycle.name,
      selected_platform: selectedPlatform || null,
      application_context: input.application_context || {},
      safety_context: input.safety_context || {},
    }),
    generation_policy: generationPolicy,
  }, lifecycle);
  if (generatedResponse.stage !== requestedStage || !Array.isArray(generatedResponse.items) || !generatedResponse.items.length) {
    throw typedError("QUALITY_GENERATION_RESPONSE_INVALID", "AI Engine returned no valid generated items", 502);
  }
  const response = requestedStage === "TEST_SCRIPTS"
    ? materializeProjectPackages(generatedResponse, source.items, generationPolicy.project_mode)
    : generatedResponse;

  const sourceMap = new Map(source.persistedItems.map((item) => [String(item.resource_id), item]));
  const persisted = await contentService.createGeneratedItems(lifecycleId, response, sourceMap, actor);
  await quality.transition(
    lifecycleId,
    GENERATED_STATUS_BY_STAGE[requestedStage],
    { ...actor, actorType: "AI", actorId: response.model || "quality-generation" },
    {
      generation_stage: requestedStage,
      generated_item_count: persisted.length,
      model_id: response.model,
      prompt_version: response.prompt_version,
      source_hash: source.sourceHash,
      warnings: response.warnings || [],
    },
  );
  return {
    lifecycle_id: lifecycleId,
    stage: requestedStage,
    generated_status: GENERATED_STATUS_BY_STAGE[requestedStage],
    generated_items: persisted.map(({ item, content }) => ({ item, content })),
    model: response.model,
    prompt_version: response.prompt_version,
    warnings: response.warnings || [],
  };
}

async function validateGeneratedScripts(lifecycleId, actor) {
  const lifecycle = await quality.getLifecycle(lifecycleId, actor);
  if (!lifecycle) throw typedError("QUALITY_LIFECYCLE_NOT_FOUND", "Quality lifecycle was not found", 404);
  if (lifecycle.status !== "SCRIPT_GENERATED") {
    throw typedError("SCRIPT_VALIDATION_NOT_ALLOWED", `Scripts cannot be validated while lifecycle is ${lifecycle.status}`, 409);
  }
  const scripts = await db.QualityLifecycleItem.findAll({
    where: {
      quality_lifecycle_id: lifecycleId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      item_type: "TEST_SCRIPT",
      approval_status: "APPROVED",
      deleted_date: null,
    },
    order: [["created_date", "ASC"]],
  });
  if (!scripts.length) throw typedError("APPROVED_SCRIPT_REQUIRED", "At least one approved generated Test Script is required", 422);

  const repository = createSequelizeScriptRepository(db);
  const reports = [];
  for (const script of scripts) {
    try {
      const packageValue = await hydrateScriptPackage({
        organizationId: actor.organizationId,
        projectId: actor.projectId,
        testScriptId: script.resource_id,
        repository,
        maximumBytes: PACKAGE_LIMIT_BYTES,
      });
      const result = {
        valid: true,
        test_script_id: script.resource_id,
        test_script_version: script.resource_version,
        suite_path: packageValue.suite_path,
        package_sha256: packageValue.package_sha256,
        package_bytes: packageValue.manifest.package_bytes,
        file_count: packageValue.manifest.file_count,
        meaningful_actions: packageValue.manifest.meaningful_actions,
        meaningful_assertions: packageValue.manifest.meaningful_assertions,
        validated_at: new Date().toISOString(),
        validation_type: "STATIC_PACKAGE_AND_SECURITY",
        real_execution: false,
        simulated: false,
      };
      await contentService.markValidated(script.quality_lifecycle_item_id, actor, result);
      reports.push(await contentService.createContentItem(lifecycleId, {
        item_type: "VALIDATION_REPORT",
        resource_id: `VAL-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
        resource_version: script.resource_version,
        title: `Validation report for ${script.resource_id}`,
        source_item_id: script.quality_lifecycle_item_id,
        source_anchor: {
          test_script_id: script.resource_id,
          test_script_version: script.resource_version,
          package_sha256: packageValue.package_sha256,
        },
        generation_metadata: { origin: "CYFAST_VALIDATOR" },
        approval_status: "APPROVED",
        content_format: "REPORT",
        content: result,
        source_hash: script.content_hash,
        generation_status: "VALIDATED",
        validation_result: result,
      }, { ...actor, actorType: "SYSTEM", actorId: "script-package-validator" }));
    } catch (error) {
      await contentService.markValidated(script.quality_lifecycle_item_id, actor, {
        valid: false,
        code: error.code || "SCRIPT_VALIDATION_FAILED",
        message: error.message,
        validated_at: new Date().toISOString(),
      });
      throw typedError(
        error.code || "SCRIPT_VALIDATION_FAILED",
        `Generated script ${script.resource_id} failed validation: ${error.message}`,
        error.statusCode || 422,
      );
    }
  }
  await quality.transition(lifecycleId, "SCRIPT_VALIDATED", {
    ...actor,
    actorType: "SYSTEM",
    actorId: "script-package-validator",
  }, {
    validation_report_count: reports.length,
    real_execution: false,
    validation_only: true,
  });
  return { lifecycle_id: lifecycleId, valid: true, reports };
}

async function loadUploadedDocumentSource(lifecycle, actor) {
  const documentItem = await db.QualityLifecycleItem.findOne({
    where: {
      quality_lifecycle_id: lifecycle.quality_lifecycle_id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      item_type: "DOCUMENT",
      approval_status: "APPROVED",
      deleted_date: null,
    },
  });
  if (!documentItem) throw typedError("SOURCE_DOCUMENT_ITEM_NOT_FOUND", "Approved source document item was not found", 404);
  let stored = await db.QualityLifecycleContent.findOne({
    where: {
      quality_lifecycle_item_id: documentItem.quality_lifecycle_item_id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
  if (!stored) {
    const document = await fetchStoredDocument(lifecycle);
    if (document.sha256 !== lifecycle.source_document_hash) {
      throw typedError(
        "SOURCE_DOCUMENT_HASH_MISMATCH",
        "Stored source document checksum does not match the lifecycle snapshot",
        409,
      );
    }
    const extracted = await callDocumentExtraction(document, lifecycle);
    stored = await db.QualityLifecycleContent.create({
      quality_lifecycle_content_id: crypto.randomUUID().replace(/-/g, ""),
      quality_lifecycle_id: lifecycle.quality_lifecycle_id,
      quality_lifecycle_item_id: documentItem.quality_lifecycle_item_id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      item_type: "DOCUMENT",
      resource_id: documentItem.resource_id,
      resource_version: documentItem.resource_version,
      title: extracted.filename,
      content_format: "JSON",
      content_text: extracted.text,
      content_json: {
        filename: extracted.filename,
        content_type: extracted.content_type,
        sections: extracted.sections,
        warnings: extracted.warnings,
      },
      content_hash: sha256(extracted.text),
      source_hash: extracted.sha256,
      schema_version: "1.0",
      model_id: null,
      prompt_version: null,
      generation_status: "EXTRACTED",
      validation_result: {
        valid: true,
        document_sha256: extracted.sha256,
        size_bytes: extracted.size_bytes,
        section_count: extracted.sections.length,
        warnings: extracted.warnings,
      },
      created_by: actor.userId || actor.actorId,
    });
  }
  const item = {
    item_type: "DOCUMENT",
    resource_id: documentItem.resource_id,
    resource_version: documentItem.resource_version,
    title: stored.title,
    source_anchor: documentItem.source_anchor,
    content: stored.content_json?.sections?.length
      ? { text: stored.content_text, sections: stored.content_json.sections }
      : stored.content_text,
  };
  return {
    items: [item],
    persistedItems: [documentItem],
    sourceHash: stored.content_hash,
  };
}

async function loadApprovedSources(lifecycle, stage, actor) {
  const sourceTypes = SOURCE_TYPES_BY_STAGE[stage];
  const persistedItems = await db.QualityLifecycleItem.findAll({
    where: {
      quality_lifecycle_id: lifecycle.quality_lifecycle_id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      item_type: sourceTypes,
      approval_status: "APPROVED",
      deleted_date: null,
    },
    order: [["created_date", "ASC"]],
  });
  if (!persistedItems.length) {
    throw typedError("APPROVED_GENERATION_SOURCES_REQUIRED", `No approved ${sourceTypes.join("/")} sources were found`, 422);
  }
  const contents = await db.QualityLifecycleContent.findAll({
    where: {
      quality_lifecycle_id: lifecycle.quality_lifecycle_id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      quality_lifecycle_item_id: persistedItems.map((item) => item.quality_lifecycle_item_id),
      deleted_date: null,
    },
  });
  const contentByItem = new Map(contents.map((item) => [item.quality_lifecycle_item_id, item]));
  const missing = persistedItems.filter((item) => !contentByItem.has(item.quality_lifecycle_item_id));
  if (missing.length) {
    throw typedError(
      "GENERATION_SOURCE_CONTENT_MISSING",
      `Approved source content is missing for: ${missing.map((item) => `${item.item_type}:${item.resource_id}`).join(", ")}`,
      422,
    );
  }
  const items = persistedItems.map((item) => {
    const content = contentByItem.get(item.quality_lifecycle_item_id);
    return {
      item_type: item.item_type,
      resource_id: item.resource_id,
      resource_version: item.resource_version,
      title: content.title,
      source_anchor: item.source_anchor,
      content: content.content_format === "ROBOT"
        ? { ...(content.content_json || {}), script: content.content_text }
        : content.content_json || content.content_text,
    };
  });
  return {
    items,
    persistedItems,
    sourceHash: sha256(canonicalJson(items.map((item) => ({
      resource_id: item.resource_id,
      resource_version: item.resource_version,
      content_hash: contentByItem.get(
        persistedItems.find((source) => source.resource_id === item.resource_id)?.quality_lifecycle_item_id,
      )?.content_hash,
    })))),
  };
}

function assertStageBindings(stage, platform, items) {
  if (stage !== "TEST_SCRIPTS") return;
  const types = new Set(items.map((item) => item.item_type));
  const errors = [];
  if (!types.has("LOGICAL_STEP")) errors.push("Approved LOGICAL_STEP content is required");
  if (!types.has("TEST_CASE")) errors.push("Approved TEST_CASE content is required");
  if (!types.has("TEST_DATA")) errors.push("Approved TEST_DATA content is required");
  if (!types.has("AUTOMATION_PROJECT_PROFILE")) errors.push("Approved AUTOMATION_PROJECT_PROFILE is required");
  if (platform === "WINDOWS") {
    if (!types.has("APPLICATION")) errors.push("Approved APPLICATION profile is required for Windows");
    if (!types.has("LOCATOR_SET")) errors.push("Approved LOCATOR_SET is required for Windows");
  } else if (platform === "ANDROID") {
    if (!types.has("APPLICATION")) errors.push("Approved APPLICATION profile is required for Android");
    if (!types.has("DEVICE")) errors.push("Approved DEVICE profile is required for Android");
    if (!types.has("LOCATOR_SET")) errors.push("Approved LOCATOR_SET is required for Android");
  } else if (platform === "LINUX") {
    if (!types.has("TARGET_PROFILE")) errors.push("Approved TARGET_PROFILE is required for Linux");
  } else if (platform === "EMBEDDED") {
    if (!types.has("DEVICE")) errors.push("Approved DEVICE profile is required for embedded execution");
    if (!types.has("TARGET_PROFILE")) errors.push("Approved TARGET_PROFILE is required for embedded execution");
  }
  if (errors.length) throw typedError("SCRIPT_BINDINGS_INCOMPLETE", errors.join(" | "), 422);
}

function materializeProjectPackages(generation, sourceItems, expectedProjectMode = null) {
  const profiles = sourceItems.filter((item) => item.item_type === "AUTOMATION_PROJECT_PROFILE");
  if (profiles.length !== 1) {
    throw typedError(
      "AUTOMATION_PROJECT_PROFILE_REQUIRED",
      "Exactly one approved AUTOMATION_PROJECT_PROFILE is required for script generation",
      422,
    );
  }
  const profileItem = profiles[0];
  const profile = profileItem.content || {};
  const projectMode = String(profile.project_mode || "").toUpperCase();
  if (!["NEW", "EXISTING"].includes(projectMode)) {
    throw typedError("AUTOMATION_PROJECT_MODE_INVALID", "Automation project profile project_mode must be NEW or EXISTING", 422);
  }
  const policyMode = String(expectedProjectMode || "").toUpperCase();
  if (policyMode && policyMode !== projectMode) {
    throw typedError(
      "AUTOMATION_PROJECT_POLICY_MISMATCH",
      `Lifecycle project_mode ${policyMode} does not match approved profile ${projectMode}`,
      422,
    );
  }
  const existingFiles = new Map();
  for (const file of Array.isArray(profile.files) ? profile.files : []) {
    const filePath = validateProjectPath(file?.path);
    if (existingFiles.has(filePath.toLowerCase())) {
      throw typedError("AUTOMATION_PROJECT_PATH_DUPLICATE", `Duplicate project profile path: ${filePath}`, 422);
    }
    const content = String(file?.content || "");
    if (!content.trim()) {
      throw typedError("AUTOMATION_PROJECT_FILE_CONTENT_REQUIRED", `Project profile file ${filePath} requires immutable content`, 422);
    }
    existingFiles.set(filePath.toLowerCase(), { path: filePath, content });
  }
  if (projectMode === "EXISTING" && !existingFiles.size) {
    throw typedError("AUTOMATION_PROJECT_FILES_REQUIRED", "EXISTING automation projects require a non-empty file inventory", 422);
  }

  return {
    ...generation,
    items: generation.items.map((item) => {
      if (item.item_type !== "TEST_SCRIPT") return item;
      const content = { ...(item.content || {}) };
      const requestedMode = String(content.project_mode || "").toUpperCase();
      if (requestedMode !== projectMode) {
        throw typedError(
          "AUTOMATION_PROJECT_MODE_MISMATCH",
          `Generated script project_mode ${requestedMode || "<empty>"} does not match approved profile ${projectMode}`,
          422,
        );
      }
      const suitePath = validateProjectPath(content.suite_path || content.filename, new Set([".robot"]));
      const operation = String(content.operation || "").toUpperCase();
      if (!["CREATE", "UPDATE"].includes(operation) || (projectMode === "NEW" && operation !== "CREATE")) {
        throw typedError("AUTOMATION_PROJECT_OPERATION_INVALID", `Invalid ${operation || "<empty>"} operation for ${projectMode} project`, 422);
      }
      if (projectMode === "EXISTING" && operation === "UPDATE" && !existingFiles.has(suitePath.toLowerCase())) {
        throw typedError("AUTOMATION_PROJECT_UPDATE_TARGET_MISSING", `UPDATE target is absent from project profile: ${suitePath}`, 422);
      }
      const outputFiles = [];
      const seen = new Set([suitePath.toLowerCase()]);
      for (const generatedFile of Array.isArray(content.resource_files) ? content.resource_files : []) {
        const filePath = validateProjectPath(generatedFile?.path);
        if (seen.has(filePath.toLowerCase())) {
          throw typedError("AUTOMATION_PROJECT_PATH_DUPLICATE", `Duplicate generated package path: ${filePath}`, 422);
        }
        const fileOperation = String(generatedFile?.operation || "CREATE").toUpperCase();
        if (!["CREATE", "UPDATE"].includes(fileOperation)) {
          throw typedError("AUTOMATION_PROJECT_OPERATION_INVALID", `Invalid operation for ${filePath}`, 422);
        }
        if (fileOperation === "UPDATE" && !existingFiles.has(filePath.toLowerCase())) {
          throw typedError("AUTOMATION_PROJECT_UPDATE_TARGET_MISSING", `UPDATE target is absent from project profile: ${filePath}`, 422);
        }
        seen.add(filePath.toLowerCase());
        outputFiles.push({
          path: filePath,
          content: String(generatedFile.content || ""),
          source: `AI_${fileOperation}`,
          operation: fileOperation,
        });
      }
      for (const reusedPath of Array.isArray(content.reused_file_paths) ? content.reused_file_paths : []) {
        const filePath = validateProjectPath(reusedPath);
        const existing = existingFiles.get(filePath.toLowerCase());
        if (!existing) throw typedError("AUTOMATION_PROJECT_REUSE_TARGET_MISSING", `REUSE target is absent from project profile: ${filePath}`, 422);
        if (seen.has(filePath.toLowerCase())) throw typedError("AUTOMATION_PROJECT_PATH_DUPLICATE", `Duplicate generated package path: ${filePath}`, 422);
        seen.add(filePath.toLowerCase());
        outputFiles.push({ ...existing, source: "AUTOMATION_PROJECT_PROFILE", operation: "REUSE" });
      }
      if (outputFiles.length + 1 > 128) {
        throw typedError("AUTOMATION_PROJECT_FILE_LIMIT_EXCEEDED", "Generated package contains more than 128 files", 422);
      }
      const packageBytes = Buffer.byteLength(String(content.script || content.content || ""), "utf8")
        + outputFiles.reduce((total, file) => total + Buffer.byteLength(file.content, "utf8"), 0);
      if (packageBytes > 225_280) {
        throw typedError("AUTOMATION_PROJECT_SIZE_LIMIT_EXCEEDED", `Generated package is ${packageBytes} bytes; maximum is 225280`, 422);
      }
      return {
        ...item,
        content: {
          ...content,
          filename: suitePath,
          suite_path: suitePath,
          project_mode: projectMode,
          operation,
          automation_project_profile_reference: profileItem.resource_id,
          resource_files: outputFiles,
        },
      };
    }),
  };
}

function validateProjectPath(value, allowedExtensions = new Set([".robot", ".resource", ".py", ".json", ".yaml", ".yml", ".txt", ".csv", ".xml"])) {
  const normalized = String(value || "");
  if (!normalized || normalized.length > 512 || normalized.includes("\\") || normalized.startsWith("/") || normalized.startsWith("~")) {
    throw typedError("AUTOMATION_PROJECT_PATH_INVALID", `Unsafe automation project path: ${normalized || "<empty>"}`, 422);
  }
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || !/^[A-Za-z0-9._@+-]{1,128}$/.test(part))) {
    throw typedError("AUTOMATION_PROJECT_PATH_INVALID", `Unsafe automation project path: ${normalized}`, 422);
  }
  const extension = require("path").posix.extname(normalized).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    throw typedError("AUTOMATION_PROJECT_FILE_TYPE_INVALID", `Unsupported automation project file: ${normalized}`, 422);
  }
  return normalized;
}

async function fetchStoredDocument(lifecycle) {
  const base = storageServiceUrl();
  const response = await axios.get(
    `${base}/storage/internal/files/${encodeURIComponent(lifecycle.source_document_file_id)}/content`,
    {
      responseType: "arraybuffer",
      headers: { authorization: `Bearer ${getInternalApiToken()}` },
      timeout: 120_000,
      maxContentLength: 25 * 1024 * 1024,
      maxBodyLength: 25 * 1024 * 1024,
    },
  );
  const bytes = Buffer.from(response.data);
  const configured = lifecycle.generation_policy || {};
  return {
    filename: filenameFromDisposition(response.headers["content-disposition"])
      || configured.source_document_filename
      || `document-${lifecycle.source_document_file_id}`,
    content_type: response.headers["content-type"]
      || configured.source_document_content_type
      || "application/octet-stream",
    content_base64: bytes.toString("base64"),
    sha256: sha256(bytes),
    size_bytes: bytes.length,
  };
}

async function callDocumentExtraction(document, lifecycle) {
  const response = await axios.post(
    `${aiEngineUrl()}/v1/quality_documents/extract`,
    document,
    {
      headers: {
        authorization: `Bearer ${getInternalApiToken()}`,
        "content-type": "application/json",
        "x-correlation-id": lifecycle.quality_lifecycle_id,
      },
      timeout: 180_000,
      maxContentLength: 36 * 1024 * 1024,
      maxBodyLength: 36 * 1024 * 1024,
    },
  );
  return response.data;
}

async function callQualityGeneration(payload, lifecycle) {
  try {
    const response = await axios.post(
      `${aiEngineUrl()}/v1/quality_generation/generate`,
      payload,
      {
        headers: {
          authorization: `Bearer ${getInternalApiToken()}`,
          "content-type": "application/json",
          "x-correlation-id": lifecycle.quality_lifecycle_id,
        },
        timeout: 600_000,
        maxContentLength: 32 * 1024 * 1024,
        maxBodyLength: 32 * 1024 * 1024,
      },
    );
    return response.data;
  } catch (error) {
    const detail = error.response?.data?.detail;
    throw typedError(
      detail?.code || "QUALITY_GENERATION_FAILED",
      detail?.message || (Array.isArray(detail?.errors) ? detail.errors.join(" | ") : error.message),
      error.response?.status || 502,
    );
  }
}

function aiEngineUrl() {
  const value = String(process.env.AI_ENGINE_URL || "http://127.0.0.1:8099").replace(/\/$/, "");
  if (!/^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]|[A-Za-z0-9.-]+)(?::\d{1,5})?$/i.test(value)) {
    throw typedError("AI_ENGINE_URL_INVALID", "AI_ENGINE_URL must be an absolute HTTP(S) service endpoint without a path", 500);
  }
  return value;
}

function storageServiceUrl() {
  const value = String(process.env.STORAGE_SERVICE_URL || "http://127.0.0.1:8092").replace(/\/$/, "");
  if (!/^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]|[A-Za-z0-9.-]+)(?::\d{1,5})?$/i.test(value)) {
    throw typedError("STORAGE_SERVICE_URL_INVALID", "STORAGE_SERVICE_URL must be an absolute HTTP(S) service endpoint without a path", 500);
  }
  return value;
}

function filenameFromDisposition(value) {
  if (!value) return null;
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf) return decodeURIComponent(utf[1].replace(/["']/g, ""));
  const basic = /filename="?([^";]+)"?/i.exec(value);
  return basic ? basic[1] : null;
}

module.exports = {
  STAGE_BY_STATUS,
  GENERATED_STATUS_BY_STAGE,
  SOURCE_TYPES_BY_STAGE,
  generateNextStage,
  validateGeneratedScripts,
  loadUploadedDocumentSource,
  loadApprovedSources,
  assertStageBindings,
  materializeProjectPackages,
  validateProjectPath,
  aiEngineUrl,
  storageServiceUrl,
};
