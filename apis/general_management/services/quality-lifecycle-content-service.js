"use strict";

const crypto = require("crypto");
const db = require("../database/mysql/models");
const quality = require("./quality-lifecycle-service");
const {
  canonicalJson,
  sha256,
  redactSecrets,
  typedError,
} = require("./execution/execution-contract");
const { parsePagination } = require("./execution/execution-store");

const CONTENT_FORMATS = Object.freeze(["JSON", "TEXT", "ROBOT", "PROFILE", "LOCATORS", "REPORT"]);

function contentModel() {
  if (!db.QualityLifecycleContent) {
    throw typedError("QUALITY_CONTENT_MODEL_UNAVAILABLE", "QualityLifecycleContent model is unavailable", 500);
  }
  return db.QualityLifecycleContent;
}

async function createContentItem(lifecycleId, input, actor, options = {}) {
  const normalized = normalizeContentInput(input);
  const contentHash = sha256(
    normalized.content_format === "JSON"
      ? canonicalJson(normalized.content_json)
      : normalized.content_text,
  );
  const item = await quality.addItem(lifecycleId, {
    item_type: normalized.item_type,
    resource_id: normalized.resource_id,
    resource_version: normalized.resource_version,
    source_item_id: normalized.source_item_id,
    source_anchor: normalized.source_anchor,
    generation_metadata: {
      ...normalized.generation_metadata,
      content_format: normalized.content_format,
    },
    approval_status: normalized.approval_status,
    content_hash: contentHash,
  }, actor);

  try {
    const content = await contentModel().create({
      quality_lifecycle_content_id: crypto.randomUUID().replace(/-/g, ""),
      quality_lifecycle_id: lifecycleId,
      quality_lifecycle_item_id: item.quality_lifecycle_item_id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      item_type: normalized.item_type,
      resource_id: normalized.resource_id,
      resource_version: normalized.resource_version,
      title: normalized.title,
      content_format: normalized.content_format,
      content_text: normalized.content_text,
      content_json: normalized.content_json,
      content_hash: contentHash,
      source_hash: normalized.source_hash,
      schema_version: normalized.schema_version,
      model_id: normalized.model_id,
      prompt_version: normalized.prompt_version,
      generation_status: normalized.generation_status,
      validation_result: normalized.validation_result,
      created_by: actor.userId || actor.actorId || "quality-content",
    });
    return { item, content };
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      const existing = await contentModel().findOne({
        where: {
          quality_lifecycle_item_id: item.quality_lifecycle_item_id,
          organization_id: actor.organizationId,
          project_id: actor.projectId,
          deleted_date: null,
        },
      });
      if (existing && existing.content_hash === contentHash) return { item, content: existing };
      throw typedError("QUALITY_CONTENT_VERSION_EXISTS", "This lifecycle content version already exists with different content", 409);
    }
    throw error;
  }
}

async function createGeneratedItems(lifecycleId, generation, sourceMap, actor) {
  const output = [];
  for (const generated of generation.items || []) {
    const sources = Array.isArray(generated.source_resource_ids) ? generated.source_resource_ids : [];
    const primarySource = sources.map((id) => sourceMap.get(String(id))).find(Boolean);
    if (!primarySource) {
      throw typedError(
        "GENERATION_SOURCE_LINK_MISSING",
        `Generated item ${generated.resource_id} has no persisted source item`,
        422,
      );
    }
    const content = generated.content || {};
    const script = generated.item_type === "TEST_SCRIPT"
      ? String(content.script || content.content || "")
      : null;
    output.push(await createContentItem(lifecycleId, {
      item_type: generated.item_type,
      resource_id: generated.resource_id,
      resource_version: generated.resource_version || "1",
      title: generated.title,
      source_item_id: primarySource.quality_lifecycle_item_id,
      source_anchor: {
        ...(generated.source_anchor || {}),
        source_resource_ids: sources,
        source_item_ids: sources.map((id) => sourceMap.get(String(id))?.quality_lifecycle_item_id).filter(Boolean),
      },
      generation_metadata: {
        origin: "AI",
        model_id: generation.model,
        prompt_version: generation.prompt_version,
        warnings: generation.warnings || [],
      },
      approval_status: "PENDING",
      content_format: script !== null ? "ROBOT" : "JSON",
      content_text: script,
      content_json: script !== null ? content : content,
      source_hash: sha256(canonicalJson(sources)),
      schema_version: "1.0",
      model_id: generation.model,
      prompt_version: generation.prompt_version,
      generation_status: "GENERATED",
      validation_result: { valid: true, stage: generation.stage },
    }, actor));
  }
  return output;
}

async function getContent(contentId, actor) {
  return contentModel().findOne({
    where: {
      quality_lifecycle_content_id: contentId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
}

async function getContentByItem(itemId, actor) {
  return contentModel().findOne({
    where: {
      quality_lifecycle_item_id: itemId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
}

async function listContents(lifecycleId, actor, query = {}) {
  const lifecycle = await quality.getLifecycle(lifecycleId, actor);
  if (!lifecycle) throw typedError("QUALITY_LIFECYCLE_NOT_FOUND", "Quality lifecycle was not found", 404);
  const pagination = parsePagination(query, { defaultPageSize: 100 });
  const where = {
    quality_lifecycle_id: lifecycleId,
    organization_id: actor.organizationId,
    project_id: actor.projectId,
    deleted_date: null,
  };
  if (query.item_type) where.item_type = String(query.item_type).toUpperCase();
  if (query.generation_status) where.generation_status = String(query.generation_status).toUpperCase();
  const result = await contentModel().findAndCountAll({
    where,
    order: [["created_date", "ASC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  const total = Number(result.count || 0);
  return {
    items: result.rows,
    pagination: {
      page: pagination.page,
      page_size: pagination.pageSize,
      total,
      total_pages: Math.max(Math.ceil(total / pagination.pageSize), 1),
    },
  };
}

async function markValidated(itemId, actor, result) {
  const content = await getContentByItem(itemId, actor);
  if (!content) throw typedError("QUALITY_CONTENT_NOT_FOUND", "Lifecycle content was not found", 404);
  await content.update({
    generation_status: result.valid ? "VALIDATED" : "REJECTED",
    validation_result: redactSecrets(result),
    modified_by: actor.userId || actor.actorId,
  });
  return content;
}

function normalizeContentInput(input = {}) {
  const format = String(input.content_format || (typeof input.content === "string" ? "TEXT" : "JSON")).toUpperCase();
  if (!CONTENT_FORMATS.includes(format)) throw typedError("QUALITY_CONTENT_FORMAT_INVALID", `Unsupported content format: ${format}`, 422);
  const rawContent = ["TEXT", "ROBOT"].includes(format)
    ? (input.content_text !== undefined ? input.content_text : input.content)
    : (input.content !== undefined ? input.content : input.content_json);
  let contentText = null;
  let contentJson = null;
  if (["TEXT", "ROBOT"].includes(format)) {
    contentText = String(rawContent || "");
    if (!contentText.trim() || Buffer.byteLength(contentText, "utf8") > 1_000_000) {
      throw typedError("QUALITY_CONTENT_TEXT_INVALID", "Text content is required and must not exceed 1,000,000 bytes", 422);
    }
    contentJson = input.content_json && typeof input.content_json === "object"
      ? redactSecrets(input.content_json)
      : null;
  } else {
    if (!rawContent || typeof rawContent !== "object") {
      throw typedError("QUALITY_CONTENT_JSON_INVALID", "JSON content must be a non-empty object or array", 422);
    }
    contentJson = redactSecrets(rawContent);
    if (Buffer.byteLength(canonicalJson(contentJson), "utf8") > 1_000_000) {
      throw typedError("QUALITY_CONTENT_JSON_TOO_LARGE", "JSON content must not exceed 1,000,000 bytes", 422);
    }
  }
  const itemType = String(input.item_type || "").toUpperCase();
  if (itemType === "AUTOMATION_PROJECT_PROFILE") {
    contentJson = validateAutomationProjectProfile(contentJson);
  }
  const resourceId = String(input.resource_id || "").trim();
  const resourceVersion = String(input.resource_version || "1").trim();
  const title = String(input.title || resourceId).trim();
  const sourceHash = String(input.source_hash || sha256(canonicalJson(input.source_anchor || {}))).toLowerCase();
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(resourceId)) throw typedError("QUALITY_CONTENT_RESOURCE_ID_INVALID", "resource_id is invalid", 422);
  if (!/^[A-Za-z0-9._:+-]{1,128}$/.test(resourceVersion)) throw typedError("QUALITY_CONTENT_VERSION_INVALID", "resource_version is invalid", 422);
  if (title.length < 1 || title.length > 512) throw typedError("QUALITY_CONTENT_TITLE_INVALID", "title must contain 1-512 characters", 422);
  if (!/^[a-f0-9]{64}$/.test(sourceHash)) throw typedError("QUALITY_CONTENT_SOURCE_HASH_INVALID", "source_hash must be SHA-256", 422);
  return {
    item_type: itemType,
    resource_id: resourceId,
    resource_version: resourceVersion,
    title,
    source_item_id: input.source_item_id || null,
    source_anchor: redactSecrets(input.source_anchor || {}),
    generation_metadata: redactSecrets(input.generation_metadata || { origin: "USER" }),
    approval_status: String(input.approval_status || "PENDING").toUpperCase(),
    content_format: format,
    content_text: contentText,
    content_json: contentJson,
    source_hash: sourceHash,
    schema_version: String(input.schema_version || "1.0"),
    model_id: input.model_id ? String(input.model_id) : null,
    prompt_version: input.prompt_version ? String(input.prompt_version) : null,
    generation_status: String(input.generation_status || "GENERATED").toUpperCase(),
    validation_result: redactSecrets(input.validation_result || { valid: false, pending: true }),
  };
}

function validateAutomationProjectProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw typedError("AUTOMATION_PROJECT_PROFILE_INVALID", "Automation project profile must be a JSON object", 422);
  }
  const projectMode = String(value.project_mode || "").toUpperCase();
  if (!["NEW", "EXISTING"].includes(projectMode)) {
    throw typedError("AUTOMATION_PROJECT_MODE_INVALID", "project_mode must be NEW or EXISTING", 422);
  }
  const framework = String(value.framework || "ROBOT_FRAMEWORK").toUpperCase();
  if (framework !== "ROBOT_FRAMEWORK") {
    throw typedError("AUTOMATION_PROJECT_FRAMEWORK_INVALID", "Only ROBOT_FRAMEWORK project profiles are supported", 422);
  }
  const files = Array.isArray(value.files) ? value.files : [];
  if (files.length > 128 || (projectMode === "EXISTING" && !files.length)) {
    throw typedError(
      "AUTOMATION_PROJECT_FILES_INVALID",
      projectMode === "EXISTING" ? "EXISTING projects require 1-128 immutable files" : "Project profiles may contain at most 128 files",
      422,
    );
  }
  const seen = new Set();
  let totalBytes = 0;
  const normalizedFiles = files.map((file, index) => {
    const filePath = validateAutomationProjectPath(file?.path);
    if (seen.has(filePath.toLowerCase())) {
      throw typedError("AUTOMATION_PROJECT_PATH_DUPLICATE", `Duplicate project path: ${filePath}`, 422);
    }
    seen.add(filePath.toLowerCase());
    const content = String(file?.content || "");
    if (!content.trim() || Buffer.byteLength(content, "utf8") > 225_280) {
      throw typedError("AUTOMATION_PROJECT_FILE_CONTENT_INVALID", `Project file ${index + 1} requires bounded UTF-8 content`, 422);
    }
    const contentHash = sha256(content);
    totalBytes += Buffer.byteLength(content, "utf8");
    if (file.sha256 && String(file.sha256).toLowerCase() !== contentHash) {
      throw typedError("AUTOMATION_PROJECT_FILE_HASH_MISMATCH", `Project file checksum mismatch: ${filePath}`, 422);
    }
    return {
      path: filePath,
      kind: String(file.kind || "PROJECT_FILE").toUpperCase(),
      content,
      sha256: contentHash,
    };
  });
  if (totalBytes > 225_280) {
    throw typedError("AUTOMATION_PROJECT_SIZE_LIMIT_EXCEEDED", `Project snapshot is ${totalBytes} bytes; maximum is 225280`, 422);
  }
  return {
    project_mode: projectMode,
    framework,
    root_path: ".",
    files: normalizedFiles,
    imports: Array.isArray(value.imports) ? value.imports.map(String) : [],
    libraries: Array.isArray(value.libraries) ? value.libraries.map(String) : [],
    keywords: Array.isArray(value.keywords) ? value.keywords.map(String) : [],
    conventions: redactSecrets(value.conventions || {}),
  };
}

function validateAutomationProjectPath(value) {
  const normalized = String(value || "");
  if (!normalized || normalized.length > 512 || normalized.includes("\\") || normalized.startsWith("/") || normalized.startsWith("~")) {
    throw typedError("AUTOMATION_PROJECT_PATH_INVALID", `Unsafe automation project path: ${normalized || "<empty>"}`, 422);
  }
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || !/^[A-Za-z0-9._@+-]{1,128}$/.test(part))) {
    throw typedError("AUTOMATION_PROJECT_PATH_INVALID", `Unsafe automation project path: ${normalized}`, 422);
  }
  if (!/[.](?:robot|resource|py|json|ya?ml|txt|csv|xml)$/i.test(normalized)) {
    throw typedError("AUTOMATION_PROJECT_FILE_TYPE_INVALID", `Unsupported automation project file: ${normalized}`, 422);
  }
  return normalized;
}

module.exports = {
  CONTENT_FORMATS,
  createContentItem,
  createGeneratedItems,
  getContent,
  getContentByItem,
  listContents,
  markValidated,
  normalizeContentInput,
  validateAutomationProjectProfile,
};
