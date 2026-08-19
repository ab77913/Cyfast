"use strict";

const R = { 200: { description: "OK" } };

const jsonBody = {
  requestBody: {
    content: {
      "application/json": {
        schema: { type: "object", additionalProperties: true },
      },
    },
  },
};

function intPath(name) {
  return [
    {
      name,
      in: "path",
      required: true,
      schema: { type: "integer" },
    },
  ];
}

function strPath(name) {
  return [
    {
      name,
      in: "path",
      required: true,
      schema: { type: "string" },
    },
  ];
}

/** @param {object} config */
function buildOpenApiSpec(config) {
  return {
    openapi: "3.0.3",
    info: {
      title: "CyFAST General Management API",
      version: "1.0.0",
      description:
        "Projects, orchestrations, requirements, risks, traceability, test assets, dashboards, and test agents.",
    },
    servers: [{ url: config.url }],
    tags: [
      { name: "Health" },
      { name: "Dashboard" },
      { name: "Projects" },
      { name: "Orchestrations" },
      { name: "Traceability" },
      { name: "Requirements" },
      { name: "Risks" },
      { name: "Test sources" },
      { name: "Test suites" },
      { name: "Test scripts" },
      { name: "Test cases" },
      { name: "Test agents" },
    ],
    paths: {
      "/": {
        get: {
          tags: ["Health"],
          summary: "Service check",
          responses: { ...R },
        },
      },
      "/dashboard/kpis": {
        get: {
          tags: ["Dashboard"],
          summary: "Dashboard KPIs",
          responses: { ...R },
        },
      },
      "/dashboard/details": {
        get: {
          tags: ["Dashboard"],
          summary: "Dashboard details",
          responses: { ...R },
        },
      },
      "/projects": {
        get: {
          tags: ["Projects"],
          summary: "List projects",
          responses: { ...R },
        },
        post: {
          tags: ["Projects"],
          summary: "Create project",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/projects/{projectId}": {
        parameters: intPath("projectId"),
        get: {
          tags: ["Projects"],
          summary: "Get project",
          responses: { ...R },
        },
        post: {
          tags: ["Projects"],
          summary: "Update project",
          ...jsonBody,
          responses: { ...R },
        },
        delete: {
          tags: ["Projects"],
          summary: "Delete project",
          responses: { ...R },
        },
      },
      "/projects/{projectId}/summary": {
        parameters: intPath("projectId"),
        get: {
          tags: ["Projects"],
          summary: "Project summary",
          responses: { ...R },
        },
      },
      "/projects/{projectId}/test_agents": {
        parameters: intPath("projectId"),
        get: {
          tags: ["Projects"],
          summary: "List test agents mapped to project",
          responses: { ...R },
        },
        post: {
          tags: ["Projects"],
          summary: "Update test agents on project",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/projects/{projectId}/test_agents/{testAgentId}": {
        parameters: [
          ...intPath("projectId"),
          ...strPath("testAgentId"),
        ],
        delete: {
          tags: ["Projects"],
          summary: "Detach test agent from project",
          responses: { ...R },
        },
      },
      "/projects/{projectId}/configuration": {
        parameters: intPath("projectId"),
        get: {
          tags: ["Projects"],
          summary: "Get project configuration",
          responses: { ...R },
        },
        post: {
          tags: ["Projects"],
          summary: "Update project configuration",
          ...jsonBody,
          responses: { ...R },
        },
        delete: {
          tags: ["Projects"],
          summary: "Delete project configuration",
          responses: { ...R },
        },
      },
      "/projects/{projectId}/executions": {
        parameters: intPath("projectId"),
        get: {
          tags: ["Projects"],
          summary: "List project executions",
          responses: { ...R },
        },
      },
      "/projects/{projectId}/executions/top_failures": {
        parameters: intPath("projectId"),
        get: {
          tags: ["Projects"],
          summary: "Top failure executions",
          responses: { ...R },
        },
      },
      "/projects/{projectId}/executions/statistics": {
        parameters: intPath("projectId"),
        get: {
          tags: ["Projects"],
          summary: "Execution statistics",
          responses: { ...R },
        },
      },
      "/projects/{projectId}/executions/statistics/requirement_wise": {
        parameters: intPath("projectId"),
        get: {
          tags: ["Projects"],
          summary: "Requirement-wise execution statistics",
          responses: { ...R },
        },
      },
      "/projects/{projectId}/executions/total_duration": {
        parameters: intPath("projectId"),
        get: {
          tags: ["Projects"],
          summary: "Total execution duration",
          responses: { ...R },
        },
      },
      "/projects/{projectId}/executions/latest": {
        parameters: intPath("projectId"),
        get: {
          tags: ["Projects"],
          summary: "Latest executions",
          responses: { ...R },
        },
      },
      "/orchestrations": {
        get: {
          tags: ["Orchestrations"],
          summary: "List orchestrations",
          responses: { ...R },
        },
        post: {
          tags: ["Orchestrations"],
          summary: "Create orchestration",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}": {
        parameters: intPath("orchestrationId"),
        get: {
          tags: ["Orchestrations"],
          summary: "Get orchestration",
          responses: { ...R },
        },
        post: {
          tags: ["Orchestrations"],
          summary: "Update orchestration",
          ...jsonBody,
          responses: { ...R },
        },
        delete: {
          tags: ["Orchestrations"],
          summary: "Delete orchestration",
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/test_cases": {
        parameters: intPath("orchestrationId"),
        get: {
          tags: ["Orchestrations"],
          summary: "Get orchestration test cases",
          responses: { ...R },
        },
        post: {
          tags: ["Orchestrations"],
          summary: "Update orchestration test cases",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/test_cases/executions": {
        parameters: intPath("orchestrationId"),
        get: {
          tags: ["Orchestrations"],
          summary: "Test case executions for orchestration",
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/configurations": {
        parameters: intPath("orchestrationId"),
        get: {
          tags: ["Orchestrations"],
          summary: "List orchestration configurations",
          responses: { ...R },
        },
        post: {
          tags: ["Orchestrations"],
          summary: "Add orchestration configuration",
          ...jsonBody,
          responses: { ...R },
        },
        delete: {
          tags: ["Orchestrations"],
          summary: "Delete orchestration configurations",
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/configurations/{projectConfigurationId}": {
        parameters: [
          ...intPath("orchestrationId"),
          ...intPath("projectConfigurationId"),
        ],
        post: {
          tags: ["Orchestrations"],
          summary: "Update orchestration configuration",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/executions": {
        parameters: intPath("orchestrationId"),
        get: {
          tags: ["Orchestrations"],
          summary: "List orchestration executions",
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/executions/latest": {
        parameters: intPath("orchestrationId"),
        get: {
          tags: ["Orchestrations"],
          summary: "Latest orchestration execution",
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/executions/statistics": {
        parameters: intPath("orchestrationId"),
        get: {
          tags: ["Orchestrations"],
          summary: "Orchestration execution statistics",
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/executions/trends": {
        parameters: intPath("orchestrationId"),
        get: {
          tags: ["Orchestrations"],
          summary: "Orchestration execution trends",
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/start_execution": {
        parameters: intPath("orchestrationId"),
        post: {
          tags: ["Orchestrations"],
          summary: "Start orchestration execution",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/pause_execution": {
        parameters: intPath("orchestrationId"),
        post: {
          tags: ["Orchestrations"],
          summary: "Pause orchestration execution",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/resume_execution": {
        parameters: intPath("orchestrationId"),
        post: {
          tags: ["Orchestrations"],
          summary: "Resume orchestration execution",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/orchestrations/{orchestrationId}/stop_execution": {
        parameters: intPath("orchestrationId"),
        post: {
          tags: ["Orchestrations"],
          summary: "Stop orchestration execution",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/traceability": {
        get: {
          tags: ["Traceability"],
          summary: "Get traceability matrix",
          responses: { ...R },
        },
      },
      "/traceability/end_to_end": {
        get: {
          tags: ["Traceability"],
          summary: "End-to-end traceability",
          responses: { ...R },
        },
      },
      "/traceability/imports": {
        get: {
          tags: ["Traceability"],
          summary: "List traceability imports",
          responses: { ...R },
        },
      },
      "/traceability/insights": {
        get: {
          tags: ["Traceability"],
          summary: "Traceability insights",
          responses: { ...R },
        },
      },
      "/traceability/statistics": {
        get: {
          tags: ["Traceability"],
          summary: "Traceability statistics",
          responses: { ...R },
        },
      },
      "/traceability/export": {
        get: {
          tags: ["Traceability"],
          summary: "Export traceability",
          responses: { ...R },
        },
      },
      "/traceability/import": {
        post: {
          tags: ["Traceability"],
          summary: "Import traceability (multipart)",
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          responses: { ...R },
        },
      },
      "/traceability/import/resume": {
        post: {
          tags: ["Traceability"],
          summary: "Resume traceability import",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/traceability/import/discard": {
        post: {
          tags: ["Traceability"],
          summary: "Discard traceability import",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/requirements": {
        get: {
          tags: ["Requirements"],
          summary: "List requirements",
          responses: { ...R },
        },
        post: {
          tags: ["Requirements"],
          summary: "Create requirement",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/requirements/{requirementId}": {
        parameters: intPath("requirementId"),
        get: {
          tags: ["Requirements"],
          summary: "Get requirement",
          responses: { ...R },
        },
        post: {
          tags: ["Requirements"],
          summary: "Update requirement",
          ...jsonBody,
          responses: { ...R },
        },
        delete: {
          tags: ["Requirements"],
          summary: "Delete requirement",
          responses: { ...R },
        },
      },
      "/risks": {
        get: {
          tags: ["Risks"],
          summary: "List risks",
          responses: { ...R },
        },
        post: {
          tags: ["Risks"],
          summary: "Create risk",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/risks/{riskId}": {
        parameters: intPath("riskId"),
        get: {
          tags: ["Risks"],
          summary: "Get risk",
          responses: { ...R },
        },
        post: {
          tags: ["Risks"],
          summary: "Update risk",
          ...jsonBody,
          responses: { ...R },
        },
        delete: {
          tags: ["Risks"],
          summary: "Delete risk",
          responses: { ...R },
        },
      },
      "/test_sources": {
        get: {
          tags: ["Test sources"],
          summary: "List test sources",
          responses: { ...R },
        },
        post: {
          tags: ["Test sources"],
          summary: "Create test source",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/test_sources/{testSourceId}": {
        parameters: intPath("testSourceId"),
        get: {
          tags: ["Test sources"],
          summary: "Get test source",
          responses: { ...R },
        },
        post: {
          tags: ["Test sources"],
          summary: "Update test source",
          ...jsonBody,
          responses: { ...R },
        },
        delete: {
          tags: ["Test sources"],
          summary: "Delete test source",
          responses: { ...R },
        },
      },
      "/test_sources/{testSourceId}/import": {
        parameters: intPath("testSourceId"),
        post: {
          tags: ["Test sources"],
          summary: "Import test cases from source",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/test_suites": {
        get: {
          tags: ["Test suites"],
          summary: "List test suites",
          responses: { ...R },
        },
        post: {
          tags: ["Test suites"],
          summary: "Create test suite",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/test_suites/{testSuiteId}": {
        parameters: intPath("testSuiteId"),
        get: {
          tags: ["Test suites"],
          summary: "Get test suite",
          responses: { ...R },
        },
        post: {
          tags: ["Test suites"],
          summary: "Update test suite",
          ...jsonBody,
          responses: { ...R },
        },
        delete: {
          tags: ["Test suites"],
          summary: "Delete test suite",
          responses: { ...R },
        },
      },
      "/test_scripts": {
        get: {
          tags: ["Test scripts"],
          summary: "List test scripts",
          responses: { ...R },
        },
        post: {
          tags: ["Test scripts"],
          summary: "Create test script",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/test_scripts/{testScriptId}": {
        parameters: intPath("testScriptId"),
        get: {
          tags: ["Test scripts"],
          summary: "Get test script",
          responses: { ...R },
        },
        post: {
          tags: ["Test scripts"],
          summary: "Update test script",
          ...jsonBody,
          responses: { ...R },
        },
        delete: {
          tags: ["Test scripts"],
          summary: "Delete test script",
          responses: { ...R },
        },
      },
      "/test_cases": {
        get: {
          tags: ["Test cases"],
          summary: "List test cases",
          responses: { ...R },
        },
        post: {
          tags: ["Test cases"],
          summary: "Create test case",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/test_cases/{testCaseId}": {
        parameters: intPath("testCaseId"),
        get: {
          tags: ["Test cases"],
          summary: "Get test case",
          responses: { ...R },
        },
        post: {
          tags: ["Test cases"],
          summary: "Update test case",
          ...jsonBody,
          responses: { ...R },
        },
        delete: {
          tags: ["Test cases"],
          summary: "Delete test case",
          responses: { ...R },
        },
      },
      "/test_cases/{testCaseId}/start_execution": {
        parameters: intPath("testCaseId"),
        post: {
          tags: ["Test cases"],
          summary: "Start single test case execution",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/test_agents": {
        get: {
          tags: ["Test agents"],
          summary: "List test agents",
          responses: { ...R },
        },
      },
      "/test_agents/bulk_delete": {
        post: {
          tags: ["Test agents"],
          summary: "Delete multiple test agents",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["test_agent_ids"],
                  properties: {
                    test_agent_ids: {
                      type: "array",
                      items: { type: "string" },
                      minItems: 1,
                    },
                  },
                },
              },
            },
          },
          responses: { ...R },
        },
      },
      "/test_agents/bulk_map_projects": {
        post: {
          tags: ["Test agents"],
          summary: "Map the same projects to multiple test agents",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["test_agent_ids"],
                  properties: {
                    test_agent_ids: {
                      type: "array",
                      items: { type: "string" },
                      minItems: 1,
                    },
                    project_ids: {
                      type: "array",
                      items: { type: "integer" },
                      description: "Projects to assign (replaces prior mapping per agent); empty clears mappings",
                    },
                  },
                },
              },
            },
          },
          responses: { ...R },
        },
      },
      "/test_agents/{testAgentId}": {
        parameters: strPath("testAgentId"),
        get: {
          tags: ["Test agents"],
          summary: "Get test agent",
          responses: { ...R },
        },
        delete: {
          tags: ["Test agents"],
          summary: "Delete test agent",
          responses: { ...R },
        },
      },
      "/test_agents/{testAgentId}/stop": {
        parameters: strPath("testAgentId"),
        post: {
          tags: ["Test agents"],
          summary: "Stop test agent",
          ...jsonBody,
          responses: { ...R },
        },
      },
      "/test_agents/{testAgentId}/projects": {
        parameters: strPath("testAgentId"),
        post: {
          tags: ["Test agents"],
          summary: "Map projects to test agent",
          ...jsonBody,
          responses: { ...R },
        },
      },
    },
  };
}

module.exports = { buildOpenApiSpec };
