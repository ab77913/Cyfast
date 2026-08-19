"use strict";

const helpers = require("../helpers");
const testScenarioGenerationService = require("../services/test-scenario-generation-service");

function userId(req) {
  return req.headers["x-user-id"] || "system";
}

const createJob = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      project_id: projectId,
      organization_id: organizationId,
      all_approved: allApproved,
      requirement_ids: requirementIds,
      scenario_types: scenarioTypes,
      safety_options: safetyOptions,
    } = body;

    if (!projectId)
      return res.status(400).json({ message: "project_id is required" });
    if (organizationId == null)
      return res.status(400).json({ message: "organization_id is required" });

    const job = await testScenarioGenerationService.createScenarioGenerationJob({
      projectId: Number(projectId),
      organizationId: Number(organizationId),
      allApproved: Boolean(allApproved),
      requirementIds: Array.isArray(requirementIds) ? requirementIds : [],
      scenarioTypes: Array.isArray(scenarioTypes) ? scenarioTypes : [],
      safetyOptions: safetyOptions && typeof safetyOptions === "object" ? safetyOptions : {},
      userId: userId(req),
      ...(Object.prototype.hasOwnProperty.call(
        body,
        "additional_instructions",
      )
        ? { additionalInstructions: body.additional_instructions }
        : {}),
    });

    return res.status(202).json({
      ...(job?.toJSON ? job.toJSON() : job),
      async_processing: true,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const listJobs = async (req, res) => {
  try {
    const projectId =
      req.query.project_id ||
      (req.query.filters && req.query.filters.project_id);
    if (!projectId)
      return res.status(400).json({ message: "project_id is required" });
    const data = await testScenarioGenerationService.listJobs(
      Number(projectId),
      req.query,
    );
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getJob = async (req, res) => {
  try {
    const job = await testScenarioGenerationService.getScenarioJob(
      Number(req.params.jobId),
    );
    if (!job) return res.status(404).json({ message: "Not found" });
    return res.status(200).json(job);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const regenerateJob = async (req, res) => {
  try {
    const body = req.body || {};
    const jobId = Number(req.params.jobId);
    const { user_feedback: userFeedback } = body;
    if (!userFeedback || !String(userFeedback).trim()) {
      return res.status(400).json({ message: "user_feedback is required" });
    }
    const svc = {
      jobId,
      userFeedback: String(userFeedback).trim(),
      notifyUserId: userId(req),
    };
    if (
      Object.prototype.hasOwnProperty.call(body, "additional_instructions")
    ) {
      svc.additionalInstructionsStored = body.additional_instructions;
    }
    const job = await testScenarioGenerationService.regenerateScenarioJob(svc);
    return res.status(202).json({
      ...(job?.toJSON ? job.toJSON() : job),
      async_processing: true,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const listPending = async (req, res) => {
  try {
    const projectId =
      req.query.project_id ||
      (req.query.filters && req.query.filters.project_id);
    if (!projectId)
      return res.status(400).json({ message: "project_id is required" });
    const { page, size } = helpers.normalizePaging(req.query.page, req.query.size);
    const payload = await testScenarioGenerationService.listPending(
      Number(projectId),
      page,
      size,
    );
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const approveCandidate = async (req, res) => {
  try {
    const id = Number(req.params.candidateId);
    const row = await testScenarioGenerationService.approveScenarioCandidate(
      id,
      userId(req),
    );
    return res.status(200).json(row);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const rejectCandidate = async (req, res) => {
  try {
    const id = Number(req.params.candidateId);
    const { reason } = req.body || {};
    const row = await testScenarioGenerationService.rejectScenarioCandidate(
      id,
      userId(req),
      reason,
    );
    return res.status(200).json(row);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const bulkApprove = async (req, res) => {
  try {
    const {
      project_id: projectId,
      candidate_ids: candidateIds,
    } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: "project_id is required" });
    }
    const out = await testScenarioGenerationService.bulkApproveScenarioCandidates({
      projectId: Number(projectId),
      candidateIds: Array.isArray(candidateIds) ? candidateIds : [],
      userId: userId(req),
    });
    return res.status(200).json(out);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const bulkReject = async (req, res) => {
  try {
    const {
      project_id: projectId,
      candidate_ids: candidateIds,
      reason,
    } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: "project_id is required" });
    }
    const out = await testScenarioGenerationService.bulkRejectScenarioCandidates({
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
    const out = await testScenarioGenerationService.bulkDiscardScenarioCandidates({
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

    if (!projectId)
      return res.status(400).json({ message: "project_id is required" });
    const ids = Array.isArray(candidateIds) ? candidateIds : [];
    const fbRaw = userFeedback != null ? String(userFeedback) : "";
    if (!fbRaw.trim())
      return res.status(400).json({ message: "user_feedback is required" });

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
      await testScenarioGenerationService.regeneratePendingScenarioCandidatesWithFeedback(
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

const bulkRegenerateJobs = async (req, res) => {
  try {
    const {
      project_id: projectId,
      job_ids: jobIds,
      user_feedback: userFeedback,
    } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: "project_id is required" });
    }
    const out =
      await testScenarioGenerationService.bulkRegenerateScenarioJobs({
        projectId: Number(projectId),
        jobIds: Array.isArray(jobIds) ? jobIds : [],
        userFeedback,
        notifyUserId: userId(req),
      });
    return res.status(200).json(out);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const discardPendingJobs = async (req, res) => {
  try {
    const {
      project_id: projectId,
      job_ids: jobIds,
      reason,
    } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: "project_id is required" });
    }
    const out = await testScenarioGenerationService.bulkDiscardPendingScenarioJobs({
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
  createJob,
  listJobs,
  getJob,
  regenerateJob,
  listPending,
  approveCandidate,
  rejectCandidate,
  bulkApprove,
  bulkReject,
  bulkDiscard,
  regenerateSelectedCandidates,
  bulkRegenerateJobs,
  discardPendingJobs,
};
