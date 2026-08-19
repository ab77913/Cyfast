"use strict";

const config = require("../config.js");
const testAgentFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-agent-factory");

const testAgentService = require("../services/test-agent-service.js");

/**
 * @description Get all testAgents
 * @param {Object} req
 * @param {Object} res
 * @returns {Object} testAgents
 * @todo Add authentication
 * @todo Add authorization
 * @todo Add pagination
 * @todo Add search
 * @todo Add sort
 * @todo Add filter
 * @todo Add validation
 * @todo Add error handling
 * @todo Add logging
 * @todo Add unit tests
 * @todo Add integration tests
 * @todo Add e2e tests
 * @todo Add caching
 * @todo Add monitoring
 * @example
 * GET /api/v1/testAgents
 *
 * */

const getTestAgents = async (req, res, next) => {
  try {
    const { page, size, filters, sort, include } = req.query;

    const testAgents = await testAgentFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );

    return res.status(200).json(testAgents);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getTestAgent = async (req, res, next) => {
  try {
    const testAgentId = req.params.testAgentId;

    const testAgent = await testAgentFactory.getById(testAgentId);

    return res.status(200).json(testAgent);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const stopTestAgent = async (req, res, next) => {
  try {
    const testAgentId = req.params.testAgentId;

    const testAgent = await testAgentFactory.getById(testAgentId);
    const isStopped = await testAgentService.requestStopTestAgent(testAgent);

    return res.status(200).json(isStopped);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteTestAgent = async (req, res, next) => {
  try {
    const testAgentId = req.params.testAgentId;

    const testAgent = await testAgentFactory.remove(testAgentId);

    return res.status(200).json(testAgent);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const mapProjects = async (req, res, next) => {
  try {
    const testAgentId = req.params.testAgentId;
    const raw = req.body.project_ids;
    const projectIds = Array.isArray(raw)
      ? raw.map((p) => Number(p)).filter((n) => Number.isFinite(n) && n > 0)
      : [];

    const testAgent = await testAgentFactory.getById(testAgentId);
    if (!testAgent) {
      return res.status(500).json("Test agent not found");
    }

    await testAgentService.mapProjects(testAgent, projectIds);

    return res.status(200).json(true);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const bulkDeleteTestAgents = async (req, res) => {
  try {
    const ids = req.body?.test_agent_ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: "test_agent_ids is required (non-empty array)",
      });
    }

    const results = [];
    for (const rawId of ids) {
      const id = String(rawId).trim();
      if (!id) continue;
      try {
        await testAgentFactory.remove(id);
        results.push({ test_agent_id: id, ok: true });
      } catch (e) {
        results.push({
          test_agent_id: id,
          ok: false,
          error: e.message || String(e),
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;
    return res.status(200).json({ succeeded, failed, results });
  } catch (error) {
    return res.status(500).json(error?.message || error);
  }
};

/** Apply the same project_ids mapping to every agent in test_agent_ids */
const bulkMapProjects = async (req, res) => {
  try {
    const ids = req.body?.test_agent_ids;
    const rawProjectIds = req.body?.project_ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: "test_agent_ids is required (non-empty array)",
      });
    }

    const projectIds =
      Array.isArray(rawProjectIds)
        ? rawProjectIds
            .map((p) => Number(p))
            .filter((n) => Number.isFinite(n) && n > 0)
        : [];

    const results = [];
    for (const rawId of ids) {
      const id = String(rawId).trim();
      if (!id) continue;
      try {
        const testAgent = await testAgentFactory.getById(id);
        if (!testAgent) {
          results.push({
            test_agent_id: id,
            ok: false,
            error: "Test agent not found",
          });
          continue;
        }
        await testAgentService.mapProjects(testAgent, projectIds);
        results.push({ test_agent_id: id, ok: true });
      } catch (e) {
        results.push({
          test_agent_id: id,
          ok: false,
          error: e.message || String(e),
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;
    return res.status(200).json({ succeeded, failed, results });
  } catch (error) {
    return res.status(500).json(error?.message || error);
  }
};

module.exports = {
  getTestAgents,
  getTestAgent,
  deleteTestAgent,
  stopTestAgent,
  mapProjects,
  bulkDeleteTestAgents,
  bulkMapProjects,
};
