"use strict";

const aiEngineClient = require("../services/ai-engine-client");

/**
 * Validates AI-generated requirement drafts via ai_engine rubric agent.
 */
const validateRequirements = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.project_id) {
      return res.status(400).json({ error: "project_id is required" });
    }
    if (!Array.isArray(payload.drafts) || payload.drafts.length === 0) {
      return res.status(400).json({
        error: "drafts is required (non-empty array)",
      });
    }

    const data = await aiEngineClient.validateGeneratedRequirements(payload);
    if (!data) {
      return res.status(503).json({
        error:
          "AI engine is not configured (set AI_ENGINE_URL) or request failed.",
      });
    }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Validates AI-generated test case drafts vs optional source requirement rows.
 */
const validateTestCases = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.project_id) {
      return res.status(400).json({ error: "project_id is required" });
    }
    if (
      !Array.isArray(payload.test_case_drafts) ||
      payload.test_case_drafts.length === 0
    ) {
      return res.status(400).json({
        error: "test_case_drafts is required (non-empty array)",
      });
    }

    const data = await aiEngineClient.validateGeneratedTestCases(payload);
    if (!data) {
      return res.status(503).json({
        error:
          "AI engine is not configured (set AI_ENGINE_URL) or request failed.",
      });
    }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Custom checklist validation for arbitrary generated artifacts (risks, etc.).
 */
const validateOther = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.project_id) {
      return res.status(400).json({ error: "project_id is required" });
    }
    if (
      typeof payload.artifact_summary !== "string" ||
      !payload.artifact_summary.trim()
    ) {
      return res.status(400).json({ error: "artifact_summary is required" });
    }
    if (
      !Array.isArray(payload.checklist) ||
      payload.checklist.length === 0
    ) {
      return res.status(400).json({ error: "checklist is required" });
    }
    if (!payload.artifact_type || !String(payload.artifact_type).trim()) {
      return res.status(400).json({ error: "artifact_type is required" });
    }

    const data =
      await aiEngineClient.validateGenericGeneratedArtifact(payload);
    if (!data) {
      return res.status(503).json({
        error:
          "AI engine is not configured (set AI_ENGINE_URL) or request failed.",
      });
    }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Validates AI-generated test scenario drafts vs linked requirement context.
 */
const validateTestScenarios = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.project_id) {
      return res.status(400).json({ error: "project_id is required" });
    }
    if (
      !Array.isArray(payload.scenario_drafts) ||
      payload.scenario_drafts.length === 0
    ) {
      return res.status(400).json({
        error: "scenario_drafts is required (non-empty array)",
      });
    }

    const data = await aiEngineClient.validateGeneratedTestScenarios(payload);
    if (!data) {
      return res.status(503).json({
        error:
          "AI engine is not configured (set AI_ENGINE_URL) or request failed.",
      });
    }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  validateRequirements,
  validateTestCases,
  validateTestScenarios,
  validateOther,
};
