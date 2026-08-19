"use strict";

const testCaseGenerationService = require("../services/test-case-generation-service");

function userId(req) {
  return req.headers["x-user-id"] || "system";
}

const generate = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      project_id: projectId,
      organization_id: organizationId,
      all_active: allActive,
      scenario_ids: scenarioIds,
    } = body;

    if (!projectId) {
      return res.status(400).json({ message: "project_id is required" });
    }
    if (organizationId == null) {
      return res.status(400).json({ message: "organization_id is required" });
    }

    const job = await testCaseGenerationService.createTestCaseGenerationJob({
      projectId: Number(projectId),
      organizationId: Number(organizationId),
      allActive: allActive !== false,
      scenarioIds: Array.isArray(scenarioIds) ? scenarioIds : [],
      userId: userId(req),
      ...(Object.prototype.hasOwnProperty.call(body, "additional_instructions")
        ? { additionalInstructions: body.additional_instructions }
        : {}),
    });

    return res.status(202).json({
      ...(job?.toJSON ? job.toJSON() : job),
      async_processing: true,
    });
  } catch (error) {
    const msg = error.message || String(error);
    return res.status(400).json({
      error: msg,
      message: msg,
    });
  }
};

const getGenerationJob = async (req, res) => {
  try {
    const job = await testCaseGenerationService.getTestCaseGenerationJob(
      Number(req.params.jobId),
    );
    if (!job) return res.status(404).json({ message: "Not found" });
    return res.status(200).json(job);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const listPending = async (req, res) => {
  try {
    const projectId =
      req.query.project_id ||
      (req.query.filters && req.query.filters.project_id);
    if (!projectId) {
      return res.status(400).json({ message: "project_id is required" });
    }
    const helpers = require("../helpers");
    const { page, size } = helpers.normalizePaging(req.query.page, req.query.size);
    const payload = await testCaseGenerationService.listPending(
      Number(projectId),
      page,
      size,
    );
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const approveGenerated = async (req, res) => {
  try {
    const id = Number(req.params.generatedId);
    const row = await testCaseGenerationService.approveTestCaseCandidate(
      id,
      userId(req),
    );
    return res.status(200).json(row);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const rejectGenerated = async (req, res) => {
  try {
    const id = Number(req.params.generatedId);
    const { reason } = req.body || {};
    const row = await testCaseGenerationService.rejectTestCaseCandidate(
      id,
      userId(req),
      reason,
    );
    return res.status(200).json(row);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const approveBatch = async (req, res) => {
  try {
    const { project_id: projectId, candidate_ids: candidateIds } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: "project_id is required" });
    }
    const out = await testCaseGenerationService.bulkApproveTestCaseCandidates({
      projectId: Number(projectId),
      candidateIds: Array.isArray(candidateIds) ? candidateIds : [],
      userId: userId(req),
    });
    return res.status(200).json(out);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const rejectBatch = async (req, res) => {
  try {
    const {
      project_id: projectId,
      candidate_ids: candidateIds,
      reason,
    } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: "project_id is required" });
    }
    const out = await testCaseGenerationService.bulkRejectTestCaseCandidates({
      projectId: Number(projectId),
      candidateIds: Array.isArray(candidateIds) ? candidateIds : [],
      userId: userId(req),
      reason,
    });
    return res.status(200).json(out);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const bulkDiscard = async (req, res) => {
  try {
    const {
      project_id: projectId,
      candidate_ids: candidateIds,
      reason,
    } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: "project_id is required" });
    }
    const out = await testCaseGenerationService.bulkDiscardTestCaseCandidates({
      projectId: Number(projectId),
      candidateIds: Array.isArray(candidateIds) ? candidateIds : [],
      userId: userId(req),
      reason,
    });
    return res.status(200).json(out);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const regenerateSelectedCandidates = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      project_id: projectId,
      candidate_ids: candidateIds,
      user_feedback: userFeedback,
    } = body;

    if (!projectId) {
      return res.status(400).json({ message: "project_id is required" });
    }
    const ids = Array.isArray(candidateIds) ? candidateIds : [];
    const fbRaw = userFeedback != null ? String(userFeedback) : "";
    if (!fbRaw.trim()) {
      return res.status(400).json({ message: "user_feedback is required" });
    }

    const svc = {
      projectId: Number(projectId),
      candidateIds: ids,
      userFeedback: fbRaw.trim(),
      notifyUserId: userId(req),
    };
    if (
      Object.prototype.hasOwnProperty.call(body, "additional_instructions")
    ) {
      svc.additionalInstructionsStored = body.additional_instructions;
    }

    const job =
      await testCaseGenerationService.regeneratePendingTestCaseCandidatesWithFeedback(
        svc,
      );

    return res.status(202).json({
      ...(job?.toJSON ? job.toJSON() : job),
      async_processing: true,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const discardPendingJobs = async (req, res) => {
  try {
    const { project_id: projectId, job_ids: jobIds, reason } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: "project_id is required" });
    }
    const out = await testCaseGenerationService.bulkDiscardPendingTestCaseJobs({
      projectId: Number(projectId),
      jobIds: Array.isArray(jobIds) ? jobIds : [],
      reason,
    });
    return res.status(200).json(out);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

module.exports = {
  generate,
  getGenerationJob,
  listPending,
  approveGenerated,
  rejectGenerated,
  approveBatch,
  rejectBatch,
  bulkDiscard,
  regenerateSelectedCandidates,
  discardPendingJobs,
};
