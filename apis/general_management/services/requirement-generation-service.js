"use strict";

const { Op } = require("sequelize");

const db = require("../database/mysql/models");
const { ProjectDocument, GeneratedRequirement, Job } = db;
const { JOB_TYPES } = require("../constants/job-types");

const aiEngineClient = require("./ai-engine-client");
const ragService = require("./rag-service");
const requirementGenerationFactory = require("../database/mysql/factories/requirement-generation-factory");
const requirementFactory = require("../database/mysql/factories/requirement-factory");
const { notifyUserFromPrincipal } = require("./async-user-notify");
const { publishRequirementGeneration } = require("./requirement-generation-mq-publish");

/** Max chars persisted / sent to retrieval + LLM (ai_engine truncates similarly). */
const MAX_ADDITIONAL_INSTRUCTIONS_CHARS = 6000;

function normalizeStoredAdditionalInstructions(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().slice(0, MAX_ADDITIONAL_INSTRUCTIONS_CHARS);
  return s.length ? s : null;
}

function ragQueryFragmentsFromJobInstructions(job) {
  const t = normalizeStoredAdditionalInstructions(job?.additional_instructions);
  if (!t) return [];
  return [
    "User-provided extraction and prioritization hints (respect when grounded in excerpts):",
    t,
  ];
}

function aiEngineAdditionalInstructionsField(job) {
  const v = normalizeStoredAdditionalInstructions(job?.additional_instructions);
  return v ? { additional_instructions: v } : {};
}

async function maybeDeleteFullyDiscardedRequirementJob(jobId) {
  const id = Number(jobId);
  if (!Number.isFinite(id) || id <= 0) return;
  const job = await Job.findOne({
    where: { job_id: id, job_type: JOB_TYPES.REQUIREMENT_GENERATION },
  });
  if (!job) return;
  const active = await GeneratedRequirement.count({
    where: {
      job_id: id,
      approval_status: { [Op.in]: ["PENDING", "APPROVED"] },
    },
  });
  if (active > 0) return;
  const anyCandidates = await GeneratedRequirement.count({
    where: { job_id: id },
  });
  if (anyCandidates === 0) return;
  await Job.destroy({ where: { job_id: id } });
}

const ALLOWED_CATEGORIES = new Set([
  "FUNCTIONAL",
  "NON_FUNCTIONAL",
  "COMPLIANCE",
  "REGULATORY",
  "SAFETY",
  "SECURITY",
  "PERFORMANCE",
  "USABILITY",
  "INTERFACE",
  "DATA",
]);

function normalizeCategories(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const c of raw) {
    const u = String(c)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
    if (ALLOWED_CATEGORIES.has(u)) out.push(u);
  }
  return [...new Set(out)];
}

async function ensureIndexedDocuments(projectId, documentIds) {
  const ids = [...new Set(documentIds.map((x) => Number(x)))];
  const rows = await ProjectDocument.findAll({
    where: {
      project_id: projectId,
      project_document_id: { [Op.in]: ids },
      status: "INDEXED",
    },
  });
  const ok = new Set(rows.map((r) => Number(r.project_document_id)));
  const missing = ids.filter((id) => !ok.has(id));
  if (missing.length) {
    throw new Error(
      `Documents must be indexed (INDEXED). Invalid or not ready: ${missing.join(", ")}`,
    );
  }
}

async function buildDocumentContext({
  projectId,
  organizationId,
  documentIds,
  categories,
  extraQueryFragments = [],
  topK = 32,
}) {
  const fragments = Array.isArray(extraQueryFragments)
    ? extraQueryFragments.filter((s) => s && String(s).trim())
    : [];
  const query = [
    "Extract verifiable requirements for software verification.",
    `Categories of interest: ${categories.join(", ")}.`,
    "Focus strictly on the selected project documents.",
    ...fragments,
  ].join(" ");

  const ragBody = {
    project_id: Number(projectId),
    organization_id: organizationId != null ? Number(organizationId) : null,
    query,
    project_document_ids: documentIds.map(Number),
    top_k: Math.min(48, Number(topK) || 32),
    max_branch: 3,
    max_depth: 5,
  };

  let retrieval = await aiEngineClient.ragSearch(ragBody);
  if (!retrieval) {
    retrieval = await ragService.selectChunks({
      projectId,
      organizationId,
      query,
      projectDocumentIds: documentIds.map(String),
      topK: Math.min(48, Number(topK) || 32),
      maxBranch: 3,
      maxDepth: 5,
    });
  }

  let chunks = retrieval.chunks || [];
  const idSet = new Set(documentIds.map(Number));
  const filtered = chunks.filter((c) =>
    idSet.has(Number(c.project_document_id)),
  );
  if (filtered.length) chunks = filtered;

  const lines = chunks.map((c) => {
    const title = c.project_document_title || "Document";
    const path = c.section_path || c.heading || "";
    const body = String(c.content || c.summary || "").trim();
    return `### ${title}${path ? " / " + path : ""}\n${body}`;
  });

  let text = lines.join("\n\n---\n\n");
  const max = 28000;
  if (text.length > max) text = text.slice(0, max);
  return text;
}

function mapAiToCandidates(jobId, requirements) {
  const reqArr = Array.isArray(requirements) ? requirements : [];
  return reqArr.map((r, idx) => {
    const cat = String(r.requirement_category || r.category || "FUNCTIONAL")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
    return {
      job_id: jobId,
      requirement_category: cat,
      requirement_no: String(r.requirement_no || `REQ-GEN-${idx + 1}`).slice(
        0,
        64,
      ),
      title: String(r.title || `Requirement ${idx + 1}`).slice(0, 255),
      description: String(r.description || ""),
      rationale: r.rationale ? String(r.rationale).slice(0, 8000) : null,
      approval_status: "PENDING",
    };
  });
}

async function notifyRequirementGenerationOutcome(
  recipientPrincipal,
  { jobId, ok, title, detail, createdBy },
) {
  const auditBy = createdBy ? String(createdBy).slice(0, 100) : "system";
  await notifyUserFromPrincipal(recipientPrincipal, {
    category: "requirement_generation",
    title: title || (ok ? `Job ${jobId} completed` : `Job ${jobId} failed`),
    body: detail || "",
    referenceType: "requirement_generation_job",
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

async function runGenerateQueuedJob(jobId, notifyUserIdOverride) {
  const job = await requirementGenerationFactory.getJobById(jobId);
  if (!job) return;
  if (job.job_type !== JOB_TYPES.REQUIREMENT_GENERATION) {
    console.warn(
      `runGenerateQueuedJob: skip job ${jobId} job_type=${job.job_type}`,
    );
    return;
  }
  if (job.status !== "QUEUED") {
    console.warn(`runGenerateQueuedJob: skip job ${jobId} status=${job.status}`);
    return;
  }

  await requirementGenerationFactory.updateJob(jobId, {
    status: "PROCESSING",
    modified_date: new Date(),
  });

  const recipientPrincipal = recipientPrincipalForJob(
    notifyUserIdOverride,
    job.created_by,
  );
  const createdByAudit = job.created_by || "system";

  const cats = normalizeCategories(
    Array.isArray(job.requirement_categories)
      ? job.requirement_categories
      : [],
  );
  const docIdsRaw = Array.isArray(job.source_document_ids)
    ? job.source_document_ids
    : [];
  const docIds = [...new Set(docIdsRaw.map((x) => Number(x)))].filter((n) =>
    Number.isFinite(n),
  );

  try {
    if (!cats.length || !docIds.length) {
      throw new Error("Job is missing categories or documents.");
    }

    const documentContext = await buildDocumentContext({
      projectId: job.project_id,
      organizationId: job.organization_id,
      documentIds: docIds,
      categories: cats,
      extraQueryFragments: ragQueryFragmentsFromJobInstructions(job),
    });

    if (!documentContext || documentContext.length < 30) {
      throw new Error(
        "Could not build enough context from documents. Confirm indexing completed.",
      );
    }

    const aiResp = await aiEngineClient.generateRequirementsFromDocuments({
      project_id: Number(job.project_id),
      organization_id:
        job.organization_id != null ? Number(job.organization_id) : null,
      requirement_categories: cats,
      document_context: documentContext,
      source_document_ids: docIds,
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
        "Requirement generation failed (AI engine).";
      throw new Error(msg);
    }

    const candidates = mapAiToCandidates(jobId, aiResp.requirements);
    if (!candidates.length) throw new Error("Model returned no requirements.");

    await requirementGenerationFactory.bulkCreateCandidates(candidates);
    await requirementGenerationFactory.updateJob(jobId, {
      status: "COMPLETED",
      raw_llm_response: JSON.stringify(aiResp).slice(0, 65000),
      modified_date: new Date(),
      error_message: null,
    });

    await notifyRequirementGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: true,
      title: "Requirement drafts ready",
      detail: `Job #${jobId} finished. Review drafts under Pending approval.`,
      createdBy: createdByAudit,
    });
  } catch (e) {
    const msg = e.message || String(e);
    await requirementGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: msg,
      modified_date: new Date(),
    });
    await notifyRequirementGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: false,
      title: "Requirement generation failed",
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
  const job = await requirementGenerationFactory.getJobById(jobId);
  if (!job) return;
  if (job.job_type !== JOB_TYPES.REQUIREMENT_GENERATION) {
    console.warn(
      `runRegenerateQueuedJob: skip job ${jobId} job_type=${job.job_type}`,
    );
    return;
  }
  if (job.status !== "QUEUED") {
    console.warn(
      `runRegenerateQueuedJob: skip job ${jobId} status=${job.status}`,
    );
    return;
  }

  await requirementGenerationFactory.updateJob(jobId, {
    status: "PROCESSING",
    modified_date: new Date(),
  });

  const recipientPrincipal = recipientPrincipalForJob(
    notifyUserIdOverride,
    job.created_by,
  );
  const createdByAudit = job.created_by || "system";

  const cats = normalizeCategories(
    Array.isArray(job.requirement_categories)
      ? job.requirement_categories
      : [],
  );
  const docIdsRaw = Array.isArray(job.source_document_ids)
    ? job.source_document_ids
    : [];
  const docIds = [...new Set(docIdsRaw.map((x) => Number(x)))].filter((n) =>
    Number.isFinite(n),
  );

  const userFeedbackRaw = String(job.user_feedback || "").trim();
  if (!userFeedbackRaw) {
    const msg = "user_feedback missing on queued job.";
    await requirementGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: msg,
      modified_date: new Date(),
    });
    await notifyRequirementGenerationOutcome(recipientPrincipal, {
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
            generated_requirement_id: { [Op.in]: scopeIds },
          }
        : { job_id: jobId, approval_status: "PENDING" };

    const pending = await GeneratedRequirement.findAll({
      where: pendingWhere,
    });

    if (scopeIds.length > 0) {
      const got = new Set(
        pending.map((p) => Number(p.generated_requirement_id)),
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
      requirement_category: p.requirement_category,
      requirement_no: p.requirement_no,
      title: p.title,
      description: p.description,
      rationale: p.rationale,
    }));

    const scopedPrefix =
      scopeIds.length > 0
        ? `[Regenerate exactly ${prior.length} draft(s) supplied in prior_requirements; return a JSON.requirements array of the same length in the same order.]\n\n`
        : "";

    const feedbackForAi = scopedPrefix + userFeedbackRaw;

    const documentContext = await buildDocumentContext({
      projectId: job.project_id,
      organizationId: job.organization_id,
      documentIds: docIds,
      categories: cats.length ? cats : ["FUNCTIONAL"],
      extraQueryFragments: ragQueryFragmentsFromJobInstructions(job),
    });

    const aiResp = await aiEngineClient.regenerateRequirementsFromDocuments({
      project_id: Number(job.project_id),
      organization_id:
        job.organization_id != null ? Number(job.organization_id) : null,
      requirement_categories: cats.length ? cats : ["FUNCTIONAL"],
      document_context: documentContext,
      prior_requirements: prior,
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

    const idsToRemove = pending.map((p) => p.generated_requirement_id);

    await GeneratedRequirement.destroy({
      where: {
        generated_requirement_id: { [Op.in]: idsToRemove },
        approval_status: "PENDING",
      },
    });

    const candidates = mapAiToCandidates(jobId, aiResp.requirements);
    if (!candidates.length) throw new Error("Model returned no requirements.");

    if (scopeIds.length > 0 && candidates.length !== scopeIds.length) {
      console.warn(
        `runRegenerateQueuedJob job ${jobId}: expected ${scopeIds.length} requirements, got ${candidates.length}`,
      );
    }

    await requirementGenerationFactory.bulkCreateCandidates(candidates);
    await requirementGenerationFactory.updateJob(jobId, {
      status: "COMPLETED",
      raw_llm_response: JSON.stringify(aiResp).slice(0, 65000),
      modified_date: new Date(),
      error_message: null,
    });

    await notifyRequirementGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: true,
      title: "Requirement drafts regenerated",
      detail:
        scopeIds.length > 0
          ? `Job #${jobId}: ${pending.length} selected draft(s) regenerated.`
          : `Job #${jobId} regeneration finished.`,
      createdBy: createdByAudit,
    });
  } catch (e) {
    const msg = e.message || String(e);
    await requirementGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: msg,
      modified_date: new Date(),
    });
    await notifyRequirementGenerationOutcome(recipientPrincipal, {
      jobId,
      ok: false,
      title: "Regeneration failed",
      detail: msg,
      createdBy: createdByAudit,
    });
  }
}

/**
 * RabbitMQ worker entry (listener-requirement-generation).
 * @param {{ kind: string; job_id: number; notify_user_id?: string|null; candidate_ids?: number[] }} envelope
 */
async function processRequirementGenerationQueueMessage(envelope) {
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

async function createGenerationJob({
  projectId,
  organizationId,
  documentIds,
  categories,
  userId,
  additionalInstructions,
}) {
  const cats = normalizeCategories(categories);
  if (!cats.length) {
    throw new Error("Select at least one valid requirement category.");
  }
  const ids = documentIds.map(Number);
  if (!ids.length) throw new Error("Select at least one document.");

  await ensureIndexedDocuments(projectId, ids);

  const jobRowPayload = {
    project_id: projectId,
    organization_id: organizationId,
    job_type: JOB_TYPES.REQUIREMENT_GENERATION,
    status: "QUEUED",
    requirement_categories: cats,
    source_document_ids: ids,
    created_by: userId || "system",
  };
  if (additionalInstructions !== undefined) {
    jobRowPayload.additional_instructions =
      normalizeStoredAdditionalInstructions(additionalInstructions);
  }

  const jobRow = await requirementGenerationFactory.createJob(jobRowPayload);

  try {
    await publishRequirementGeneration({
      kind: "generate",
      job_id: jobRow.job_id,
      notify_user_id: userId || "system",
    });
  } catch (e) {
    await notifyUserFromPrincipal(userId || "system", {
      category: "requirement_generation",
      title: `Job ${jobRow.job_id} could not be queued`,
      body: `Queue publish failed: ${e.message || String(e)}`,
      referenceType: "requirement_generation_job",
      referenceId: String(jobRow.job_id),
      createdBy: userId || "system",
    });
    await requirementGenerationFactory.updateJob(jobRow.job_id, {
      status: "FAILED",
      error_message: `Queue publish failed: ${e.message || String(e)}`,
      modified_date: new Date(),
    });
    throw e;
  }

  await notifyUserFromPrincipal(userId || "system", {
    category: "requirement_generation",
    title: `Job ${jobRow.job_id} queued`,
    body:
      "Requirement generation has been queued and will start shortly.",
    referenceType: "requirement_generation_job",
    referenceId: String(jobRow.job_id),
    createdBy: userId || "system",
  });

  return requirementGenerationFactory.getJobById(jobRow.job_id);
}

async function regenerateGenerationJob({
  jobId,
  userFeedback,
  notifyUserId,
  /** Set only when overriding stored hints (including explicit null via controller). */
  additionalInstructionsStored,
  /** Scoped regeneration: only replace these pending draft ids (same job). */
  regenerateCandidateIds,
}) {
  const job = await requirementGenerationFactory.getJobById(jobId);
  if (!job) throw new Error("Job not found");
  if (job.job_type !== JOB_TYPES.REQUIREMENT_GENERATION) {
    throw new Error("Not a requirement-generation job.");
  }
  if (job.status === "PROCESSING") throw new Error("Job still processing.");
  if (job.status === "QUEUED") throw new Error("Job is already queued.");

  let publishCandidateIds;
  if (regenerateCandidateIds?.length) {
    const ids = _uniquePositiveIds(regenerateCandidateIds);
    const n = await GeneratedRequirement.count({
      where: {
        job_id: jobId,
        approval_status: "PENDING",
        generated_requirement_id: { [Op.in]: ids },
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
  await requirementGenerationFactory.updateJob(jobId, patches);

  const uid = notifyUserId != null ? notifyUserId : job.created_by;

  try {
    await publishRequirementGeneration({
      kind: "regenerate",
      job_id: jobId,
      notify_user_id: uid || "system",
      ...(publishCandidateIds?.length ? { candidate_ids: publishCandidateIds } : {}),
    });
  } catch (e) {
    await notifyUserFromPrincipal(uid || "system", {
      category: "requirement_generation",
      title: `Job ${jobId} regeneration could not be queued`,
      body: `Queue publish failed: ${e.message || String(e)}`,
      referenceType: "requirement_generation_job",
      referenceId: String(jobId),
      createdBy: uid || "system",
    });
    await requirementGenerationFactory.updateJob(jobId, {
      status: "FAILED",
      error_message: `Queue publish failed: ${e.message || String(e)}`,
      modified_date: new Date(),
    });
    throw e;
  }

  await notifyUserFromPrincipal(uid || "system", {
    category: "requirement_generation",
    title: `Job ${jobId} regeneration queued`,
    body: "Requirement regeneration has been queued and will start shortly.",
    referenceType: "requirement_generation_job",
    referenceId: String(jobId),
    createdBy: uid || "system",
  });

  return requirementGenerationFactory.getJobById(jobId);
}

async function regeneratePendingCandidatesWithFeedback({
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

  const rows = await GeneratedRequirement.findAll({
    where: {
      generated_requirement_id: { [Op.in]: ids },
      approval_status: "PENDING",
    },
    include: [
      {
        model: Job,
        as: "job",
        required: true,
        where: {
          project_id: Number(projectId),
          job_type: JOB_TYPES.REQUIREMENT_GENERATION,
        },
      },
    ],
  });
  const found = new Set(rows.map((r) => Number(r.generated_requirement_id)));
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

  return regenerateGenerationJob({
    jobId: onlyJobId,
    userFeedback: fb,
    notifyUserId,
    regenerateCandidateIds: ids,
    ...(additionalInstructionsStored !== undefined && {
      additionalInstructionsStored,
    }),
  });
}

async function approveCandidate(candidateId, userId) {
  const candidate = await requirementGenerationFactory.getCandidateById(
    candidateId,
  );
  if (!candidate) throw new Error("Candidate not found");
  if (candidate.approval_status !== "PENDING") {
    throw new Error("Candidate is not pending approval.");
  }
  const job = candidate.job;
  if (!job) throw new Error("Generation job missing.");
  if (job.job_type !== JOB_TYPES.REQUIREMENT_GENERATION) {
    throw new Error("Candidate is not from a requirement-generation job.");
  }

  await db.sequelize.transaction(async (t) => {
    const reqRow = await requirementFactory.add(
      {
        organization_id: job.organization_id,
        project_id: job.project_id,
        requirement_no:
          candidate.requirement_no ||
          `AI-${candidate.generated_requirement_id}`,
        title: candidate.title || candidate.requirement_no || "Requirement",
        description: candidate.description || "",
        version: "1.0",
        status: "ACTIVE",
        created_by: userId || "system",
      },
      { transaction: t },
    );

    await GeneratedRequirement.update(
      {
        approval_status: "APPROVED",
        promoted_requirement_id: reqRow.requirement_id,
        approved_by: userId || "system",
        approved_date: new Date(),
      },
      {
        where: { generated_requirement_id: candidate.generated_requirement_id },
        transaction: t,
      },
    );
  });

  return requirementGenerationFactory.getCandidateById(candidateId);
}

async function rejectCandidate(candidateId, userId, reason) {
  const candidate = await requirementGenerationFactory.getCandidateById(
    candidateId,
  );
  if (!candidate) throw new Error("Candidate not found");
  if (candidate.approval_status !== "PENDING") {
    throw new Error("Candidate is not pending approval.");
  }
  if (
    candidate.job &&
    candidate.job.job_type !== JOB_TYPES.REQUIREMENT_GENERATION
  ) {
    throw new Error("Candidate is not from a requirement-generation job.");
  }

  const jid = candidate.job?.job_id;
  await requirementGenerationFactory.updateCandidate(candidateId, {
    approval_status: "REJECTED",
    rejected_reason: reason || null,
    modified_date: new Date(),
  });
  await maybeDeleteFullyDiscardedRequirementJob(jid);
  return requirementGenerationFactory.getCandidateById(candidateId);
}

async function listJobs(projectId, query) {
  const page = query.page || 1;
  const size = query.size || 50;
  return requirementGenerationFactory.listJobsForProject(projectId, {
    page,
    size,
  });
}

function _uniquePositiveIds(arr) {
  if (!Array.isArray(arr)) return [];
  return [
    ...new Set(
      arr
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
}

async function _loadPendingCandidatesForProject(projectId, candidateIds) {
  const ids = _uniquePositiveIds(candidateIds);
  if (!ids.length) {
    throw new Error("candidate_ids must be a non-empty array of ids.");
  }
  const rows = await GeneratedRequirement.findAll({
    where: {
      generated_requirement_id: { [Op.in]: ids },
      approval_status: "PENDING",
    },
    include: [
      {
        model: Job,
        as: "job",
        required: true,
        where: {
          project_id: Number(projectId),
          job_type: JOB_TYPES.REQUIREMENT_GENERATION,
        },
      },
    ],
  });
  const found = new Set(
    rows.map((r) => Number(r.generated_requirement_id)),
  );
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    throw new Error(
      `Some candidates are missing, not pending, or not in this project: ${missing.join(", ")}`,
    );
  }
  return rows;
}

async function bulkApproveCandidates({ projectId, candidateIds, userId }) {
  const rows = await _loadPendingCandidatesForProject(projectId, candidateIds);
  const results = [];
  for (const c of rows) {
    const id = c.generated_requirement_id;
    try {
      await approveCandidate(id, userId);
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

async function bulkRejectCandidates({
  projectId,
  candidateIds,
  userId,
  reason,
}) {
  const rows = await _loadPendingCandidatesForProject(projectId, candidateIds);
  const results = [];
  for (const c of rows) {
    const id = c.generated_requirement_id;
    try {
      await rejectCandidate(id, userId, reason);
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

async function bulkDiscardCandidates({ projectId, candidateIds, userId, reason }) {
  const r = reason || "Bulk discarded (not promoted)";
  return bulkRejectCandidates({
    projectId,
    candidateIds,
    userId,
    reason: r,
  });
}

async function bulkRegenerateRequirementJobs({
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
      job_type: JOB_TYPES.REQUIREMENT_GENERATION,
    },
  });
  const got = new Set(jobs.map((j) => Number(j.job_id)));
  const missing = jids.filter((id) => !got.has(id));
  if (missing.length) {
    throw new Error(
      `Invalid requirement-generation job ids for this project or not found: ${missing.join(", ")}`,
    );
  }

  const results = [];
  for (const jid of jids) {
    try {
      const jobRow = await regenerateGenerationJob({
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

async function bulkDiscardPendingForJobs({ projectId, jobIds, reason }) {
  const jids = _uniquePositiveIds(jobIds);
  if (!jids.length) {
    throw new Error("job_ids must be a non-empty array.");
  }

  const jobs = await Job.findAll({
    where: {
      job_id: { [Op.in]: jids },
      project_id: Number(projectId),
      job_type: JOB_TYPES.REQUIREMENT_GENERATION,
    },
  });
  const got = new Set(jobs.map((j) => Number(j.job_id)));
  const missing = jids.filter((id) => !got.has(id));
  if (missing.length) {
    throw new Error(
      `Invalid requirement-generation job ids for this project or not found: ${missing.join(", ")}`,
    );
  }

  const [affected] = await GeneratedRequirement.update(
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

  await Promise.all(
    jids.map((jid) => maybeDeleteFullyDiscardedRequirementJob(jid)),
  );

  return { job_ids: jids, candidates_affected: affected };
}

async function listPending(projectId, page, size) {
  const [listResult, pending_job_ids] = await Promise.all([
    requirementGenerationFactory.listPendingCandidatesForProject(
      projectId,
      page,
      size,
    ),
    requirementGenerationFactory.listPendingJobIdsForProject(projectId),
  ]);
  return { ...listResult, pending_job_ids };
}

async function getJob(jobId) {
  const job = await requirementGenerationFactory.getJobById(jobId);
  if (!job || job.job_type !== JOB_TYPES.REQUIREMENT_GENERATION) return null;
  return job;
}

module.exports = {
  ALLOWED_CATEGORIES,
  normalizeCategories,
  buildDocumentContext,
  ensureIndexedDocuments,
  createGenerationJob,
  regenerateGenerationJob,
  regeneratePendingCandidatesWithFeedback,
  /** @deprecated used by mq listener — do not expose to HTTP layer */
  processRequirementGenerationQueueMessage,
  approveCandidate,
  rejectCandidate,
  bulkApproveCandidates,
  bulkRejectCandidates,
  bulkDiscardCandidates,
  bulkRegenerateRequirementJobs,
  bulkDiscardPendingForJobs,
  listJobs,
  listPending,
  getJob,
};
