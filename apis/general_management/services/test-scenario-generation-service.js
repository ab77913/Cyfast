"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");

const db = require("../database/mysql/models");
const { Requirement, GeneratedTestScenario, Job, TestScenario } = db;
const { JOB_TYPES } = require("../constants/job-types");

const aiEngineClient = require("./ai-engine-client");
const scenarioGenerationFactory = require("../database/mysql/factories/test-scenario-generation-factory");
const { notifyUserFromPrincipal } = require("./async-user-notify");
const { publishTestScenarioGeneration } = require("./test-scenario-generation-mq-publish");

/** Max chars persisted with the job (hints for the LLM). */
const MAX_ADDITIONAL_INSTRUCTIONS_CHARS = 6000;
const MAX_REQUIREMENTS_PER_JOB = 50;

const ALLOWED_SCENARIO_TYPES = new Set([
  "FUNCTIONAL",
  "NEGATIVE",
  "BOUNDARY",
  "ERROR_HANDLING",
  "WORKFLOW",
  "VALIDATION",
  "INTEGRATION",
  "SECURITY",
  "USABILITY",
]);

const SAFETY_OPTION_KEYS = new Set([
  "safety_validation",
  "fault_handling",
  "data_integrity",
  "audit_logging",
  "regulatory",
]);

const SCENARIO_TYPE_FALLBACK_MAP = {
  USABILITY: ["FUNCTIONAL", "WORKFLOW"],
  PERFORMANCE: ["BOUNDARY", "FUNCTIONAL"],
  DATA_INTEGRITY: ["VALIDATION", "FUNCTIONAL"],
  SECURITY: ["NEGATIVE", "VALIDATION", "FUNCTIONAL"],
  INTEGRATION: ["WORKFLOW", "FUNCTIONAL"],
  REGRESSION: ["FUNCTIONAL"],
  POSITIVE: ["FUNCTIONAL"],
};

function normalizeScenarioTypeToken(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function normalizeScenarioTypeAgainstSelection(
  raw,
  selectedTypes,
  safetyOptions = {},
) {
  const selected = new Set(
    (Array.isArray(selectedTypes) ? selectedTypes : [])
      .map((t) => normalizeScenarioTypeToken(t))
      .filter((t) => ALLOWED_SCENARIO_TYPES.has(t)),
  );
  if (!selected.size) selected.add("FUNCTIONAL");

  let token = normalizeScenarioTypeToken(raw) || "FUNCTIONAL";
  if (!ALLOWED_SCENARIO_TYPES.has(token)) token = "FUNCTIONAL";
  if (selected.has(token)) return token;

  if (
    token === "DATA_INTEGRITY" &&
    safetyOptions.data_integrity === true &&
    selected.has("VALIDATION")
  ) {
    return "VALIDATION";
  }

  const fallbacks = SCENARIO_TYPE_FALLBACK_MAP[token] || ["FUNCTIONAL"];
  for (const candidate of fallbacks) {
    if (selected.has(candidate)) return candidate;
  }
  return [...selected].sort()[0];
}

function isBrokenObjectCoercion(value) {
  return typeof value === "string" && value.trim() === "[object Object]";
}

function stringifyTestData(value) {
  if (value == null || value === "") return "{}";
  if (typeof value === "string") {
    const s = value.trim();
    if (!s.length || isBrokenObjectCoercion(s)) return "{}";
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function requirementsByIdMap(requirements) {
  const out = {};
  if (!Array.isArray(requirements)) return out;
  for (const req of requirements) {
    const rid = Number(req?.requirement_id);
    if (Number.isFinite(rid) && rid > 0) out[rid] = req;
  }
  return out;
}

function normalizeStoredAdditionalInstructions(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().slice(0, MAX_ADDITIONAL_INSTRUCTIONS_CHARS);
  return s.length ? s : null;
}

function aiEngineAdditionalInstructionsField(job) {
  const v = normalizeStoredAdditionalInstructions(job?.additional_instructions);
  return v ? { additional_instructions: v } : {};
}

function normalizeScenarioTypes(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const c of raw) {
    const u = String(c)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
    if (ALLOWED_SCENARIO_TYPES.has(u)) out.push(u);
  }
  return [...new Set(out)];
}

function normalizeSafetyOptions(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const k of SAFETY_OPTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, k) && raw[k] === true) {
      out[k] = true;
    }
  }
  return out;
}

function _uniquePositiveIds(arr) {
  if (!Array.isArray(arr)) return [];
  return [
    ...new Set(
      arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
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

function scenarioDedupeHash({
  requirement_id: requirementId,
  scenario_type: scenarioType,
  objective,
  testSteps,
}) {
  const stepsStr =
    typeof testSteps === "string"
      ? testSteps
      : JSON.stringify(testSteps || []);
  const obj = String(objective || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return crypto
    .createHash("sha256")
    .update(`${requirementId}|${scenarioType}|${obj}|${stepsStr}`)
    .digest("hex");
}

function dedupeCandidatesByHash(candidates) {
  const seen = new Set();
  return candidates.filter((c) => {
    if (!c.dedupe_hash) return true;
    if (seen.has(c.dedupe_hash)) return false;
    seen.add(c.dedupe_hash);
    return true;
  });
}

function mapAiToScenarioCandidates(
  jobId,
  scenariosRaw,
  selectedTypes = ["FUNCTIONAL"],
  safetyOptions = {},
  requirementsById = {},
) {
  const arr = Array.isArray(scenariosRaw) ? scenariosRaw : [];
  const out = [];
  let idx = 0;
  for (const s of arr) {
    idx += 1;
    const rid = Number(s.requirement_id);
    if (!Number.isFinite(rid)) continue;
    const title = String(s.title || "").trim();
    if (!title) continue;
    const typeNorm = normalizeScenarioTypeAgainstSelection(
      s.scenario_type || s.type || "FUNCTIONAL",
      selectedTypes,
      safetyOptions,
    );
    const steps = normalizeTestSteps(
      s.test_steps != null ? s.test_steps : s.steps,
    );
    const objective = s.objective ? String(s.objective) : null;

    const row = {
      job_id: jobId,
      requirement_id: rid,
      requirement_version:
        s.requirement_version != null
          ? String(s.requirement_version).slice(0, 20)
          : null,
      scenario_type: typeNorm,
      scenario_no:
        s.scenario_no != null
          ? String(s.scenario_no).slice(0, 100)
          : null,
      title: title.slice(0, 255),
      objective,
      priority: s.priority != null ? String(s.priority).slice(0, 32) : null,
      automation_possibility_score: clampAutomationScore(
        s.automation_possibility_score ?? s.automation_score,
      ),
      automation_rationale: s.automation_rationale
        ? String(s.automation_rationale).slice(0, 4000)
        : null,
      description: s.description != null ? String(s.description) : null,
      preconditions:
        s.preconditions != null ? String(s.preconditions) : null,
      test_steps: steps,
      test_data: stringifyTestData(s.test_data),
      expected_results:
        s.expected_results != null
          ? typeof s.expected_results === "object"
            ? JSON.stringify(s.expected_results)
            : String(s.expected_results)
          : null,
      postconditions:
        s.postconditions != null ? String(s.postconditions) : null,
      approval_status: "PENDING",
    };
    row.dedupe_hash = scenarioDedupeHash({
      requirement_id: row.requirement_id,
      scenario_type: row.scenario_type,
      objective: row.objective,
      testSteps: row.test_steps,
    });
    out.push(row);
  }
  return dedupeCandidatesByHash(out);
}

async function maybeDeleteFullyDiscardedScenarioJob(jobId) {
  const id = Number(jobId);
  if (!Number.isFinite(id) || id <= 0) return;
  const job = await Job.findOne({
    where: { job_id: id, job_type: JOB_TYPES.TEST_SCENARIO_GENERATION },
  });
  if (!job) return;
  const active = await GeneratedTestScenario.count({
    where: {
      job_id: id,
      approval_status: { [Op.in]: ["PENDING", "APPROVED"] },
    },
  });
  if (active > 0) return;
  const anyCandidates = await GeneratedTestScenario.count({
    where: { job_id: id },
  });
  if (anyCandidates === 0) return;
  await Job.destroy({ where: { job_id: id } });
}

async function notifyScenarioGenerationOutcome(
  recipientPrincipal,
  { jobId, ok, title, detail, createdBy },
) {
  const auditBy = createdBy ? String(createdBy).slice(0, 100) : "system";
  await notifyUserFromPrincipal(recipientPrincipal, {
    category: "test_scenario_generation",
    title: title || (ok ? `Job ${jobId} completed` : `Job ${jobId} failed`),
    body: detail || "",
    referenceType: "test_scenario_generation_job",
    referenceId: String(jobId),
    createdBy: auditBy,
  });
}

function recipientPrincipalForJob(notifyOverride, jobCreatedBy) {
  if (
    notifyOverride !== undefined &&
    notifyOverride !== null &&
    String(notifyOverride).trim() !== ""
  ) {
    return notifyOverride;
  }
  return jobCreatedBy;
}

async function resolveApprovedRequirementsForProject(
  projectId,
  { allApproved, requirementIds },
) {
  const baseWhere = {
    project_id: Number(projectId),
    deleted_date: null,
    status: "ACTIVE",
  };
  if (!allApproved) {
    const ids = _uniquePositiveIds(requirementIds);
    if (!ids.length) {
      throw new Error(
        "Select at least one requirement or enable all approved requirements.",
      );
    }
    baseWhere.requirement_id = { [Op.in]: ids };
  }
  const rows = await Requirement.findAll({
    where: baseWhere,
    order: [["requirement_id", "ASC"]],
  });
  if (!rows.length) {
    throw new Error("No eligible ACTIVE requirements found for this selection.");
  }
  if (!allApproved) {
    const idsRequested = _uniquePositiveIds(requirementIds);
    const found = new Set(rows.map((r) => Number(r.requirement_id)));
    const missing = idsRequested.filter((id) => !found.has(id));
    if (missing.length) {
      throw new Error(
        `Some requirements were not found, inactive, or not ACTIVE: ${missing.join(", ")}`,
      );
    }
  }
  if (rows.length > MAX_REQUIREMENTS_PER_JOB) {
    throw new Error(
      `At most ${MAX_REQUIREMENTS_PER_JOB} requirements per generation job.`,
    );
  }
  return rows;
}

function requirementBodiesForAi(requirementRows) {
  return requirementRows.map((r) => ({
    requirement_id: Number(r.requirement_id),
    requirement_no: r.requirement_no,
    title: r.title,
    description: r.description || "",
    version: r.version,
  }));
}

async function requirementBodiesFromStoredJob(job) {
  const raw = Array.isArray(job.scenario_requirement_ids)
    ? job.scenario_requirement_ids
    : [];
  const ids = _uniquePositiveIds(raw);
  if (!ids.length) return [];
  const rows = await Requirement.findAll({
    where: {
      requirement_id: { [Op.in]: ids },
      project_id: Number(job.project_id),
      deleted_date: null,
      status: "ACTIVE",
    },
  });
  return requirementBodiesForAi(rows);
}

async function allocateScenarioNo(projectId, preferredNo, transaction) {
  let base = preferredNo && String(preferredNo).trim();
  if (!base) base = `TS-P${projectId}`;
  base = base.slice(0, 72);
  for (let i = 0; i < 3000; i += 1) {
    const suffix = i === 0 ? "" : `-${i}`;
    const trimmed = `${base}${suffix}`.slice(0, 100);
    const n = await TestScenario.count({
      where: { project_id: projectId, scenario_no: trimmed },
      transaction,
    });
    if (!n) return trimmed;
  }
  throw new Error("Could not allocate unique scenario_no.");
}

async function runGenerateQueuedJob(jobId, notifyUserIdOverride) {
  const job = await scenarioGenerationFactory.getJobById(jobId);
  if (!job) return;
  if (job.job_type !== JOB_TYPES.TEST_SCENARIO_GENERATION) {
    console.warn(
      `runGenerateScenarioJob: skip job ${jobId} job_type=${job.job_type}`,
    );
    return;
  }
  if (job.status !== "QUEUED") {
    console.warn(
      `runGenerateScenarioJob: skip job ${jobId} status=${job.status}`,
    );
    return;
  }

  await scenarioGenerationFactory.updateJob(jobId, {
    status: "PROCESSING",
    modified_date: new Date(),
  });

  const recipientPrincipal = recipientPrincipalForJob(
    notifyUserIdOverride,
    job.created_by,
  );
  const createdByAudit = job.created_by || "system";

  const types = normalizeScenarioTypes(
    Array.isArray(job.scenario_types) ? job.scenario_types : [],
  );
  const safety = normalizeSafetyOptions(
    job.scenario_safety_options && typeof job.scenario_safety_options === "object"
      ? job.scenario_safety_options
      : {},
  );

  try {
    if (!types.length) {
      throw new Error("Job is missing scenario_types.");
    }
    const requirementsPayload = await requirementBodiesFromStoredJob(job);
    if (!requirementsPayload.length) {
      throw new Error(
        "Job is missing resolvable requirements (re-index selection or restore requirements).",
      );
    }

    const aiResp = await aiEngineClient.generateTestScenariosFromRequirements({
      project_id: Number(job.project_id),
      organization_id:
        job.organization_id != null ? Number(job.organization_id) : null,
      requirements: requirementsPayload,
      scenario_types: types,
      safety_options: safety,
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
        "Test scenario generation failed (AI engine).";
      throw new Error(msg);
    }

    const candidates = mapAiToScenarioCandidates(
      jobId,
      aiResp.scenarios,
      types,
      safety,
      requirementsByIdMap(requirementsPayload),
    );
    if (!candidates.length) {
      throw new Error("Model returned no test scenarios.");
    }

    await scenarioGenerationFactory.bulkCreateCandidates(candidates);
    await scenarioGenerationFactory.updateJob(jobId, {
      status: "COMPLETED",
      raw_llm_response: JSON.stringify(aiResp).slice(0, 65000),
      modified_date: new Date(),
      error_message: null,
    });

    await notifyScenarioGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: true,
      title: "Test scenario drafts ready",
      detail: `Job #${jobId} finished. Review drafts under Pending approval.`,
      createdBy: createdByAudit,
    });
  } catch (e) {
    const msg = e.message || String(e);
    await scenarioGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: msg,
      modified_date: new Date(),
    });
    await notifyScenarioGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: false,
      title: "Test scenario generation failed",
      detail: msg,
      createdBy: createdByAudit,
    });
  }
}

async function runRegenerateQueuedJob(
  jobId,
  notifyUserIdOverride,
  scopedCandidateIds = null,
) {
  const job = await scenarioGenerationFactory.getJobById(jobId);
  if (!job) return;
  if (job.job_type !== JOB_TYPES.TEST_SCENARIO_GENERATION) {
    console.warn(
      `runRegenerateScenarioJob: skip job ${jobId} job_type=${job.job_type}`,
    );
    return;
  }
  if (job.status !== "QUEUED") {
    console.warn(
      `runRegenerateScenarioJob: skip job ${jobId} status=${job.status}`,
    );
    return;
  }

  await scenarioGenerationFactory.updateJob(jobId, {
    status: "PROCESSING",
    modified_date: new Date(),
  });

  const recipientPrincipal = recipientPrincipalForJob(
    notifyUserIdOverride,
    job.created_by,
  );
  const createdByAudit = job.created_by || "system";

  const types = normalizeScenarioTypes(
    Array.isArray(job.scenario_types) ? job.scenario_types : [],
  );
  const userFeedbackRaw = String(job.user_feedback || "").trim();
  if (!userFeedbackRaw) {
    const msg = "user_feedback missing on queued job.";
    await scenarioGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: msg,
      modified_date: new Date(),
    });
    await notifyScenarioGenerationOutcome(recipientPrincipal, {
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
            generated_test_scenario_id: { [Op.in]: scopeIds },
          }
        : { job_id: jobId, approval_status: "PENDING" };

    const pending = await GeneratedTestScenario.findAll({
      where: pendingWhere,
    });

    if (scopeIds.length > 0) {
      const got = new Set(
        pending.map((p) => Number(p.generated_test_scenario_id)),
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

    const prior = pending.map((p) => ({
      requirement_id: Number(p.requirement_id),
      requirement_version: p.requirement_version,
      scenario_type: p.scenario_type,
      scenario_no: p.scenario_no,
      title: p.title,
      objective: p.objective,
      priority: p.priority,
      automation_possibility_score: p.automation_possibility_score,
      automation_rationale: p.automation_rationale,
      description: p.description,
      preconditions: p.preconditions,
      test_steps: p.test_steps,
      test_data: p.test_data,
      expected_results: p.expected_results,
      postconditions: p.postconditions,
    }));

    const scopedPrefix =
      scopeIds.length > 0
        ? `[Regenerate exactly ${prior.length} draft(s) supplied in prior_scenarios; return JSON.scenarios array of the same length in the same order.]\n\n`
        : "";

    const feedbackForAi = scopedPrefix + userFeedbackRaw;

    const requirementsPayload = await requirementBodiesFromStoredJob(job);
    if (!requirementsPayload.length) {
      throw new Error(
        "Cannot resolve requirement context for regeneration (requirements changed or deleted).",
      );
    }

    const aiResp =
      await aiEngineClient.regenerateTestScenariosFromRequirements({
        project_id: Number(job.project_id),
        organization_id:
          job.organization_id != null ? Number(job.organization_id) : null,
        requirements: requirementsPayload,
        scenario_types: types.length ? types : ["FUNCTIONAL"],
        safety_options: normalizeSafetyOptions(
          job.scenario_safety_options &&
            typeof job.scenario_safety_options === "object"
            ? job.scenario_safety_options
            : {},
        ),
        prior_scenarios: prior,
        user_feedback: feedbackForAi,
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

    const idsToRemove = pending.map((p) => p.generated_test_scenario_id);

    await GeneratedTestScenario.destroy({
      where: {
        generated_test_scenario_id: { [Op.in]: idsToRemove },
        approval_status: "PENDING",
      },
    });

    const candidates = mapAiToScenarioCandidates(
      jobId,
      aiResp.scenarios,
      types.length ? types : ["FUNCTIONAL"],
      normalizeSafetyOptions(
        job.scenario_safety_options &&
          typeof job.scenario_safety_options === "object"
          ? job.scenario_safety_options
          : {},
      ),
      requirementsByIdMap(requirementsPayload),
    );
    if (!candidates.length) throw new Error("Model returned no scenarios.");

    if (scopeIds.length > 0 && candidates.length !== scopeIds.length) {
      console.warn(
        `runRegenerateScenarioJob job ${jobId}: expected ${scopeIds.length} scenarios, got ${candidates.length}`,
      );
    }

    await scenarioGenerationFactory.bulkCreateCandidates(candidates);
    await scenarioGenerationFactory.updateJob(jobId, {
      status: "COMPLETED",
      raw_llm_response: JSON.stringify(aiResp).slice(0, 65000),
      modified_date: new Date(),
      error_message: null,
    });

    await notifyScenarioGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: true,
      title: "Test scenario drafts regenerated",
      detail:
        scopeIds.length > 0
          ? `Job #${jobId}: ${pending.length} selected draft(s) regenerated.`
          : `Job #${jobId} regeneration finished.`,
      createdBy: createdByAudit,
    });
  } catch (e) {
    const msg = e.message || String(e);
    await scenarioGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: msg,
      modified_date: new Date(),
    });
    await notifyScenarioGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: false,
      title: "Regeneration failed",
      detail: msg,
      createdBy: createdByAudit,
    });
  }
}

/**
 * @param {{ kind: string; job_id: number; notify_user_id?: string|null; candidate_ids?: number[] }} envelope
 */
async function processTestScenarioGenerationQueueMessage(envelope) {
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

async function createScenarioGenerationJob({
  projectId,
  organizationId,
  allApproved,
  requirementIds,
  scenarioTypes,
  safetyOptions,
  userId,
  additionalInstructions,
}) {
  const types = normalizeScenarioTypes(scenarioTypes);
  if (!types.length) {
    throw new Error("Select at least one scenario category.");
  }
  const safety = normalizeSafetyOptions(safetyOptions);
  const reqRows = await resolveApprovedRequirementsForProject(projectId, {
    allApproved: Boolean(allApproved),
    requirementIds: Array.isArray(requirementIds) ? requirementIds : [],
  });
  const reqIdsOrdered = reqRows.map((r) => Number(r.requirement_id));

  const jobRowPayload = {
    project_id: projectId,
    organization_id: organizationId,
    job_type: JOB_TYPES.TEST_SCENARIO_GENERATION,
    status: "QUEUED",
    requirement_categories: [],
    source_document_ids: [],
    scenario_types: types,
    scenario_requirement_ids: reqIdsOrdered,
    scenario_safety_options: safety,
    created_by: userId || "system",
  };
  if (additionalInstructions !== undefined) {
    jobRowPayload.additional_instructions =
      normalizeStoredAdditionalInstructions(additionalInstructions);
  }

  const jobRow = await scenarioGenerationFactory.createJob(jobRowPayload);

  try {
    await publishTestScenarioGeneration({
      kind: "generate",
      job_id: jobRow.job_id,
      notify_user_id: userId || "system",
    });
  } catch (e) {
    await notifyUserFromPrincipal(userId || "system", {
      category: "test_scenario_generation",
      title: `Job ${jobRow.job_id} could not be queued`,
      body: `Queue publish failed: ${e.message || String(e)}`,
      referenceType: "test_scenario_generation_job",
      referenceId: String(jobRow.job_id),
      createdBy: userId || "system",
    });
    await scenarioGenerationFactory.updateJob(jobRow.job_id, {
      status: "FAILED",
      error_message: `Queue publish failed: ${e.message || String(e)}`,
      modified_date: new Date(),
    });
    throw e;
  }

  await notifyUserFromPrincipal(userId || "system", {
    category: "test_scenario_generation",
    title: `Job ${jobRow.job_id} queued`,
    body: "Test scenario generation has been queued and will start shortly.",
    referenceType: "test_scenario_generation_job",
    referenceId: String(jobRow.job_id),
    createdBy: userId || "system",
  });

  return scenarioGenerationFactory.getJobById(jobRow.job_id);
}

async function regenerateScenarioJob({
  jobId,
  userFeedback,
  notifyUserId,
  additionalInstructionsStored,
  regenerateCandidateIds,
}) {
  const job = await scenarioGenerationFactory.getJobById(jobId);
  if (!job) throw new Error("Job not found");
  if (job.job_type !== JOB_TYPES.TEST_SCENARIO_GENERATION) {
    throw new Error("Not a test scenario generation job.");
  }
  if (job.status === "PROCESSING") throw new Error("Job still processing.");
  if (job.status === "QUEUED") throw new Error("Job is already queued.");

  let publishCandidateIds;
  if (regenerateCandidateIds?.length) {
    const ids = _uniquePositiveIds(regenerateCandidateIds);
    const n = await GeneratedTestScenario.count({
      where: {
        job_id: jobId,
        approval_status: "PENDING",
        generated_test_scenario_id: { [Op.in]: ids },
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
  await scenarioGenerationFactory.updateJob(jobId, patches);

  const uid = notifyUserId != null ? notifyUserId : job.created_by;

  try {
    await publishTestScenarioGeneration({
      kind: "regenerate",
      job_id: jobId,
      notify_user_id: uid || "system",
      ...(publishCandidateIds?.length
        ? { candidate_ids: publishCandidateIds }
        : {}),
    });
  } catch (e) {
    await notifyUserFromPrincipal(uid || "system", {
      category: "test_scenario_generation",
      title: `Job ${jobId} regeneration could not be queued`,
      body: `Queue publish failed: ${e.message || String(e)}`,
      referenceType: "test_scenario_generation_job",
      referenceId: String(jobId),
      createdBy: uid || "system",
    });
    await scenarioGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: `Queue publish failed: ${e.message || String(e)}`,
      modified_date: new Date(),
    });
    throw e;
  }

  await notifyUserFromPrincipal(uid || "system", {
    category: "test_scenario_generation",
    title: `Job ${jobId} regeneration queued`,
    body: "Test scenario regeneration has been queued and will start shortly.",
    referenceType: "test_scenario_generation_job",
    referenceId: String(jobId),
    createdBy: uid || "system",
  });

  return scenarioGenerationFactory.getJobById(jobId);
}

async function regeneratePendingScenarioCandidatesWithFeedback({
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

  const rows = await GeneratedTestScenario.findAll({
    where: {
      generated_test_scenario_id: { [Op.in]: ids },
      approval_status: "PENDING",
    },
    include: [
      {
        model: Job,
        as: "job",
        required: true,
        where: {
          project_id: Number(projectId),
          job_type: JOB_TYPES.TEST_SCENARIO_GENERATION,
        },
      },
    ],
  });
  const found = new Set(rows.map((r) => Number(r.generated_test_scenario_id)));
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

  return regenerateScenarioJob({
    jobId: onlyJobId,
    userFeedback: fb,
    notifyUserId,
    regenerateCandidateIds: ids,
    ...(additionalInstructionsStored !== undefined && {
      additionalInstructionsStored,
    }),
  });
}

async function approveScenarioCandidate(candidateId, userId) {
  const candidate = await scenarioGenerationFactory.getCandidateById(
    candidateId,
  );
  if (!candidate) throw new Error("Candidate not found");
  if (candidate.approval_status !== "PENDING") {
    throw new Error("Candidate is not pending approval.");
  }
  const job = candidate.job;
  if (!job) throw new Error("Generation job missing.");
  if (job.job_type !== JOB_TYPES.TEST_SCENARIO_GENERATION) {
    throw new Error("Candidate is not from a test scenario generation job.");
  }

  await db.sequelize.transaction(async (t) => {
    const scenarioNo = await allocateScenarioNo(
      Number(job.project_id),
      candidate.scenario_no ||
        `TS-${job.project_id}-R${candidate.requirement_id}`,
      t,
    );

    const tsRow = await TestScenario.create(
      {
        organization_id: Number(job.organization_id),
        project_id: Number(job.project_id),
        scenario_no: scenarioNo,
        scenario_type: candidate.scenario_type,
        title: candidate.title,
        objective: candidate.objective,
        priority: candidate.priority,
        automation_possibility_score: candidate.automation_possibility_score,
        automation_rationale: candidate.automation_rationale,
        description: candidate.description,
        preconditions: candidate.preconditions,
        test_steps: candidate.test_steps,
        test_data: candidate.test_data,
        expected_results: candidate.expected_results,
        actual_results: null,
        postconditions: candidate.postconditions,
        requirement_id: Number(candidate.requirement_id),
        requirement_version: candidate.requirement_version,
        dedupe_hash: candidate.dedupe_hash,
        generated_from_job_id: Number(job.job_id),
        promoted_from_candidate_id: Number(
          candidate.generated_test_scenario_id,
        ),
        created_by: userId || "system",
      },
      { transaction: t },
    );

    await GeneratedTestScenario.update(
      {
        approval_status: "APPROVED",
        promoted_test_scenario_id: tsRow.test_scenario_id,
        approved_by: userId || "system",
        approved_date: new Date(),
      },
      {
        where: {
          generated_test_scenario_id: candidate.generated_test_scenario_id,
        },
        transaction: t,
      },
    );
  });

  return scenarioGenerationFactory.getCandidateById(candidateId);
}

async function rejectScenarioCandidate(candidateId, userId, reason) {
  const candidate = await scenarioGenerationFactory.getCandidateById(
    candidateId,
  );
  if (!candidate) throw new Error("Candidate not found");
  if (candidate.approval_status !== "PENDING") {
    throw new Error("Candidate is not pending approval.");
  }
  if (
    candidate.job &&
    candidate.job.job_type !== JOB_TYPES.TEST_SCENARIO_GENERATION
  ) {
    throw new Error("Candidate is not from a test scenario generation job.");
  }

  const jid = candidate.job?.job_id;
  await scenarioGenerationFactory.updateCandidate(candidateId, {
    approval_status: "REJECTED",
    rejected_reason: reason || null,
    modified_date: new Date(),
  });
  await maybeDeleteFullyDiscardedScenarioJob(jid);
  return scenarioGenerationFactory.getCandidateById(candidateId);
}

async function listJobs(projectId, query) {
  const page = query.page || 1;
  const size = query.size || 50;
  return scenarioGenerationFactory.listJobsForProject(projectId, {
    page,
    size,
  });
}

async function _loadPendingScenarioCandidatesForProject(projectId, candidateIds) {
  const ids = _uniquePositiveIds(candidateIds);
  if (!ids.length) {
    throw new Error("candidate_ids must be a non-empty array of ids.");
  }
  const rows = await GeneratedTestScenario.findAll({
    where: {
      generated_test_scenario_id: { [Op.in]: ids },
      approval_status: "PENDING",
    },
    include: [
      {
        model: Job,
        as: "job",
        required: true,
        where: {
          project_id: Number(projectId),
          job_type: JOB_TYPES.TEST_SCENARIO_GENERATION,
        },
      },
    ],
  });
  const found = new Set(
    rows.map((r) => Number(r.generated_test_scenario_id)),
  );
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    throw new Error(
      `Some candidates are missing, not pending, or not in this project: ${missing.join(", ")}`,
    );
  }
  return rows;
}

async function bulkApproveScenarioCandidates({ projectId, candidateIds, userId }) {
  const rows = await _loadPendingScenarioCandidatesForProject(
    projectId,
    candidateIds,
  );
  const results = [];
  for (const c of rows) {
    const id = c.generated_test_scenario_id;
    try {
      await approveScenarioCandidate(id, userId);
      results.push({ candidate_id: id, ok: true });
    } catch (e) {
      results.push({
        candidate_id: id,
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

async function bulkRejectScenarioCandidates({
  projectId,
  candidateIds,
  userId,
  reason,
}) {
  const rows = await _loadPendingScenarioCandidatesForProject(
    projectId,
    candidateIds,
  );
  const results = [];
  for (const c of rows) {
    const id = c.generated_test_scenario_id;
    try {
      await rejectScenarioCandidate(id, userId, reason);
      results.push({ candidate_id: id, ok: true });
    } catch (e) {
      results.push({
        candidate_id: id,
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

async function bulkDiscardScenarioCandidates({ projectId, candidateIds, userId, reason }) {
  const r = reason || "Bulk discarded (not promoted)";
  return bulkRejectScenarioCandidates({
    projectId,
    candidateIds,
    userId,
    reason: r,
  });
}

async function bulkRegenerateScenarioJobs({
  projectId,
  jobIds,
  userFeedback,
  notifyUserId,
}) {
  const jids = _uniquePositiveIds(jobIds);
  if (!jids.length) {
    throw new Error("job_ids must be a non-empty array.");
  }
  const fb = String(userFeedback || "").trim();
  if (!fb) throw new Error("user_feedback is required");

  const jobs = await Job.findAll({
    where: {
      job_id: { [Op.in]: jids },
      project_id: Number(projectId),
      job_type: JOB_TYPES.TEST_SCENARIO_GENERATION,
    },
  });
  const got = new Set(jobs.map((j) => Number(j.job_id)));
  const missing = jids.filter((id) => !got.has(id));
  if (missing.length) {
    throw new Error(
      `Invalid test scenario job ids for this project or not found: ${missing.join(", ")}`,
    );
  }

  const results = [];
  for (const jid of jids) {
    try {
      const jobRow = await regenerateScenarioJob({
        jobId: jid,
        userFeedback: fb,
        notifyUserId,
      });
      results.push({ job_id: jid, ok: true, job: jobRow });
    } catch (e) {
      results.push({
        job_id: jid,
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

async function bulkDiscardPendingScenarioJobs({ projectId, jobIds, reason }) {
  const jids = _uniquePositiveIds(jobIds);
  if (!jids.length) {
    throw new Error("job_ids must be a non-empty array.");
  }

  const jobs = await Job.findAll({
    where: {
      job_id: { [Op.in]: jids },
      project_id: Number(projectId),
      job_type: JOB_TYPES.TEST_SCENARIO_GENERATION,
    },
  });
  const got = new Set(jobs.map((j) => Number(j.job_id)));
  const missing = jids.filter((id) => !got.has(id));
  if (missing.length) {
    throw new Error(
      `Invalid test scenario job ids for this project or not found: ${missing.join(", ")}`,
    );
  }

  const [affected] = await GeneratedTestScenario.update(
    {
      approval_status: "REJECTED",
      rejected_reason: reason || "Batch discarded (entire job pending set)",
      modified_date: new Date(),
    },
    {
      where: {
        job_id: { [Op.in]: jids },
        approval_status: "PENDING",
      },
    },
  );

  await Promise.all(jids.map((jid) => maybeDeleteFullyDiscardedScenarioJob(jid)));

  return { job_ids: jids, candidates_affected: affected };
}

async function listPending(projectId, page, size) {
  const [listResult, pending_job_ids] = await Promise.all([
    scenarioGenerationFactory.listPendingCandidatesForProject(
      projectId,
      page,
      size,
    ),
    scenarioGenerationFactory.listPendingJobIdsForProject(projectId),
  ]);
  return { ...listResult, pending_job_ids };
}

async function getScenarioJob(jobId) {
  const job = await scenarioGenerationFactory.getJobById(jobId);
  if (!job || job.job_type !== JOB_TYPES.TEST_SCENARIO_GENERATION) return null;
  return job;
}

module.exports = {
  ALLOWED_SCENARIO_TYPES,
  normalizeScenarioTypes,
  normalizeSafetyOptions,
  SAFETY_OPTION_KEYS,
  MAX_REQUIREMENTS_PER_JOB,
  processTestScenarioGenerationQueueMessage,
  createScenarioGenerationJob,
  regenerateScenarioJob,
  regeneratePendingScenarioCandidatesWithFeedback,
  approveScenarioCandidate,
  rejectScenarioCandidate,
  bulkApproveScenarioCandidates,
  bulkRejectScenarioCandidates,
  bulkDiscardScenarioCandidates,
  bulkRegenerateScenarioJobs,
  bulkDiscardPendingScenarioJobs,
  listJobs,
  listPending,
  getScenarioJob,
};
