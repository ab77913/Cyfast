"use strict";

const { Op } = require("sequelize");

const db = require("../database/mysql/models");
const {
  TestScenario,
  Requirement,
  GeneratedTestCase,
  TestCase,
  TestSuite,
  TestScript,
  RequirementTestCase,
  Job,
} = db;
const { JOB_TYPES } = require("../constants/job-types");

const aiEngineClient = require("./ai-engine-client");
const testCaseGenerationFactory = require("../database/mysql/factories/test-case-generation-factory");
const { notifyUserFromPrincipal } = require("./async-user-notify");
const { publishTestCaseGeneration } = require("./test-case-generation-mq-publish");

const MAX_ADDITIONAL_INSTRUCTIONS_CHARS = 6000;
const MAX_SCENARIOS_PER_JOB = 50;
const AI_SUITE_NAME = "AI Generated Test Cases";
const PENDING_GENERATED_TEST_CASES_EXIST_MSG =
  "Pending generated test cases already exist. Please approve or reject them before generating again.";
const ACTIVE_TEST_CASES_EXIST_MSG =
  "Active test cases already exist for this project. Delete, reject, or create a regeneration/versioning flow before generating again.";

const ALLOWED_TEST_TYPES = new Set([
  "POSITIVE",
  "NEGATIVE",
  "VALIDATION",
  "BOUNDARY",
  "WORKFLOW",
  "ERROR_HANDLING",
  "DATA_VALIDATION",
  "REGRESSION",
]);

const ALLOWED_PRIORITIES = new Set(["critical", "high", "medium", "low"]);

function normalizeStoredAdditionalInstructions(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().slice(0, MAX_ADDITIONAL_INSTRUCTIONS_CHARS);
  return s.length ? s : null;
}

function aiEngineAdditionalInstructionsField(job) {
  const v = normalizeStoredAdditionalInstructions(job?.additional_instructions);
  return v ? { additional_instructions: v } : {};
}

function _uniquePositiveIds(arr) {
  if (!Array.isArray(arr)) return [];
  return [
    ...new Set(
      arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
}

function normalizeComparableName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function candidateDedupeKey(row) {
  const reqPart =
    row.requirement_id != null && Number.isFinite(Number(row.requirement_id))
      ? `rid:${Number(row.requirement_id)}`
      : row.requirement_no != null && String(row.requirement_no).trim()
        ? `rno:${normalizeComparableName(row.requirement_no)}`
        : "req:";
  const scenPart =
    row.test_scenario_id != null &&
    Number.isFinite(Number(row.test_scenario_id))
      ? `sid:${Number(row.test_scenario_id)}`
      : row.scenario_title != null && String(row.scenario_title).trim()
        ? `st:${normalizeComparableName(row.scenario_title)}`
        : "sc:";
  const namePart = normalizeComparableName(row.test_case_name);
  return `${reqPart}|${scenPart}|${namePart}`;
}

async function assertNoPendingGeneratedTestCases(projectId) {
  const pendingCount =
    await testCaseGenerationFactory.countPendingForProject(projectId);
  if (pendingCount > 0) {
    throw new Error(PENDING_GENERATED_TEST_CASES_EXIST_MSG);
  }
}

async function assertNoActiveTestCasesForGeneration(projectId) {
  const pid = Number(projectId);
  const [activeCount, approvedGeneratedCount] = await Promise.all([
    testCaseGenerationFactory.countActiveTestCasesForProject(pid),
    testCaseGenerationFactory.countApprovedGeneratedForProject(pid),
  ]);
  if (activeCount > 0 || approvedGeneratedCount > 0) {
    throw new Error(ACTIVE_TEST_CASES_EXIST_MSG);
  }
}

async function filterDuplicateCandidates(projectId, candidates) {
  const existing =
    await testCaseGenerationFactory.listPendingForDuplicateCheck(projectId);
  const seen = new Set(
    existing.map((row) =>
      candidateDedupeKey(row.toJSON ? row.toJSON() : row),
    ),
  );
  const out = [];
  for (const candidate of candidates) {
    const key = candidateDedupeKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

function normalizeTestSteps(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") return [raw];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p;
      return [{ detail: raw }];
    } catch {
      return [{ detail: raw }];
    }
  }
  return null;
}

function clampAutomationScore(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const r = Math.round(x);
  return Math.max(0, Math.min(100, r));
}

function isBrokenObjectCoercion(value) {
  return typeof value === "string" && value.trim() === "[object Object]";
}

function stringifyIfObject(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s.length || isBrokenObjectCoercion(s)) return null;
    return s;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stringifyTestDataForStorage(value) {
  if (value == null || value === "") return "{}";
  if (typeof value === "string") {
    const s = value.trim();
    if (!s.length || isBrokenObjectCoercion(s)) return "{}";
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function normalizeTestTypeToken(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function normalizePriorityToken(raw) {
  return String(raw || "").trim().toLowerCase();
}

function stepActionText(step) {
  if (step == null) return "";
  if (typeof step === "string") return step.trim();
  if (typeof step === "object") {
    for (const key of ["action", "step", "detail"]) {
      const value = step[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "";
}

function normalizeStoredTestSteps(raw) {
  if (raw == null) return { steps: null, error: "missing test_steps" };
  let stepsRaw;
  if (Array.isArray(raw)) stepsRaw = raw;
  else if (typeof raw === "object") stepsRaw = [raw];
  else if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return { steps: null, error: "missing test_steps" };
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) stepsRaw = parsed;
      else if (typeof parsed === "object") stepsRaw = [parsed];
      else return { steps: null, error: "invalid test_steps" };
    } catch {
      return { steps: null, error: "invalid test_steps" };
    }
  } else {
    return { steps: null, error: "invalid test_steps" };
  }
  if (!stepsRaw.length) return { steps: null, error: "missing test_steps" };
  const out = [];
  for (let i = 0; i < stepsRaw.length; i += 1) {
    const step = stepsRaw[i];
    const action = stepActionText(step);
    if (!action) return { steps: null, error: "test_steps missing action text" };
    if (step != null && typeof step === "object") {
      const next = { ...step, action };
      if (next.step_no == null) next.step_no = i + 1;
      out.push(next);
    } else {
      out.push({ step_no: i + 1, action });
    }
  }
  return { steps: out, error: null };
}

function normalizeStoredTags(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const tags = raw.map((tag) => String(tag).trim()).filter(Boolean);
  return tags.length ? tags : null;
}

function normalizeStoredExpectedResult(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const text = raw.trim();
    return text || null;
  }
  if (Array.isArray(raw)) {
    const parts = raw
      .map((item) => {
        if (typeof item === "string" && item.trim()) return item.trim();
        if (item != null) {
          try {
            return JSON.stringify(item);
          } catch {
            return String(item);
          }
        }
        return "";
      })
      .filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  }
  return fieldToText(raw);
}

function validateAiTestCaseRow(tc, trustedScenario) {
  const errors = [];
  const name = String(tc.test_case_name || tc.title || "").trim();
  if (!name) errors.push("missing test_case_name");
  const description = String(
    tc.test_case_description || tc.description || "",
  ).trim();
  if (!description) errors.push("missing test_case_description");
  const testType = normalizeTestTypeToken(tc.test_type || tc.type);
  if (!ALLOWED_TEST_TYPES.has(testType)) errors.push("missing or unsupported test_type");
  const priority = normalizePriorityToken(tc.priority);
  if (!ALLOWED_PRIORITIES.has(priority)) {
    errors.push("missing or unsupported priority");
  }
  if (!String(tc.preconditions || "").trim()) errors.push("missing preconditions");
  const { error: stepError } = normalizeStoredTestSteps(
    tc.test_steps != null ? tc.test_steps : tc.steps,
  );
  if (stepError) errors.push(stepError);
  if (
    normalizeStoredExpectedResult(
      tc.expected_result != null ? tc.expected_result : tc.expected_results,
    ) == null
  ) {
    errors.push("missing expected_result");
  }
  if (normalizeStoredTags(tc.tags) == null) errors.push("missing tags");
  if (clampAutomationScore(tc.automation_percentage) == null) {
    errors.push("missing or invalid automation_percentage");
  }
  const scenarioId = Number(tc.scenario_id ?? tc.test_scenario_id);
  if (!Number.isFinite(scenarioId) || scenarioId <= 0) {
    errors.push("missing or unknown scenario_id/test_scenario_id");
  } else if (!trustedScenario) {
    errors.push(`unknown test_scenario_id ${scenarioId}`);
  }
  return errors;
}

function trustedScenarioMap(scenarioRows) {
  const out = {};
  for (const row of scenarioRows || []) {
    const sid = Number(row.test_scenario_id);
    if (Number.isFinite(sid) && sid > 0) out[sid] = row;
  }
  return out;
}

function validateScenarioCoverage(selectedScenarioIds, candidates) {
  const expected = new Set(_uniquePositiveIds(selectedScenarioIds));
  const covered = new Set(
    candidates
      .map((row) => Number(row.test_scenario_id))
      .filter((sid) => Number.isFinite(sid) && sid > 0),
  );
  const missing = [...expected].filter((sid) => !covered.has(sid));
  if (!missing.length) return [];
  return [
    `Missing test cases for test_scenario_id(s): ${missing.join(", ")}`,
  ];
}

function formatTags(value) {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) {
    const joined = value
      .map((t) => String(t).trim())
      .filter(Boolean)
      .join(", ");
    return joined.length ? joined.slice(0, 255) : null;
  }
  if (typeof value === "object") {
    const s = stringifyIfObject(value);
    return s ? s.slice(0, 255) : null;
  }
  const s = String(value).trim();
  if (!s.length || isBrokenObjectCoercion(s)) return null;
  return s.slice(0, 255);
}

function formatSteps(value) {
  if (value == null || value === "") return null;
  const normalized = normalizeTestSteps(value);
  if (!normalized?.length) return null;
  return normalized
    .map((step, i) => {
      const n = i + 1;
      if (step == null) return `${n}.`;
      if (typeof step === "string") return `${n}. ${step}`;
      if (typeof step === "object") {
        const action = step.action || step.step || step.detail;
        const expected = step.expected || step.result;
        if (action && expected) return `${n}. ${action} → Expected: ${expected}`;
        if (action) return `${n}. ${action}`;
        try {
          return `${n}. ${JSON.stringify(step)}`;
        } catch {
          return `${n}. ${String(step)}`;
        }
      }
      return `${n}. ${String(step)}`;
    })
    .join("\n");
}

function fieldToText(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item != null && typeof item === "object") {
          if (typeof item.action === "string") return item.action;
          if (typeof item.detail === "string") return item.detail;
          try {
            return JSON.stringify(item);
          } catch {
            return String(item);
          }
        }
        return String(item);
      })
      .join("\n");
  }
  if (typeof value === "object") {
    if (typeof value.expected === "string") return value.expected;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function candidateSourcePayload(candidate) {
  const c = candidate?.toJSON ? candidate.toJSON() : candidate;
  const sp = c?.source_payload;
  if (sp == null) return {};
  if (typeof sp === "object") return sp;
  if (typeof sp === "string") {
    try {
      const parsed = JSON.parse(sp);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function resolveCandidateField(stored, fallback) {
  if (stored != null && stored !== "" && !isBrokenObjectCoercion(stored)) {
    return stored;
  }
  if (fallback != null && fallback !== "" && !isBrokenObjectCoercion(fallback)) {
    return fallback;
  }
  return null;
}

function buildApprovedTestCaseFields(candidate) {
  const c = candidate.toJSON ? candidate.toJSON() : candidate;
  const source = candidateSourcePayload(candidate);

  const rawTestData = resolveCandidateField(c.test_data, source.test_data);
  const rawSteps = resolveCandidateField(
    c.test_steps,
    source.test_steps ?? source.steps,
  );
  const rawPreconditions = resolveCandidateField(
    c.preconditions,
    source.preconditions,
  );
  const rawExpected = resolveCandidateField(
    c.expected_result,
    source.expected_result ?? source.expected_results,
  );
  const rawTags = resolveCandidateField(c.tags, source.tags);
  const shortDescription = resolveCandidateField(
    c.test_case_description,
    source.test_case_description ?? source.description,
  );

  const stepsText = formatSteps(rawSteps);
  let description =
    shortDescription != null && String(shortDescription).trim()
      ? String(shortDescription).trim()
      : null;
  if (stepsText) {
    description = description
      ? `${description}\n\nTest Steps:\n${stepsText}`
      : `Test Steps:\n${stepsText}`;
  }

  return {
    description,
    type: c.test_type,
    priority: c.priority,
    tags: formatTags(rawTags),
    pre_condition:
      fieldToText(rawPreconditions) ?? stringifyIfObject(rawPreconditions),
    test_data: stringifyIfObject(rawTestData),
    expected_result: fieldToText(rawExpected) ?? stringifyIfObject(rawExpected),
  };
}

function mapAiToTestCaseCandidates({
  jobId,
  projectId,
  organizationId,
  userId,
  testCasesRaw,
  trustedScenarios = {},
}) {
  const arr = Array.isArray(testCasesRaw) ? testCasesRaw : [];
  const out = [];
  const errors = [];
  for (let idx = 0; idx < arr.length; idx += 1) {
    const tc = arr[idx];
    const scenarioId = Number(tc.scenario_id ?? tc.test_scenario_id);
    const trusted = trustedScenarios[scenarioId];
    const rowErrors = validateAiTestCaseRow(tc, trusted);
    if (rowErrors.length) {
      errors.push(
        `row ${idx} (scenario_id=${Number.isFinite(scenarioId) ? scenarioId : "unknown"}): ${rowErrors.join(", ")}`,
      );
      continue;
    }

    const { steps } = normalizeStoredTestSteps(
      tc.test_steps != null ? tc.test_steps : tc.steps,
    );
    const requirementId =
      trusted?.requirement_id != null
        ? Number(trusted.requirement_id)
        : tc.requirement_id != null && Number.isFinite(Number(tc.requirement_id))
          ? Number(tc.requirement_id)
          : null;

    out.push({
      organization_id: Number(organizationId),
      project_id: Number(projectId),
      job_id: jobId,
      requirement_id: requirementId,
      requirement_no:
        trusted?.requirement_no != null
          ? String(trusted.requirement_no).slice(0, 100)
          : tc.requirement_no != null
            ? String(tc.requirement_no).slice(0, 100)
            : null,
      test_scenario_id: scenarioId,
      scenario_title:
        trusted?.scenario_title != null
          ? String(trusted.scenario_title).slice(0, 255)
          : tc.scenario_title != null
            ? String(tc.scenario_title).slice(0, 255)
            : null,
      test_case_no:
        tc.test_case_no != null ? String(tc.test_case_no).slice(0, 100) : null,
      test_case_name: String(tc.test_case_name || tc.title).trim().slice(0, 255),
      test_case_description: String(
        tc.test_case_description || tc.description,
      ).trim(),
      test_type: normalizeTestTypeToken(tc.test_type || tc.type),
      priority: normalizePriorityToken(tc.priority),
      preconditions: String(tc.preconditions).trim(),
      test_steps: steps,
      test_data: stringifyTestDataForStorage(tc.test_data),
      expected_result: normalizeStoredExpectedResult(
        tc.expected_result != null ? tc.expected_result : tc.expected_results,
      ),
      tags: formatTags(tc.tags),
      automation_percentage: clampAutomationScore(tc.automation_percentage),
      approval_status: "PENDING",
      source_payload: tc,
      created_by: userId || "system",
    });
  }
  return { candidates: out, errors };
}

async function resolveActiveScenariosForProject(projectId, { allActive, scenarioIds }) {
  const baseWhere = {
    project_id: Number(projectId),
    deleted_date: null,
  };
  if (!allActive) {
    const ids = _uniquePositiveIds(scenarioIds);
    if (!ids.length) {
      throw new Error(
        "Select at least one active test scenario or enable all active scenarios.",
      );
    }
    baseWhere.test_scenario_id = { [Op.in]: ids };
  }

  const rows = await TestScenario.findAll({
    where: baseWhere,
    include: [
      {
        model: Requirement,
        as: "requirement",
        required: false,
        attributes: ["requirement_id", "requirement_no", "title", "description", "version"],
      },
    ],
    order: [["test_scenario_id", "ASC"]],
  });

  if (!rows.length) {
    throw new Error("No eligible active test scenarios found for this selection.");
  }
  if (rows.length > MAX_SCENARIOS_PER_JOB) {
    throw new Error(
      `At most ${MAX_SCENARIOS_PER_JOB} test scenarios per generation job.`,
    );
  }
  return rows;
}

function scenarioBodiesForAi(scenarioRows) {
  return scenarioRows.map((s) => ({
    test_scenario_id: Number(s.test_scenario_id),
    scenario_no: s.scenario_no,
    scenario_type: s.scenario_type,
    scenario_title: s.title,
    objective: s.objective,
    priority: s.priority,
    preconditions: s.preconditions,
    test_steps: s.test_steps,
    test_data: s.test_data,
    expected_results: s.expected_results,
    requirement_id: s.requirement_id != null ? Number(s.requirement_id) : null,
    requirement_no: s.requirement?.requirement_no || null,
    requirement_version: s.requirement_version,
  }));
}

function requirementBodiesForAi(scenarioRows) {
  const seen = new Map();
  for (const s of scenarioRows) {
    const rid = Number(s.requirement_id);
    if (!Number.isFinite(rid) || seen.has(rid)) continue;
    const req = s.requirement;
    seen.set(rid, {
      requirement_id: rid,
      requirement_no: req?.requirement_no || s.requirement?.requirement_no,
      title: req?.title,
      description: req?.description || "",
      version: req?.version || s.requirement_version,
    });
  }
  return [...seen.values()];
}

function recipientPrincipalForJob(notifyUserIdOverride, jobCreatedBy) {
  const o = notifyUserIdOverride != null ? String(notifyUserIdOverride).trim() : "";
  if (o) return o;
  const c = jobCreatedBy != null ? String(jobCreatedBy).trim() : "";
  return c || "system";
}

async function notifyTestCaseGenerationOutcome(
  recipientPrincipal,
  { jobId, ok, title, detail, createdBy },
) {
  await notifyUserFromPrincipal(recipientPrincipal, {
    category: "test_case_generation",
    title,
    body: detail,
    referenceType: "test_case_generation_job",
    referenceId: String(jobId),
    createdBy: createdBy || "system",
  });
}

async function runGenerateQueuedJob(jobId, notifyUserIdOverride) {
  const job = await testCaseGenerationFactory.getJobById(jobId);
  if (!job) return;
  if (job.job_type !== JOB_TYPES.TEST_CASE_GENERATION) {
    console.warn(
      `runGenerateTestCaseJob: skip job ${jobId} job_type=${job.job_type}`,
    );
    return;
  }
  if (job.status !== "QUEUED") {
    console.warn(
      `runGenerateTestCaseJob: skip job ${jobId} status=${job.status}`,
    );
    return;
  }

  await testCaseGenerationFactory.updateJob(jobId, {
    status: "PROCESSING",
    modified_date: new Date(),
  });

  const recipientPrincipal = recipientPrincipalForJob(
    notifyUserIdOverride,
    job.created_by,
  );
  const createdByAudit = job.created_by || "system";

  try {
    await assertNoPendingGeneratedTestCases(Number(job.project_id));
    await assertNoActiveTestCasesForGeneration(Number(job.project_id));

    const scenarioRows = await TestScenario.findAll({
      where: {
        test_scenario_id: {
          [Op.in]: _uniquePositiveIds(job.test_case_scenario_ids || []),
        },
        project_id: Number(job.project_id),
        deleted_date: null,
      },
      include: [
        {
          model: Requirement,
          as: "requirement",
          required: false,
          attributes: ["requirement_id", "requirement_no", "title", "description", "version"],
        },
      ],
    });

    const scenariosPayload = scenarioBodiesForAi(scenarioRows);
    if (!scenariosPayload.length) {
      throw new Error(
        "Job is missing resolvable active test scenarios (scenarios may have been deleted).",
      );
    }

    const requirementsPayload = requirementBodiesForAi(scenarioRows);

    const aiResp = await aiEngineClient.generateTestCasesFromScenarios({
      project_id: Number(job.project_id),
      organization_id:
        job.organization_id != null ? Number(job.organization_id) : null,
      scenarios: scenariosPayload,
      requirements: requirementsPayload,
      ...aiEngineAdditionalInstructionsField(job),
    });

    if (!aiResp) {
      throw new Error(
        "AI engine is not configured (set AI_ENGINE_URL) or request failed.",
      );
    }
    if (aiResp.status !== "ok") {
      const msg =
        aiResp.message ||
        aiResp.detail ||
        "Test case generation failed (AI engine).";
      throw new Error(msg);
    }

    const candidatesResult = mapAiToTestCaseCandidates({
      jobId,
      projectId: job.project_id,
      organizationId: job.organization_id,
      userId: createdByAudit,
      testCasesRaw: aiResp.test_cases,
      trustedScenarios: trustedScenarioMap(scenariosPayload),
    });
    const coverageErrors = validateScenarioCoverage(
      scenariosPayload.map((s) => s.test_scenario_id),
      candidatesResult.candidates,
    );
    const validationErrors = [
      ...candidatesResult.errors,
      ...coverageErrors,
    ];
    if (validationErrors.length) {
      throw new Error(validationErrors.join("; "));
    }

    const candidates = candidatesResult.candidates;
    if (!candidates.length) {
      throw new Error("Model returned no valid test cases.");
    }

    const uniqueCandidates = await filterDuplicateCandidates(
      Number(job.project_id),
      candidates,
    );
    if (!uniqueCandidates.length) {
      throw new Error(PENDING_GENERATED_TEST_CASES_EXIST_MSG);
    }

    await testCaseGenerationFactory.bulkCreateCandidates(uniqueCandidates);
    await testCaseGenerationFactory.updateJob(jobId, {
      status: "COMPLETED",
      raw_llm_response: JSON.stringify(aiResp).slice(0, 65000),
      modified_date: new Date(),
      error_message: null,
    });

    await notifyTestCaseGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: true,
      title: "Test case drafts ready",
      detail: `Job #${jobId} finished. Review drafts under Pending approval.`,
      createdBy: createdByAudit,
    });
  } catch (e) {
    const msg = e.message || String(e);
    await testCaseGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: msg,
      modified_date: new Date(),
    });
    await notifyTestCaseGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: false,
      title: "Test case generation failed",
      detail: msg,
      createdBy: createdByAudit,
    });
  }
}

async function processTestCaseGenerationQueueMessage(envelope) {
  if (!envelope || envelope.job_id == null || !envelope.kind) return;
  const jid = Number(envelope.job_id);
  if (!Number.isFinite(jid)) return;
  if (envelope.kind === "generate") {
    await runGenerateQueuedJob(jid, envelope.notify_user_id ?? null);
  } else if (envelope.kind === "regenerate") {
    const cid = Array.isArray(envelope.candidate_ids)
      ? _uniquePositiveIds(envelope.candidate_ids)
      : [];
    await runRegenerateQueuedJob(
      jid,
      envelope.notify_user_id ?? null,
      cid.length ? cid : null,
    );
  }
}

async function maybeDeleteFullyDiscardedTestCaseJob(jobId) {
  const id = Number(jobId);
  if (!Number.isFinite(id) || id <= 0) return;
  const job = await Job.findOne({
    where: { job_id: id, job_type: JOB_TYPES.TEST_CASE_GENERATION },
  });
  if (!job) return;
  const active = await GeneratedTestCase.count({
    where: {
      job_id: id,
      approval_status: { [Op.in]: ["PENDING", "APPROVED"] },
      deleted_date: null,
    },
  });
  if (active > 0) return;
  const anyCandidates = await GeneratedTestCase.count({
    where: { job_id: id },
  });
  if (anyCandidates === 0) return;
  await Job.destroy({ where: { job_id: id } });
}

function priorTestCaseFromCandidate(candidate) {
  const row = candidate.toJSON ? candidate.toJSON() : candidate;
  return {
    test_scenario_id: Number(row.test_scenario_id),
    scenario_id: Number(row.test_scenario_id),
    scenario_title: row.scenario_title,
    test_case_no: row.test_case_no,
    test_case_name: row.test_case_name,
    test_case_description: row.test_case_description,
    test_type: row.test_type,
    priority: row.priority,
    preconditions: row.preconditions,
    test_steps: row.test_steps,
    test_data: row.test_data,
    expected_result: row.expected_result,
    tags: row.tags,
    automation_percentage: row.automation_percentage,
    requirement_id: row.requirement_id,
    requirement_no: row.requirement_no,
  };
}

async function scenarioRowsForRegeneration(scenarioIds, projectId) {
  const ids = _uniquePositiveIds(scenarioIds);
  if (!ids.length) {
    throw new Error("Cannot resolve test scenarios for regeneration.");
  }
  const rows = await TestScenario.findAll({
    where: {
      test_scenario_id: { [Op.in]: ids },
      project_id: Number(projectId),
      deleted_date: null,
    },
    include: [
      {
        model: Requirement,
        as: "requirement",
        required: false,
        attributes: ["requirement_id", "requirement_no", "title", "description", "version"],
      },
    ],
    order: [["test_scenario_id", "ASC"]],
  });
  if (!rows.length) {
    throw new Error(
      "Cannot resolve test scenario context for regeneration (scenarios may have been deleted).",
    );
  }
  const got = new Set(rows.map((r) => Number(r.test_scenario_id)));
  const missing = ids.filter((id) => !got.has(id));
  if (missing.length) {
    throw new Error(
      `Missing active test scenarios for regeneration: ${missing.join(", ")}`,
    );
  }
  return rows;
}

async function runRegenerateQueuedJob(
  jobId,
  notifyUserIdOverride,
  scopedCandidateIds = null,
) {
  const job = await testCaseGenerationFactory.getJobById(jobId);
  if (!job) return;
  if (job.job_type !== JOB_TYPES.TEST_CASE_GENERATION) {
    console.warn(
      `runRegenerateTestCaseJob: skip job ${jobId} job_type=${job.job_type}`,
    );
    return;
  }
  if (job.status !== "QUEUED") {
    console.warn(
      `runRegenerateTestCaseJob: skip job ${jobId} status=${job.status}`,
    );
    return;
  }

  await testCaseGenerationFactory.updateJob(jobId, {
    status: "PROCESSING",
    modified_date: new Date(),
  });

  const recipientPrincipal = recipientPrincipalForJob(
    notifyUserIdOverride,
    job.created_by,
  );
  const createdByAudit = job.created_by || "system";
  const userFeedbackRaw = String(job.user_feedback || "").trim();
  if (!userFeedbackRaw) {
    const msg = "user_feedback missing on queued job.";
    await testCaseGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: msg,
      modified_date: new Date(),
    });
    await notifyTestCaseGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: false,
      title: "Regeneration failed",
      detail: msg,
      createdBy: createdByAudit,
    });
    return;
  }

  const scopeIds =
    Array.isArray(scopedCandidateIds) && scopedCandidateIds.length
      ? _uniquePositiveIds(scopedCandidateIds)
      : [];

  try {
    const pendingWhere =
      scopeIds.length > 0
        ? {
            job_id: jobId,
            approval_status: "PENDING",
            deleted_date: null,
            generated_test_case_id: { [Op.in]: scopeIds },
          }
        : { job_id: jobId, approval_status: "PENDING", deleted_date: null };

    const pending = await GeneratedTestCase.findAll({
      where: pendingWhere,
    });

    if (scopeIds.length > 0) {
      const got = new Set(
        pending.map((p) => Number(p.generated_test_case_id)),
      );
      const missing = scopeIds.filter((id) => !got.has(id));
      if (missing.length) {
        throw new Error(
          `Regeneration scoped ids missing or not pending on job ${jobId}: ${missing.join(", ")}`,
        );
      }
    }

    if (!pending.length) {
      throw new Error(
        scopeIds.length > 0
          ? "No matching pending drafts to regenerate."
          : "No pending drafts to regenerate.",
      );
    }

    const scenarioIds = [
      ...new Set(
        pending
          .map((p) => Number(p.test_scenario_id))
          .filter((sid) => Number.isFinite(sid) && sid > 0),
      ),
    ];
    const scenarioRows = await scenarioRowsForRegeneration(
      scenarioIds,
      job.project_id,
    );
    const scenariosPayload = scenarioBodiesForAi(scenarioRows);
    const requirementsPayload = requirementBodiesForAi(scenarioRows);
    const prior = pending.map((p) => priorTestCaseFromCandidate(p));

    const scopedPrefix =
      scopeIds.length > 0
        ? `[Regenerate exactly ${prior.length} draft(s) supplied in prior_test_cases; return test_cases covering the same test_scenario_id values.]\n\n`
        : "";

    const aiResp = await aiEngineClient.regenerateTestCasesFromScenarios({
      project_id: Number(job.project_id),
      organization_id:
        job.organization_id != null ? Number(job.organization_id) : null,
      scenarios: scenariosPayload,
      requirements: requirementsPayload,
      prior_test_cases: prior,
      user_feedback: scopedPrefix + userFeedbackRaw,
      ...aiEngineAdditionalInstructionsField(job),
    });

    if (!aiResp) {
      throw new Error(
        "AI engine is not configured (set AI_ENGINE_URL) or request failed.",
      );
    }
    if (aiResp.status !== "ok") {
      const msg =
        aiResp.message ||
        aiResp.detail ||
        "Regeneration failed (AI engine).";
      throw new Error(msg);
    }

    const idsToRemove = pending.map((p) => p.generated_test_case_id);
    await GeneratedTestCase.destroy({
      where: {
        generated_test_case_id: { [Op.in]: idsToRemove },
        approval_status: "PENDING",
      },
    });

    const candidatesResult = mapAiToTestCaseCandidates({
      jobId,
      projectId: job.project_id,
      organizationId: job.organization_id,
      userId: createdByAudit,
      testCasesRaw: aiResp.test_cases,
      trustedScenarios: trustedScenarioMap(scenariosPayload),
    });
    const coverageErrors = validateScenarioCoverage(
      scenariosPayload.map((s) => s.test_scenario_id),
      candidatesResult.candidates,
    );
    const validationErrors = [
      ...candidatesResult.errors,
      ...coverageErrors,
    ];
    if (validationErrors.length) {
      throw new Error(validationErrors.join("; "));
    }
    if (!candidatesResult.candidates.length) {
      throw new Error("Model returned no valid test cases.");
    }

    await testCaseGenerationFactory.bulkCreateCandidates(
      candidatesResult.candidates,
    );
    await testCaseGenerationFactory.updateJob(jobId, {
      status: "COMPLETED",
      raw_llm_response: JSON.stringify(aiResp).slice(0, 65000),
      modified_date: new Date(),
      error_message: null,
    });

    await notifyTestCaseGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: true,
      title: "Test case drafts regenerated",
      detail:
        scopeIds.length > 0
          ? `Job #${jobId}: ${pending.length} selected draft(s) regenerated.`
          : `Job #${jobId} regeneration finished.`,
      createdBy: createdByAudit,
    });
  } catch (e) {
    const msg = e.message || String(e);
    await testCaseGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: msg,
      modified_date: new Date(),
    });
    await notifyTestCaseGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: false,
      title: "Regeneration failed",
      detail: msg,
      createdBy: createdByAudit,
    });
  }
}

async function regenerateTestCaseJob({
  jobId,
  userFeedback,
  notifyUserId,
  additionalInstructionsStored,
  regenerateCandidateIds,
}) {
  const job = await testCaseGenerationFactory.getJobById(jobId);
  if (!job) throw new Error("Job not found");
  if (job.job_type !== JOB_TYPES.TEST_CASE_GENERATION) {
    throw new Error("Not a test case generation job.");
  }
  if (job.status === "PROCESSING") throw new Error("Job still processing.");
  if (job.status === "QUEUED") throw new Error("Job is already queued.");

  let publishCandidateIds;
  if (regenerateCandidateIds?.length) {
    const ids = _uniquePositiveIds(regenerateCandidateIds);
    const n = await GeneratedTestCase.count({
      where: {
        job_id: jobId,
        approval_status: "PENDING",
        deleted_date: null,
        generated_test_case_id: { [Op.in]: ids },
      },
    });
    if (n !== ids.length) {
      throw new Error(
        "candidate_ids must reference only pending drafts for this job.",
      );
    }
    publishCandidateIds = ids;
  }

  const patches = {
    status: "QUEUED",
    user_feedback: userFeedback,
    modified_date: new Date(),
    error_message: null,
  };
  if (additionalInstructionsStored !== undefined) {
    patches.additional_instructions =
      normalizeStoredAdditionalInstructions(additionalInstructionsStored);
  }
  await testCaseGenerationFactory.updateJob(jobId, patches);

  const uid = notifyUserId != null ? notifyUserId : job.created_by;

  try {
    await publishTestCaseGeneration({
      kind: "regenerate",
      job_id: jobId,
      notify_user_id: uid || "system",
      ...(publishCandidateIds?.length
        ? { candidate_ids: publishCandidateIds }
        : {}),
    });
  } catch (e) {
    await notifyUserFromPrincipal(uid || "system", {
      category: "test_case_generation",
      title: `Job ${jobId} regeneration could not be queued`,
      body: `Queue publish failed: ${e.message || String(e)}`,
      referenceType: "test_case_generation_job",
      referenceId: String(jobId),
      createdBy: uid || "system",
    });
    await testCaseGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: `Queue publish failed: ${e.message || String(e)}`,
      modified_date: new Date(),
    });
    throw e;
  }

  await notifyUserFromPrincipal(uid || "system", {
    category: "test_case_generation",
    title: `Job ${jobId} regeneration queued`,
    body: "Test case regeneration has been queued and will start shortly.",
    referenceType: "test_case_generation_job",
    referenceId: String(jobId),
    createdBy: uid || "system",
  });

  return testCaseGenerationFactory.getJobById(jobId);
}

async function regeneratePendingTestCaseCandidatesWithFeedback({
  projectId,
  candidateIds,
  userFeedback,
  notifyUserId,
  additionalInstructionsStored,
}) {
  const ids = _uniquePositiveIds(candidateIds);
  if (!ids.length) throw new Error("candidate_ids must be a non-empty array.");
  const fb = String(userFeedback || "").trim();
  if (!fb) throw new Error("user_feedback is required");

  const rows = await GeneratedTestCase.findAll({
    where: {
      generated_test_case_id: { [Op.in]: ids },
      approval_status: "PENDING",
      deleted_date: null,
    },
    include: [
      {
        model: Job,
        as: "job",
        required: true,
        where: {
          project_id: Number(projectId),
          job_type: JOB_TYPES.TEST_CASE_GENERATION,
        },
      },
    ],
  });
  const found = new Set(rows.map((r) => Number(r.generated_test_case_id)));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    throw new Error(
      `Drafts missing, not pending, or wrong project: ${missing.join(", ")}`,
    );
  }
  const jobIdsSet = new Set(rows.map((r) => Number(r.job_id)));
  if (jobIdsSet.size !== 1) {
    throw new Error(
      "Select drafts from a single generation job (same AI batch only).",
    );
  }
  const onlyJobId = [...jobIdsSet][0];

  return regenerateTestCaseJob({
    jobId: onlyJobId,
    userFeedback: fb,
    notifyUserId,
    regenerateCandidateIds: ids,
    ...(additionalInstructionsStored !== undefined && {
      additionalInstructionsStored,
    }),
  });
}

async function bulkDiscardTestCaseCandidates({
  projectId,
  candidateIds,
  userId,
  reason,
}) {
  const r = reason || "Bulk discarded (not promoted)";
  return bulkRejectTestCaseCandidates({
    projectId,
    candidateIds,
    userId,
    reason: r,
  });
}

async function bulkDiscardPendingTestCaseJobs({ projectId, jobIds, reason }) {
  const jids = _uniquePositiveIds(jobIds);
  if (!jids.length) {
    throw new Error("job_ids must be a non-empty array.");
  }

  const jobs = await Job.findAll({
    where: {
      job_id: { [Op.in]: jids },
      project_id: Number(projectId),
      job_type: JOB_TYPES.TEST_CASE_GENERATION,
    },
  });
  const got = new Set(jobs.map((j) => Number(j.job_id)));
  const missing = jids.filter((id) => !got.has(id));
  if (missing.length) {
    throw new Error(
      `Invalid test case job ids for this project or not found: ${missing.join(", ")}`,
    );
  }

  const [affected] = await GeneratedTestCase.update(
    {
      approval_status: "REJECTED",
      rejected_reason: reason || "Batch discarded (entire job pending set)",
      modified_by: "system",
      modified_date: new Date(),
    },
    {
      where: {
        job_id: { [Op.in]: jids },
        approval_status: "PENDING",
        deleted_date: null,
      },
    },
  );

  await Promise.all(jids.map((jid) => maybeDeleteFullyDiscardedTestCaseJob(jid)));

  return { job_ids: jids, candidates_affected: affected };
}

async function createTestCaseGenerationJob({
  projectId,
  organizationId,
  allActive,
  scenarioIds,
  userId,
  additionalInstructions,
}) {
  await assertNoPendingGeneratedTestCases(Number(projectId));
  await assertNoActiveTestCasesForGeneration(Number(projectId));

  const scenarioRows = await resolveActiveScenariosForProject(projectId, {
    allActive: allActive !== false,
    scenarioIds: Array.isArray(scenarioIds) ? scenarioIds : [],
  });
  const scenarioIdsOrdered = scenarioRows.map((s) => Number(s.test_scenario_id));

  const jobRowPayload = {
    project_id: projectId,
    organization_id: organizationId,
    job_type: JOB_TYPES.TEST_CASE_GENERATION,
    status: "QUEUED",
    requirement_categories: [],
    source_document_ids: [],
    test_case_scenario_ids: scenarioIdsOrdered,
    created_by: userId || "system",
  };
  if (additionalInstructions !== undefined) {
    jobRowPayload.additional_instructions =
      normalizeStoredAdditionalInstructions(additionalInstructions);
  }

  const jobRow = await testCaseGenerationFactory.createJob(jobRowPayload);

  try {
    await publishTestCaseGeneration({
      kind: "generate",
      job_id: jobRow.job_id,
      notify_user_id: userId || "system",
    });
  } catch (e) {
    await notifyUserFromPrincipal(userId || "system", {
      category: "test_case_generation",
      title: `Job ${jobRow.job_id} could not be queued`,
      body: `Queue publish failed: ${e.message || String(e)}`,
      referenceType: "test_case_generation_job",
      referenceId: String(jobRow.job_id),
      createdBy: userId || "system",
    });
    await testCaseGenerationFactory.updateJob(jobRow.job_id, {
      status: "FAILED",
      error_message: `Queue publish failed: ${e.message || String(e)}`,
      modified_date: new Date(),
    });
    throw e;
  }

  await notifyUserFromPrincipal(userId || "system", {
    category: "test_case_generation",
    title: `Job ${jobRow.job_id} queued`,
    body: "Test case generation has been queued and will start shortly.",
    referenceType: "test_case_generation_job",
    referenceId: String(jobRow.job_id),
    createdBy: userId || "system",
  });

  return testCaseGenerationFactory.getJobById(jobRow.job_id);
}

async function getTestCaseGenerationJob(jobId) {
  const job = await testCaseGenerationFactory.getJobById(jobId);
  if (!job || job.job_type !== JOB_TYPES.TEST_CASE_GENERATION) return null;
  const generatedCount = await testCaseGenerationFactory.countCandidatesForJob(
    jobId,
  );
  const pendingCount = await testCaseGenerationFactory.countCandidatesForJob(
    jobId,
    "PENDING",
  );
  const json = job.toJSON ? job.toJSON() : job;
  return {
    ...json,
    generated_count: generatedCount,
    pending_count: pendingCount,
  };
}

async function listPending(projectId, page, size) {
  const payload = await testCaseGenerationFactory.listPendingCandidatesForProject(
    projectId,
    page,
    size,
  );
  const pendingJobIds =
    await testCaseGenerationFactory.listPendingJobIdsForProject(projectId);
  return { ...payload, pending_job_ids: pendingJobIds };
}

async function ensureAiGeneratedContainer(
  projectId,
  organizationId,
  userId,
  transaction,
) {
  let suite = await TestSuite.findOne({
    where: {
      project_id: Number(projectId),
      name: AI_SUITE_NAME,
      deleted_date: null,
    },
    transaction,
  });
  if (!suite) {
    suite = await TestSuite.create(
      {
        organization_id: Number(organizationId),
        project_id: Number(projectId),
        name: AI_SUITE_NAME,
        test_framework: "MANUAL",
        created_by: userId || "system",
      },
      { transaction },
    );
  }

  let script = await TestScript.findOne({
    where: {
      project_id: Number(projectId),
      test_suite_id: suite.test_suite_id,
      name: AI_SUITE_NAME,
      deleted_date: null,
    },
    transaction,
  });
  if (!script) {
    script = await TestScript.create(
      {
        organization_id: Number(organizationId),
        project_id: Number(projectId),
        test_suite_id: suite.test_suite_id,
        name: AI_SUITE_NAME,
        description: "Placeholder container for AI-generated manual test cases",
        created_by: userId || "system",
      },
      { transaction },
    );
  }

  return {
    test_suite_id: suite.test_suite_id,
    test_script_id: script.test_script_id,
  };
}

async function allocateTestCaseNo(projectId, preferredNo, transaction) {
  let base = preferredNo && String(preferredNo).trim();
  if (!base) base = `TC-P${projectId}`;
  base = base.slice(0, 40);
  for (let i = 0; i < 3000; i += 1) {
    const suffix = i === 0 ? "" : `-${i}`;
    const trimmed = `${base}${suffix}`.slice(0, 50);
    const n = await TestCase.count({
      where: { project_id: projectId, test_case_no: trimmed, deleted_date: null },
      transaction,
    });
    if (!n) return trimmed;
  }
  throw new Error("Could not allocate unique test_case_no.");
}

async function approveTestCaseCandidate(candidateId, userId) {
  const candidate = await testCaseGenerationFactory.getCandidateById(candidateId);
  if (!candidate) throw new Error("Generated test case not found");
  if (candidate.approval_status !== "PENDING") {
    throw new Error("Generated test case is not pending approval.");
  }

  let promotedTestCaseId = null;

  await db.sequelize.transaction(async (t) => {
    const { test_suite_id: testSuiteId, test_script_id: testScriptId } =
      await ensureAiGeneratedContainer(
        candidate.project_id,
        candidate.organization_id,
        userId,
        t,
      );

    const testCaseNo = await allocateTestCaseNo(
      Number(candidate.project_id),
      candidate.test_case_no,
      t,
    );

    const approvedFields = buildApprovedTestCaseFields(candidate);

    const tcRow = await TestCase.create(
      {
        organization_id: Number(candidate.organization_id),
        project_id: Number(candidate.project_id),
        test_source_id: null,
        test_suite_id: testSuiteId,
        test_script_id: testScriptId,
        test_case_no: testCaseNo,
        name: candidate.test_case_name,
        version: "1.0",
        description: approvedFields.description,
        type: approvedFields.type,
        priority: approvedFields.priority,
        tags: approvedFields.tags,
        pre_condition: approvedFields.pre_condition,
        test_data: approvedFields.test_data,
        expected_result: approvedFields.expected_result,
        status: "NEW",
        created_by: userId || "system",
      },
      { transaction: t },
    );

    promotedTestCaseId = tcRow.test_case_id;

    const requirementId =
      candidate.requirement_id != null
        ? Number(candidate.requirement_id)
        : candidate.test_scenario?.requirement_id != null
          ? Number(candidate.test_scenario.requirement_id)
          : null;

    if (requirementId) {
      const req =
        candidate.requirement ||
        (await Requirement.findByPk(requirementId, { transaction: t }));
      await RequirementTestCase.create(
        {
          project_id: Number(candidate.project_id),
          requirement_id: requirementId,
          requirement_version: req?.version || null,
          test_case_id: tcRow.test_case_id,
          test_case_version: tcRow.version || "1.0",
          created_by: userId || "system",
        },
        { transaction: t },
      );
    }

    await GeneratedTestCase.update(
      {
        approval_status: "APPROVED",
        promoted_test_case_id: tcRow.test_case_id,
        approved_by: userId || "system",
        approved_date: new Date(),
      },
      {
        where: { generated_test_case_id: candidate.generated_test_case_id },
        transaction: t,
      },
    );
  });

  const updated = await testCaseGenerationFactory.getCandidateById(candidateId);
  return {
    ...(updated?.toJSON ? updated.toJSON() : updated),
    test_case_id: promotedTestCaseId,
  };
}

async function rejectTestCaseCandidate(candidateId, userId, reason) {
  const candidate = await testCaseGenerationFactory.getCandidateById(candidateId);
  if (!candidate) throw new Error("Generated test case not found");
  if (candidate.approval_status !== "PENDING") {
    throw new Error("Generated test case is not pending approval.");
  }

  await testCaseGenerationFactory.updateCandidate(candidateId, {
    approval_status: "REJECTED",
    rejected_reason: reason || null,
    modified_by: userId || "system",
    modified_date: new Date(),
  });

  const jid = candidate.job?.job_id ?? candidate.job_id;
  await maybeDeleteFullyDiscardedTestCaseJob(jid);

  return testCaseGenerationFactory.getCandidateById(candidateId);
}

async function bulkApproveTestCaseCandidates({ projectId, candidateIds, userId }) {
  const ids = _uniquePositiveIds(candidateIds);
  if (!ids.length) throw new Error("candidate_ids must be a non-empty array.");

  const rows = await GeneratedTestCase.findAll({
    where: {
      generated_test_case_id: { [Op.in]: ids },
      project_id: Number(projectId),
      approval_status: "PENDING",
      deleted_date: null,
    },
  });
  const found = new Set(rows.map((r) => Number(r.generated_test_case_id)));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    throw new Error(
      `Some generated test cases are missing, not pending, or not in this project: ${missing.join(", ")}`,
    );
  }

  const results = [];
  for (const c of rows) {
    const id = c.generated_test_case_id;
    try {
      const row = await approveTestCaseCandidate(id, userId);
      results.push({ generated_test_case_id: id, ok: true, test_case_id: row.test_case_id });
    } catch (e) {
      results.push({
        generated_test_case_id: id,
        ok: false,
        error: e.message || String(e),
      });
    }
  }
  return { results };
}

async function bulkRejectTestCaseCandidates({
  projectId,
  candidateIds,
  userId,
  reason,
}) {
  const ids = _uniquePositiveIds(candidateIds);
  if (!ids.length) throw new Error("candidate_ids must be a non-empty array.");

  const rows = await GeneratedTestCase.findAll({
    where: {
      generated_test_case_id: { [Op.in]: ids },
      project_id: Number(projectId),
      approval_status: "PENDING",
      deleted_date: null,
    },
  });
  const found = new Set(rows.map((r) => Number(r.generated_test_case_id)));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    throw new Error(
      `Some generated test cases are missing, not pending, or not in this project: ${missing.join(", ")}`,
    );
  }

  const results = [];
  for (const c of rows) {
    const id = c.generated_test_case_id;
    try {
      await rejectTestCaseCandidate(id, userId, reason);
      results.push({ generated_test_case_id: id, ok: true });
    } catch (e) {
      results.push({
        generated_test_case_id: id,
        ok: false,
        error: e.message || String(e),
      });
    }
  }
  return {
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

async function countActiveScenarios(projectId) {
  return TestScenario.count({
    where: {
      project_id: Number(projectId),
      deleted_date: null,
    },
  });
}

module.exports = {
  createTestCaseGenerationJob,
  getTestCaseGenerationJob,
  processTestCaseGenerationQueueMessage,
  regenerateTestCaseJob,
  regeneratePendingTestCaseCandidatesWithFeedback,
  listPending,
  approveTestCaseCandidate,
  rejectTestCaseCandidate,
  bulkApproveTestCaseCandidates,
  bulkRejectTestCaseCandidates,
  bulkDiscardTestCaseCandidates,
  bulkDiscardPendingTestCaseJobs,
  countActiveScenarios,
  PENDING_GENERATED_TEST_CASES_EXIST_MSG,
  ACTIVE_TEST_CASES_EXIST_MSG,
};
