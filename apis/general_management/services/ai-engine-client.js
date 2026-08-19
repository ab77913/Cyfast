"use strict";

/**
 * HTTP client for the Python ai_engine service (vectorless hybrid RAG).
 *
 * Set AI_ENGINE_URL (or config.ai_engine_url) to e.g. http://localhost:8099
 * When unset, general_management falls back to services/rag-service.js
 *
 * LLM-heavy calls use AI_ENGINE_LLMS_TIMEOUT_MS (default 600000 ms) so they can outlast
 * ai_engine's LLM_HTTP_TIMEOUT_SECONDS; see .env.example.
 */

const axios = require("axios");
const config = require("../config.js");

function baseUrl() {
  const raw = process.env.AI_ENGINE_URL || config.ai_engine_url || "";
  return String(raw).replace(/\/+$/, "");
}

/**
 * Axios timeout for routes that wait on the ai_engine LLM path.
 * Default exceeds ai_engine LLM_HTTP_TIMEOUT_SECONDS (typically 480s) so GM does not
 * abort early with "timeout of 120000ms exceeded". Override with AI_ENGINE_LLMS_TIMEOUT_MS.
 */
function llmsRouteTimeoutMs() {
  const raw =
    process.env.AI_ENGINE_LLMS_TIMEOUT_MS || process.env.AI_ENGINE_TIMEOUT_MS || "";
  const n = Number.parseInt(String(raw).trim(), 10);
  if (Number.isFinite(n) && n >= 30000) {
    return Math.min(n, 3_600_000);
  }
  return 600_000;
}

/**
 * @param {Object} body - snake_case keys matching RagSearchRequest (project_id, query, ...)
 * @returns {Promise<Object|null>} parsed JSON or null when AI engine not configured
 */
async function ragSearch(body) {
  const base = baseUrl();
  if (!base) return null;
  try {
    const { data } = await axios.post(`${base}/v1/rag/search`, body, {
      timeout: 120000,
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (error) {
    console.error(
      "ai_engine ragSearch failed:",
      error.response?.status,
      error.message
    );
    return null;
  }
}

/**
 * Fire-and-forget after project_document.status = INDEXED
 */
async function notifyDocumentIndexed(payload) {
  const base = baseUrl();
  if (!base) return;
  try {
    await axios.post(`${base}/internal/documents/indexed`, payload, {
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.log("ai_engine notifyDocumentIndexed:", error.message);
  }
}

/**
 * @param {Object} body - snake_case: project_id, query, conversation_history?, ...
 * @returns {Promise<Object|null>}
 */
async function ragChat(body) {
  const base = baseUrl();
  if (!base) return null;
  const timeout = llmsRouteTimeoutMs();
  try {
    const { data } = await axios.post(`${base}/v1/rag/chat`, body, {
      timeout,
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (error) {
    console.error(
      "ai_engine ragChat failed:",
      error.response?.status,
      error.message
    );
    return null;
  }
}

function _upstreamErrorPayload(error, label) {
  const status = error.response?.status;
  const data = error.response?.data;
  const detail =
    (typeof data === "string" && data) ||
    data?.detail ||
    data?.message ||
    data?.error ||
    error.message;
  console.error(`${label} failed:`, status, detail);
  return {
    status: "upstream_failed",
    message: `AI engine request failed${status ? ` (HTTP ${status})` : ""}: ${detail}`,
    http_status: status,
  };
}

async function generateRequirementsFromDocuments(body) {
  const base = baseUrl();
  if (!base) return null;
  const timeout = llmsRouteTimeoutMs();
  try {
    const { data } = await axios.post(
      `${base}/v1/requirements/generate_from_documents`,
      body,
      {
        timeout,
        headers: { "Content-Type": "application/json" },
      }
    );
    return data;
  } catch (error) {
    return _upstreamErrorPayload(error, "ai_engine generateRequirementsFromDocuments");
  }
}

async function regenerateRequirementsFromDocuments(body) {
  const base = baseUrl();
  if (!base) return null;
  const timeout = llmsRouteTimeoutMs();
  try {
    const { data } = await axios.post(
      `${base}/v1/requirements/regenerate_from_documents`,
      body,
      {
        timeout,
        headers: { "Content-Type": "application/json" },
      }
    );
    return data;
  } catch (error) {
    return _upstreamErrorPayload(
      error,
      "ai_engine regenerateRequirementsFromDocuments"
    );
  }
}

/** POST snake_case bodies to ai_engine generation_validation endpoints */
async function postGenerationValidation(pathSuffix, body) {
  const base = baseUrl();
  if (!base) return null;
  const timeout = llmsRouteTimeoutMs();
  try {
    const { data } = await axios.post(
      `${base}/v1/generation_validation/${pathSuffix}`,
      body,
      {
        timeout,
        headers: { "Content-Type": "application/json" },
      }
    );
    return data;
  } catch (error) {
    console.error(
      "ai_engine postGenerationValidation failed:",
      pathSuffix,
      error.response?.status,
      error.message
    );
    return null;
  }
}

async function validateGeneratedRequirements(body) {
  return await postGenerationValidation("requirements", body);
}

async function validateGeneratedTestCases(body) {
  return await postGenerationValidation("test_cases", body);
}

async function validateGeneratedTestScenarios(body) {
  return await postGenerationValidation("test_scenarios", body);
}

async function validateGenericGeneratedArtifact(body) {
  return await postGenerationValidation("other", body);
}

async function generateTestScenariosFromRequirements(body) {
  const base = baseUrl();
  if (!base) return null;
  const timeout = llmsRouteTimeoutMs();
  try {
    const { data } = await axios.post(
      `${base}/v1/test_scenarios/generate_from_requirements`,
      body,
      {
        timeout,
        headers: { "Content-Type": "application/json" },
      },
    );
    return data;
  } catch (error) {
    return _upstreamErrorPayload(
      error,
      "ai_engine generateTestScenariosFromRequirements",
    );
  }
}

async function regenerateTestScenariosFromRequirements(body) {
  const base = baseUrl();
  if (!base) return null;
  const timeout = llmsRouteTimeoutMs();
  try {
    const { data } = await axios.post(
      `${base}/v1/test_scenarios/regenerate_from_requirements`,
      body,
      {
        timeout,
        headers: { "Content-Type": "application/json" },
      },
    );
    return data;
  } catch (error) {
    return _upstreamErrorPayload(
      error,
      "ai_engine regenerateTestScenariosFromRequirements",
    );
  }
}

async function generateTestCasesFromScenarios(body) {
  const base = baseUrl();
  if (!base) return null;
  const timeout = llmsRouteTimeoutMs();
  try {
    const { data } = await axios.post(
      `${base}/v1/test_cases/generate_from_scenarios`,
      body,
      {
        timeout,
        headers: { "Content-Type": "application/json" },
      },
    );
    return data;
  } catch (error) {
    return _upstreamErrorPayload(
      error,
      "ai_engine generateTestCasesFromScenarios",
    );
  }
}

async function regenerateTestCasesFromScenarios(body) {
  const base = baseUrl();
  if (!base) return null;
  const timeout = llmsRouteTimeoutMs();
  try {
    const { data } = await axios.post(
      `${base}/v1/test_cases/regenerate_from_scenarios`,
      body,
      {
        timeout,
        headers: { "Content-Type": "application/json" },
      },
    );
    return data;
  } catch (error) {
    return _upstreamErrorPayload(
      error,
      "ai_engine regenerateTestCasesFromScenarios",
    );
  }
}

module.exports = {
  baseUrl,
  llmsRouteTimeoutMs,
  ragSearch,
  ragChat,
  generateRequirementsFromDocuments,
  regenerateRequirementsFromDocuments,
  generateTestScenariosFromRequirements,
  regenerateTestScenariosFromRequirements,
  generateTestCasesFromScenarios,
  regenerateTestCasesFromScenarios,
  validateGeneratedRequirements,
  validateGeneratedTestCases,
  validateGeneratedTestScenarios,
  validateGenericGeneratedArtifact,
  notifyDocumentIndexed,
};
