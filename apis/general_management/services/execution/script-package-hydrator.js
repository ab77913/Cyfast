"use strict";

const path = require("path");
const {
  validatePackagePath,
  sha256,
  canonicalJson,
  typedError,
} = require("./execution-contract");

const HARD_PACKAGE_LIMIT_BYTES = 225_280;
const MAX_FILES = 128;
const MAX_DEPTH = 16;
const ALLOWED_EXTENSIONS = new Set([".robot", ".resource", ".py", ".json", ".yaml", ".yml", ".txt", ".csv", ".xml"]);
const LOCAL_IMPORT_RE = /^\s*(Resource|Variables|Library)\s{2,}([^#\r\n]+?)\s*$/gim;

async function hydrateScriptPackage({ organizationId, projectId, testScriptId, repository, maxPackageBytes = HARD_PACKAGE_LIMIT_BYTES }) {
  assertPositiveInteger(organizationId, "organizationId");
  assertPositiveInteger(projectId, "projectId");
  if (!testScriptId && testScriptId !== 0) throw typedError("TEST_SCRIPT_REQUIRED", "testScriptId is required", 400);
  if (!repository || typeof repository.loadScript !== "function") throw typedError("SCRIPT_REPOSITORY_REQUIRED", "repository.loadScript is required", 500);

  const script = await repository.loadScript({ organizationId, projectId, testScriptId });
  if (!script) throw typedError("TEST_SCRIPT_NOT_FOUND", "Test script was not found in the requested organization/project", 404);

  const rootPath = validatePackagePath(normalizeRootFilename(script.filename || script.name || `test-script-${testScriptId}.robot`));
  if (path.posix.extname(rootPath).toLowerCase() !== ".robot") {
    throw typedError("ROOT_SUITE_MUST_BE_ROBOT", "The selected executable test script must be a .robot suite", 422);
  }

  const suppliedFiles = [
    { path: rootPath, content: normalizeContent(script.content), source: "ROOT_SCRIPT" },
    ...normalizeResources(script.resources || script.files || script.package_files || []),
  ];
  if (suppliedFiles.length > MAX_FILES) throw typedError("PACKAGE_FILE_LIMIT_EXCEEDED", `Package contains more than ${MAX_FILES} files`, 422);

  const byPath = new Map();
  for (const file of suppliedFiles) {
    const safePath = validatePackagePath(file.path);
    const extension = path.posix.extname(safePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) throw typedError("UNSUPPORTED_PACKAGE_FILE", `Unsupported package file type: ${safePath}`, 422);
    if (byPath.has(safePath.toLowerCase())) throw typedError("DUPLICATE_PACKAGE_PATH", `Duplicate package path: ${safePath}`, 422);
    const content = normalizeContent(file.content);
    validateTextFile(safePath, content);
    byPath.set(safePath.toLowerCase(), { path: safePath, content, source: file.source || "RESOURCE" });
  }

  const visited = new Set();
  validateImports(rootPath, byPath, visited, 0);

  const configuredLimit = Math.min(Math.max(Number(maxPackageBytes) || HARD_PACKAGE_LIMIT_BYTES, 1), HARD_PACKAGE_LIMIT_BYTES);
  let packageBytes = 0;
  const files = [...byPath.values()]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => {
      const bytes = Buffer.from(file.content, "utf8");
      packageBytes += bytes.length;
      return {
        path: file.path,
        content_base64: bytes.toString("base64"),
        sha256: sha256(bytes),
        size: bytes.length,
        source: file.source,
      };
    });
  if (packageBytes > configuredLimit) {
    throw typedError("PACKAGE_SIZE_LIMIT_EXCEEDED", `Package is ${packageBytes} bytes; maximum is ${configuredLimit}`, 422);
  }

  const root = byPath.get(rootPath.toLowerCase());
  const meaningfulActions = countMeaningful(root.content, ACTION_KEYWORDS);
  const meaningfulAssertions = countMeaningful(root.content, ASSERTION_KEYWORDS);
  if (meaningfulActions < 1) throw typedError("NO_MEANINGFUL_ACTION", "Selected script has no meaningful UI/protocol action", 422);
  if (meaningfulAssertions < 1) throw typedError("NO_MEANINGFUL_ASSERTION", "Selected script has no meaningful assertion", 422);

  const manifest = {
    schema_version: "1.0",
    organization_id: organizationId,
    project_id: projectId,
    test_script_id: String(testScriptId),
    test_script_version: script.version || script.revision || null,
    suite_path: rootPath,
    package_bytes: packageBytes,
    file_count: files.length,
    meaningful_actions: meaningfulActions,
    meaningful_assertions: meaningfulAssertions,
    files: files.map(({ path: filePath, sha256: hash, size, source }) => ({ path: filePath, sha256: hash, size, source })),
  };

  return {
    suite_path: rootPath,
    files,
    manifest,
    package_sha256: sha256(canonicalJson(manifest)),
  };
}

function validateImports(filePath, byPath, visited, depth) {
  if (depth > MAX_DEPTH) throw typedError("IMPORT_DEPTH_EXCEEDED", `Import depth exceeds ${MAX_DEPTH}: ${filePath}`, 422);
  const key = filePath.toLowerCase();
  if (visited.has(key)) return;
  visited.add(key);
  const file = byPath.get(key);
  if (!file) throw typedError("PACKAGE_FILE_MISSING", `Package file is missing: ${filePath}`, 422);
  if (![".robot", ".resource"].includes(path.posix.extname(file.path).toLowerCase())) return;

  for (const imported of parseLocalImports(file.content)) {
    if (/\$\{|%\{/.test(imported.value)) {
      throw typedError("DYNAMIC_IMPORT_REJECTED", `Dynamic ${imported.type} path is not permitted in ${file.path}: ${imported.value}`, 422);
    }
    const candidate = imported.value.replace(/^['"]|['"]$/g, "").trim();
    if (imported.type.toLowerCase() === "library" && !/\.(?:py|resource|robot)$/i.test(candidate)) continue;
    const base = path.posix.dirname(file.path);
    const resolved = validatePackagePath(path.posix.join(base === "." ? "" : base, candidate));
    if (!byPath.has(resolved.toLowerCase())) {
      throw typedError("UNRESOLVED_PACKAGE_IMPORT", `Missing ${imported.type} referenced by ${file.path}: ${resolved}`, 422);
    }
    validateImports(resolved, byPath, visited, depth + 1);
  }
}

function parseLocalImports(content) {
  const imports = [];
  for (const match of String(content).matchAll(LOCAL_IMPORT_RE)) {
    const firstCell = match[2].trim().split(/\s{2,}/)[0];
    imports.push({ type: match[1], value: firstCell });
  }
  return imports;
}

function validateTextFile(filePath, content) {
  if (content.includes("\u0000")) throw typedError("BINARY_PACKAGE_FILE_REJECTED", `Package file contains binary data: ${filePath}`, 422);
  if (/(?:^|[\s"'])(?:\/home\/|\/tmp\/|\/var\/tmp\/)/i.test(content)) {
    throw typedError("LINUX_HOST_PATH_REJECTED", `Unresolved Linux host path found in ${filePath}`, 422);
  }
  if (/(?:^|[\s"'])[A-Za-z]:\\/i.test(content) || /\\\\[^\\\s]+\\/i.test(content)) {
    throw typedError("WINDOWS_HOST_PATH_REJECTED", `Unresolved Windows host path found in ${filePath}`, 422);
  }
  if (/\bdesiredCapabilities\b/i.test(content)) throw typedError("LEGACY_APPIUM_CAPABILITY_REJECTED", `Legacy desiredCapabilities found in ${filePath}`, 422);
  for (const capability of ["automationName", "app", "deviceName", "newCommandTimeout"]) {
    const unprefixed = new RegExp(`["']${capability}["']\\s*:`, "i");
    const prefixed = new RegExp(`["']appium:${capability}["']\\s*:`, "i");
    if (unprefixed.test(content) && !prefixed.test(content)) {
      throw typedError("LEGACY_APPIUM_CAPABILITY_REJECTED", `Unprefixed Appium capability ${capability} found in ${filePath}`, 422);
    }
  }
  if (/^\s*(?:#\s*)?(?:TODO|FIXME)\b/im || /<locator>|replace_me|your_locator|placeholder_locator/i.test(content)) {
    if (/^\s*(?:#\s*)?(?:TODO|FIXME)\b/im.test(content) || /<locator>|replace_me|your_locator|placeholder_locator/i.test(content)) {
      throw typedError("PLACEHOLDER_AUTOMATION_REJECTED", `TODO or placeholder automation remains in ${filePath}`, 422);
    }
  }
  if (/^\s*\$\{(?:PASSWORD|TOKEN|SECRET|API_KEY)\}\s{2,}(?!%\{|\$\{)[^#\s].+$/im.test(content)) {
    throw typedError("PLAINTEXT_CREDENTIAL_REJECTED", `Possible plaintext credential assignment found in ${filePath}`, 422);
  }
  if (/^\s*(?:Run|Run Process|Start Process)\s{2,}(?:powershell|cmd(?:\.exe)?|bash|sh)\b/im.test(content)) {
    throw typedError("ARBITRARY_SHELL_REJECTED", `Arbitrary shell execution found in ${filePath}`, 422);
  }
}

function createSequelizeScriptRepository(db) {
  if (!db || typeof db !== "object") throw typedError("DATABASE_REQUIRED", "Sequelize database registry is required", 500);
  return {
    async loadScript({ organizationId, projectId, testScriptId }) {
      const model = findModel(db, ["TestScript", "test_script", "TestScripts"]);
      if (!model) throw typedError("TEST_SCRIPT_MODEL_UNAVAILABLE", "Existing TestScript model is unavailable", 500);
      const attributes = model.rawAttributes || {};
      const idField = firstField(attributes, ["test_script_id", "id"]);
      const organizationField = firstField(attributes, ["organization_id", "organizationId"]);
      const projectField = firstField(attributes, ["project_id", "projectId"]);
      if (!idField || !organizationField || !projectField) {
        throw typedError("SCRIPT_MODEL_TENANCY_UNAVAILABLE", "TestScript model must expose id, organization, and project fields", 500);
      }
      const record = await model.findOne({
        where: {
          [idField]: testScriptId,
          [organizationField]: organizationId,
          [projectField]: projectId,
          ...(attributes.deleted_date ? { deleted_date: null } : {}),
        },
      });
      if (!record) return null;
      const value = typeof record.toJSON === "function" ? record.toJSON() : record;
      const contentField = firstPresent(value, ["script_content", "content", "source_code", "test_script_content", "script"]);
      if (!contentField) throw typedError("SCRIPT_CONTENT_UNAVAILABLE", "Selected TestScript does not expose executable content", 422);
      const metadata = firstPresent(value, ["metadata", "configuration", "package_manifest"]) || {};
      return {
        id: value[idField],
        filename: firstPresent(value, ["file_name", "filename", "test_script_name", "name"]) || `test-script-${value[idField]}.robot`,
        content: contentField,
        version: firstPresent(value, ["version", "revision", "script_version"]),
        resources: normalizeResources(
          firstPresent(value, ["resource_files", "package_files", "files"]) || metadata.resource_files || metadata.package_files || [],
        ),
      };
    },
  };
}

function findModel(db, names) {
  for (const name of names) if (db[name]) return db[name];
  return Object.values(db).find((candidate) => {
    const table = String(candidate?.tableName || candidate?.getTableName?.() || "").toLowerCase();
    return table === "test_script" || table === "test_scripts";
  });
}

function firstField(attributes, candidates) {
  return candidates.find((name) => Object.prototype.hasOwnProperty.call(attributes, name));
}

function firstPresent(value, candidates) {
  for (const name of candidates) {
    if (value[name] !== undefined && value[name] !== null && value[name] !== "") return value[name];
  }
  return null;
}

function normalizeResources(resources) {
  if (!Array.isArray(resources)) return [];
  return resources.map((resource, index) => {
    if (typeof resource === "string") {
      throw typedError("RESOURCE_CONTENT_REQUIRED", `Resource ${index + 1} must include path and content`, 422);
    }
    return {
      path: resource.path || resource.file_path || resource.filename,
      content: resource.content ?? resource.source_code ?? resource.text,
      source: resource.source || "RESOURCE",
    };
  });
}

function normalizeContent(value) {
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (typeof value !== "string") throw typedError("SCRIPT_CONTENT_REQUIRED", "Package file content must be UTF-8 text", 422);
  return value.replace(/^\uFEFF/, "");
}

function normalizeRootFilename(value) {
  const normalized = String(value).replace(/\\/g, "/");
  return path.posix.extname(normalized) ? normalized : `${normalized}.robot`;
}

function countMeaningful(content, keywords) {
  return String(content).split(/\r?\n/).filter((line) => {
    const normalized = line.trim().toLowerCase();
    return normalized && !normalized.startsWith("#") && keywords.some((keyword) => normalized.includes(keyword));
  }).length;
}

const ACTION_KEYWORDS = [
  "click element", "click button", "input text", "press keys", "select from list", "set value", "invoke element",
  "open application", "launch application", "tap", "send frame", "write uart", "start measurement",
];
const ASSERTION_KEYWORDS = [
  "element should", "page should", "should be equal", "should contain", "should be true", "wait until element is visible",
  "response should", "verify signal", "assert",
];

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(Number(value)) || Number(value) <= 0) throw typedError("INVALID_SCOPE", `${name} must be a positive integer`, 400);
}

module.exports = {
  HARD_PACKAGE_LIMIT_BYTES,
  MAX_FILES,
  hydrateScriptPackage,
  createSequelizeScriptRepository,
  parseLocalImports,
  validateTextFile,
};
