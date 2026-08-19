import cyfastAxios from './cyfastAxios';
import cylogAxios from './cylogAxios';
import cyuserAxios from './cyuserAxios';

// Get Test Agents
export const getTestAgents = async (filters = {}) => {
  // Convert filters object to URLSearchParams
  // This will create a query string from the filters object
  // e.g., { status: 'active', projectId: 123 } will become 'filters[status]=active&filters[projectId]=123'
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null) {
      params.append(`filters[${key}]`, filters[key]);
    }
  });
  return await cyfastAxios.get(`/test_agents?include[]=project_ids&${params.toString()}`);
};

// Get a single test agent by ID
export const getTestAgentById = async (testAgentId) => {
  return await cyfastAxios.get(`/test_agents/${testAgentId}`);
};

// Delete a test agent
export const deleteTestAgent = async (testAgentId) => {
  return await cyfastAxios.delete(`/test_agents/${testAgentId}`);
};

// Delete a test agent
export const stopTestAgent = async (testAgentId) => {
  return await cyfastAxios.post(`/test_agents/${testAgentId}/stop`);
};

// Map Projects to a test agent
export const mapProjectsToAgent = async (testAgentId, project_ids) => {
  return await cyfastAxios.post(`/test_agents/${testAgentId}/projects`, { project_ids });
};

/** Body: { test_agent_ids: string[] } → { succeeded, failed, results } */
export const bulkDeleteTestAgents = async (test_agent_ids) => {
  return await cyfastAxios.post(`/test_agents/bulk_delete`, { test_agent_ids });
};

/** Body: { test_agent_ids: string[], project_ids: number[] } → { succeeded, failed, results } */
export const bulkMapProjectsToAgents = async (test_agent_ids, project_ids) => {
  return await cyfastAxios.post(`/test_agents/bulk_map_projects`, { test_agent_ids, project_ids });
};

// Projects List
// Get all projects list
export const getProjects = async () => {
  return await cyfastAxios.get('/projects');
};

// Get a single project by ID
export const getProjectById = async (projectId) => {
  return await cyfastAxios.get(`/projects/${projectId}`);
};

// Add a new project
export const addProject = async (projectData) => {
  return await cyfastAxios.post('/projects', projectData);
};

// Update an existing project
export const updateProject = async (projectId, projectData) => {
  return await cyfastAxios.post(`/projects/${projectId}`, projectData);
};

// Delete a project
export const deleteProject = async (projectId) => {
  return await cyfastAxios.delete(`/projects/${projectId}`);
};

// Project Configuration
// getConfigurations for a project
export const getProjectConfiguration = (projectId) => {
  return cyfastAxios.get(`/projects/${projectId}/configuration`);
};

// addConfigurations for a project
export const updateProjectConfiguration = (projectId, payload) => {
  return cyfastAxios.post(`/projects/${projectId}/configuration`, payload);
};

// get project summary
export const getProjectSummary = (projectId) => {
  return cyfastAxios.get(`/projects/${projectId}/summary`);
};

// get project execution stats
export const getProjectExecutionStats = (projectId) => {
  return cyfastAxios.get(`/projects/${projectId}/executions/statistics`);
};

// get project execution history
export const getProjectExecutionHistory = (projectId) => {
  return cyfastAxios.get(`/projects/${projectId}/executions/latest`);
};

// get project most failed test cases
export const getProjectMostFailedTestCases = (projectId) => {
  return cyfastAxios.get(`/projects/${projectId}/executions/top_failures`);
};

// Orchestrations APIS
// get Orchestrations List
export const getOrchestrations = (projectId) => {
  return cyfastAxios.get(`/orchestrations?filters[project_id]=${projectId}`);
};

// to Add New Orchestration
export const createOrchestration = (payload) => {
  return cyfastAxios.post('/orchestrations', payload);
};

// get a Orchestrations details
export const getOrchestration = (orchestrationId) => {
  return cyfastAxios.get(`/orchestrations/${orchestrationId}`);
};

// edit/update a Orchestrations test
export const updateOrchestration = (orchestrationId, payload) => {
  return cyfastAxios.post(`/orchestrations/${orchestrationId}`, payload);
};

// delete a Orchestrations
export const deleteOrchestration = (orchestrationId) => {
  return cyfastAxios.delete(`/orchestrations/${orchestrationId}`);
};

// get orchestration tests
export const getOrchestrationTests = (orchestrationId) => {
  return cyfastAxios.get(`/orchestrations/${orchestrationId}/test_cases?include=test_script,test_case`);
};

// get Orchestrations executions (note function name retained exactly)
export const getOrchestrationExecutions = (orchestrationId) => {
  return cyfastAxios.get(`/orchestrations/${orchestrationId}/executions`);
};

// get a single orchestration execution by ID
export const getOrchestrationExecution = (orchestrationId, executionId) => {
  return cyfastAxios.get(`/orchestrations/${orchestrationId}/executions/${executionId}`);
};

// get latest orchestration execution
export const getLatestOrchestrationExecution = (orchestrationId) => {
  return cyfastAxios.get(`/orchestrations/${orchestrationId}/executions/latest`);
};

// get orchestration execution stats
export const getOrchestrationExecutionStats = (orchestrationId) => {
  return cyfastAxios.get(`/orchestrations/${orchestrationId}/executions/statistics`);
};

// get orchestration execution trends
export const getOrchestrationExecutionTrends = (orchestrationId, fromDate) => {
  return cyfastAxios.get(`/orchestrations/${orchestrationId}/executions/trends?from_date=${fromDate}`);
};

export const startOrchestrationExecution = (orchestrationId, testAgents) => {
  return cyfastAxios.post(`/orchestrations/${orchestrationId}/start_execution`, testAgents);
};

export const pauseOrchestrationExecution = (orchestrationId) => {
  return cyfastAxios.post(`/orchestrations/${orchestrationId}/pause_execution`);
};

export const stopOrchestrationExecution = (orchestrationId) => {
  return cyfastAxios.post(`/orchestrations/${orchestrationId}/stop_execution`);
};

// Inventory APIS
// Add Test Sources for Inventory -> Test Cases
export const addTestSource = (payload) => {
  return cyfastAxios.post('/test_sources', payload);
};

// Get Test Sources of the Project Inventory -> Test Cases
export const getTestSourcesForProject = (projectId) => {
  return cyfastAxios.get(`/test_sources?filters[project_id]=${projectId}`);
};

// Update / Edit the existing Test Sources of the Project Inventory -> Test Cases
export const updateTestSourcesForProject = (testSourceId, payload) => {
  return cyfastAxios.post(`/test_sources/${testSourceId}`, payload);
};

// Get Test Suites
export const getTestSuitesByProjectId = (projectId) => {
  return cyfastAxios.get(`/test_suites?filters[project_id]=${projectId}`);
};

// Get Test Scripts (list; pagination optional via paging)
export const getTestScripts = async (filters = {}, paging = {}) => {
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null) {
      params.append(`filters[${key}]`, filters[key]);
    }
  });
  if (paging.page != null) params.append('page', paging.page);
  if (paging.size != null) params.append('size', paging.size);
  return cyfastAxios.get(`/test_scripts?${params.toString()}`);
};

// Get Test Scripts
export const getTestScriptsByProjectIdAndTestSuiteId = (projectId, testSuiteId, paging = {}) => {
  const params = new URLSearchParams({
    'filters[project_id]': projectId,
    'filters[test_suite_id]': testSuiteId
  });
  if (paging.page != null) params.append('page', paging.page);
  if (paging.size != null) params.append('size', paging.size);
  return cyfastAxios.get(`/test_scripts?${params.toString()}`);
};

// Test Cases List
// Get all test cases list
export const getTestCases = async (filters = {}, paging = {}) => {
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null) {
      params.append(`filters[${key}]`, filters[key]);
    }
  });
  if (paging.page != null) params.append('page', paging.page);
  if (paging.size != null) params.append('size', paging.size);
  return await cyfastAxios.get(`/test_cases?${params.toString()}`);
};

export const deleteTestCase = async (testCaseId) => {
  return await cyfastAxios.delete(`/test_cases/${testCaseId}`);
};

export const getTestCasesByProjectIdAndTestSuiteId = (projectId, testSuiteId, paging = {}) => {
  const params = new URLSearchParams({
    'filters[project_id]': projectId,
    'filters[test_suite_id]': testSuiteId
  });
  if (paging.page != null) params.append('page', paging.page);
  if (paging.size != null) params.append('size', paging.size);
  return cyfastAxios.get(`/test_cases?${params.toString()}`);
};

export const startTestCaseExecution = (testCaseId, testAgent) => {
  return cyfastAxios.post(`/test_cases/${testCaseId}/start_execution`, { agent_name: testAgent });
};

export const stopTestCaseExecution = (testCaseId) => {
  return cyfastAxios.post(`/test_cases/${testCaseId}/stop_execution`);
};

//To Import Test Cases after fetching Test Sources of the Project Inventory -> Test Cases
export const importTestCasesByTestSourceIdAndTestAgentId = (testSourceId, test_agent_id) => {
  return cyfastAxios.post(`/test_sources/${testSourceId}/import`, test_agent_id);
};

// Report Customization
// Get all reports list
export const getReportTemplates = async (filters = {}) => {
  // Convert filters object to URLSearchParams
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null) {
      params.append(`filters[${key}]`, filters[key]);
    }
  });
  return await cyfastAxios.get(`/report_templates?${params.toString()}`);
};

export const getReportTemplateById = async (reportTemplateId) => {
  return await cyfastAxios.get(`/report_templates/${reportTemplateId}`);
};

// Create a new report template
export const createReportTemplate = async (reportTemplateData) => {
  return await cyfastAxios.post('/report_templates', reportTemplateData);
};

// Update an existing report template
export const updateReportTemplate = async (reportTemplateId, reportTemplateData) => {
  return await cyfastAxios.post(`/report_templates/${reportTemplateId}`, reportTemplateData);
};

// Delete a report template
export const deleteReportTemplate = async (reportTemplateId) => {
  return await cyfastAxios.delete(`/report_templates/${reportTemplateId}`);
};

// Preview Report
export const previewReport = async (params) => {
  return await cyfastAxios.post(`/reports/preview`, params, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/html'
    }
  });
};

// Download Report
export const generateReport = async (reportTemplateId, reportType, filters, targetFormat = 'pdf') => {
  // Convert filters object to URLSearchParams
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null) {
      params.append(`filters[${key}]`, filters[key]);
    }
  });
  let apiUrl = `/reports/generate?target_format=${targetFormat}&${params.toString()}`;

  if (reportTemplateId) {
    apiUrl += `&report_template_id=${reportTemplateId}`;
  } else if (reportType) {
    apiUrl += `&report_type=${reportType}`;
  }

  return await cyfastAxios.get(apiUrl, { responseType: 'blob' });
};

// Report Sections
// Get report template sections
export const getReportTemplateSections = async (reportTemplateId) => {
  return await cyfastAxios.get(`/report_sections?filters[report_template_id]=${reportTemplateId}`);
};

// Create a new report section
export const createReportSection = async (sectionData) => {
  return await cyfastAxios.post(`/report_sections`, sectionData);
};

// Update an existing report section
export const updateReportSection = async (sectionId, sectionData) => {
  return await cyfastAxios.post(`/report_sections/${sectionId}`, sectionData);
};

// Delete a report section
export const deleteReportSection = async (sectionId) => {
  return await cyfastAxios.delete(`/report_sections/${sectionId}`);
};

// Add default report sections
export const addDefaultReportSections = async (reportTemplateId, reportType) => {
  if (!reportTemplateId || !reportType) {
    throw new Error('reportTemplateId and reportType are required');
  }
  return await cyfastAxios.post(`/report_sections/add_default`, {
    report_template_id: reportTemplateId,
    report_type: reportType
  });
};

// Get report design templates
export const getReportDesignTemplates = async (reportTemplateId) => {
  return await cyfastAxios.get(`/design_templates?filters[report_template_id]=${reportTemplateId}`);
};

// Get design templates
export const getDesignTemplates = async (filters = {}) => {
  // Convert filters object to URLSearchParams
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null) {
      params.append(`filters[${key}]`, filters[key]);
    }
  });
  return await cyfastAxios.get(`/design_templates?${params.toString()}`);
};

// Get a single design template by ID
export const getDesignTemplateById = async (designTemplateId) => {
  return await cyfastAxios.get(`/design_templates/${designTemplateId}`);
};

// Delete a design template
export const deleteDesignTemplate = async (designTemplateId) => {
  return await cyfastAxios.delete(`/design_templates/${designTemplateId}`);
};

// Add a new design template
export const addDesignTemplate = async (designTemplateData) => {
  return await cyfastAxios.post('/design_templates', designTemplateData);
};

// Traceability
export const getTraceabilityImports = async (traceabilityType, projectId) => {
  return await cyfastAxios.get(`/traceability/imports?type=${traceabilityType}&project_id=${projectId}&status=SUCCESS`);
};

export const importTraceability = async (payload) => {
  return await cyfastAxios.post(`/traceability/import`, payload);
};

export const getTraceability = async (projectId, direction = 'FORWARD') => {
  return await cyfastAxios.get(`/traceability?project_id=${projectId}&direction=${direction}`);
};

export const exportTraceability = async (projectId, type, format) => {
  return await cyfastAxios.get(`/traceability/export?project_id=${projectId}&type=${type}&format=${format}`, { responseType: 'blob' });
};

// Inventory
// Get Project Requirements
export const getRequirements = async (filters = {}, paging = {}) => {
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null) {
      params.append(`filters[${key}]`, filters[key]);
    }
  });
  if (paging.page != null) params.append('page', paging.page);
  if (paging.size != null) params.append('size', paging.size);
  return await cyfastAxios.get(`/requirements?${params.toString()}`);
};

/** Persisted test scenarios (inventory), not drafts from generation. */
export const getTestScenarios = async (filters = {}, paging = {}) => {
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null) {
      params.append(`filters[${key}]`, filters[key]);
    }
  });
  if (paging.page != null) params.append('page', paging.page);
  if (paging.size != null) params.append('size', paging.size);
  return await cyfastAxios.get(`/test_scenarios?${params.toString()}`);
};

/** Labels match ai_engine / GM normalization (uppercase values). */
export const REQUIREMENT_GENERATION_CATEGORIES = [
  { value: 'FUNCTIONAL', label: 'Functional' },
  { value: 'NON_FUNCTIONAL', label: 'Non-functional' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'REGULATORY', label: 'Regulatory' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'USABILITY', label: 'Usability' },
  { value: 'INTERFACE', label: 'Interface' },
  { value: 'DATA', label: 'Data' }
];

export const createRequirementGenerationJob = async (payload) => {
  return await cyfastAxios.post('/requirement_generation/jobs', payload);
};

export const listRequirementGenerationJobs = async (projectId, params = {}) => {
  const q = new URLSearchParams({ project_id: projectId });
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) q.append(k, v);
  });
  return await cyfastAxios.get(`/requirement_generation/jobs?${q.toString()}`);
};

export const getRequirementGenerationJob = async (jobId) => {
  return await cyfastAxios.get(`/requirement_generation/jobs/${jobId}`);
};

export const regenerateRequirementGenerationJob = async (jobId, body) => {
  return await cyfastAxios.post(`/requirement_generation/jobs/${jobId}/regenerate`, body);
};

export const listPendingGeneratedRequirements = async (projectId, params = {}) => {
  const q = new URLSearchParams({ project_id: projectId });
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, v);
  });
  return cyfastAxios.get(`/requirement_generation/pending?${q.toString()}`);
};

export const approveGeneratedRequirement = async (candidateId) => {
  return await cyfastAxios.post(`/requirement_generation/candidates/${candidateId}/approve`);
};

export const rejectGeneratedRequirement = async (candidateId, reason) => {
  return await cyfastAxios.post(`/requirement_generation/candidates/${candidateId}/reject`, { reason });
};

export const bulkApproveGeneratedRequirements = async (payload) =>
  cyfastAxios.post('/requirement_generation/candidates/bulk_approve', payload);

export const bulkRejectGeneratedRequirements = async (payload) =>
  cyfastAxios.post('/requirement_generation/candidates/bulk_reject', payload);

export const bulkDiscardGeneratedRequirements = async (payload) =>
  cyfastAxios.post('/requirement_generation/candidates/bulk_discard', payload);

export const regeneratePendingCandidatesWithAi = async (payload) =>
  cyfastAxios.post('/requirement_generation/candidates/regenerate', payload);

export const bulkRegenerateRequirementJobs = async (payload) =>
  cyfastAxios.post('/requirement_generation/jobs/bulk_regenerate', payload);

export const discardPendingRequirementJobs = async (payload) =>
  cyfastAxios.post('/requirement_generation/jobs/discard_pending', payload);

/** Values match general_management ALLOWED_SCENARIO_TYPES (upper snake). */
export const TEST_SCENARIO_GENERATION_TYPES = [
  { value: 'FUNCTIONAL', label: 'Functional test scenarios', defaultOn: true },
  { value: 'NEGATIVE', label: 'Negative test scenarios', defaultOn: true },
  { value: 'BOUNDARY', label: 'Boundary test scenarios', defaultOn: true },
  { value: 'ERROR_HANDLING', label: 'Error handling scenarios', defaultOn: true },
  { value: 'WORKFLOW', label: 'Workflow scenarios', defaultOn: true },
  { value: 'VALIDATION', label: 'Validation scenarios', defaultOn: true },
  {
    value: 'INTEGRATION',
    label: 'Integration scenarios (if applicable)',
    defaultOn: false
  },
  { value: 'SECURITY', label: 'Security scenarios (if applicable)', defaultOn: false },
  {
    value: 'USABILITY',
    label: 'Usability scenarios (if applicable)',
    defaultOn: false
  }
];

export const TEST_SCENARIO_SAFETY_OPTIONS = [
  { key: 'safety_validation', label: 'Include safety validation scenarios.' },
  { key: 'fault_handling', label: 'Include fault handling scenarios.' },
  { key: 'data_integrity', label: 'Include data integrity checks.' },
  { key: 'audit_logging', label: 'Include audit / logging validation.' },
  {
    key: 'regulatory',
    label: 'Include regulatory validation considerations.'
  }
];

export const createTestScenarioGenerationJob = async (payload) => {
  return await cyfastAxios.post('/test_scenario_generation/jobs', payload);
};

export const listTestScenarioGenerationJobs = async (projectId, params = {}) => {
  const q = new URLSearchParams({ project_id: projectId });
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) q.append(k, v);
  });
  return cyfastAxios.get(`/test_scenario_generation/jobs?${q.toString()}`);
};

export const getTestScenarioGenerationJob = async (jobId) =>
  cyfastAxios.get(`/test_scenario_generation/jobs/${jobId}`);

export const regenerateTestScenarioGenerationJob = async (jobId, body) =>
  cyfastAxios.post(`/test_scenario_generation/jobs/${jobId}/regenerate`, body);

export const listPendingGeneratedTestScenarios = async (projectId, params = {}) => {
  const q = new URLSearchParams({ project_id: projectId });
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, v);
  });
  return cyfastAxios.get(`/test_scenario_generation/pending?${q.toString()}`);
};

export const approveGeneratedTestScenario = async (candidateId) =>
  cyfastAxios.post(`/test_scenario_generation/candidates/${candidateId}/approve`);

export const rejectGeneratedTestScenario = async (candidateId, reason) =>
  cyfastAxios.post(`/test_scenario_generation/candidates/${candidateId}/reject`, { reason });

export const bulkApproveGeneratedTestScenarios = async (payload) =>
  cyfastAxios.post('/test_scenario_generation/candidates/bulk_approve', payload);

export const bulkRejectGeneratedTestScenarios = async (payload) =>
  cyfastAxios.post('/test_scenario_generation/candidates/bulk_reject', payload);

export const bulkDiscardGeneratedTestScenarios = async (payload) =>
  cyfastAxios.post('/test_scenario_generation/candidates/bulk_discard', payload);

export const regeneratePendingTestScenariosWithAi = async (payload) =>
  cyfastAxios.post('/test_scenario_generation/candidates/regenerate', payload);

export const bulkRegenerateTestScenarioJobs = async (payload) =>
  cyfastAxios.post('/test_scenario_generation/jobs/bulk_regenerate', payload);

export const discardPendingTestScenarioJobs = async (payload) =>
  cyfastAxios.post('/test_scenario_generation/jobs/discard_pending', payload);

export const createTestCaseGenerationJob = async (payload) =>
  cyfastAxios.post('/test_cases/generate', payload);

export const getTestCaseGenerationJob = async (jobId) =>
  cyfastAxios.get(`/test_cases/generate/jobs/${jobId}`);

export const listPendingGeneratedTestCases = async (projectId, params = {}) => {
  const q = new URLSearchParams({ project_id: projectId });
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, v);
  });
  return cyfastAxios.get(`/test_cases/pending?${q.toString()}`);
};

export const approveGeneratedTestCase = async (generatedId) =>
  cyfastAxios.post(`/test_cases/generated/${generatedId}/approve`);

export const rejectGeneratedTestCase = async (generatedId, reason) =>
  cyfastAxios.post(`/test_cases/generated/${generatedId}/reject`, { reason });

export const bulkApproveGeneratedTestCases = async (payload) =>
  cyfastAxios.post('/test_cases/generated/approve-batch', payload);

export const bulkRejectGeneratedTestCases = async (payload) =>
  cyfastAxios.post('/test_cases/generated/reject-batch', payload);

export const bulkDiscardGeneratedTestCases = async (payload) =>
  cyfastAxios.post('/test_cases/generated/discard-batch', payload);

export const regeneratePendingTestCasesWithAi = async (payload) =>
  cyfastAxios.post('/test_cases/generated/regenerate', payload);

export const discardPendingTestCaseJobs = async (payload) =>
  cyfastAxios.post('/test_cases/generate/jobs/discard_pending', payload);

export const listUserNotifications = async (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) q.append(k, v);
  });
  const qs = q.toString();
  return cyfastAxios.get(`/user_notifications/me${qs ? `?${qs}` : ''}`);
};

export const markAllUserNotificationsRead = async () =>
  cyfastAxios.post('/user_notifications/me/read_all');

export const markUserNotificationRead = async (notificationId) =>
  cyfastAxios.post(`/user_notifications/${notificationId}/read`);

/** @deprecated Use listUserNotifications */
export const listHeaderNotifications = listUserNotifications;

/** @deprecated Use markAllUserNotificationsRead */
export const markAllHeaderNotificationsRead = markAllUserNotificationsRead;

/** @deprecated Use markUserNotificationRead */
export const markHeaderNotificationRead = markUserNotificationRead;

/** AI reviewer: rubric dimensions for requirement drafts before approval */
export const validateGenerationRequirements = async (payload) =>
  cyfastAxios.post('/generation_validation/requirements', payload);

/** AI reviewer: rubric dimensions for test case drafts (optional source_requirements) */
export const validateGenerationTestCases = async (payload) =>
  cyfastAxios.post('/generation_validation/test_cases', payload);

/** AI reviewer: rubric dimensions for test scenario drafts (optional source_requirement) */
export const validateGenerationTestScenarios = async (payload) =>
  cyfastAxios.post('/generation_validation/test_scenarios', payload);

/** AI reviewer: custom checklist for arbitrary generated artifacts */
export const validateGenerationOther = async (payload) =>
  cyfastAxios.post('/generation_validation/other', payload);

// Get Project Risks
export const getRisks = async (filters = {}, paging = {}) => {
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null) {
      params.append(`filters[${key}]`, filters[key]);
    }
  });
  if (paging.page != null) params.append('page', paging.page);
  if (paging.size != null) params.append('size', paging.size);
  return await cyfastAxios.get(`/risks?${params.toString()}`);
};

// Project Documents (Gen AI V&V document ingestion + vectorless RAG)
// Get the catalog of allowed document types
export const getProjectDocumentTypes = async () => {
  return await cyfastAxios.get('/project_documents/doc_types');
};

// List documents for a project (filterable by doc_type, status, etc.)
export const getProjectDocuments = async (filters = {}, page = 1, size = 50) => {
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      params.append(`filters[${key}]`, filters[key]);
    }
  });
  if (page) params.append('page', page);
  if (size) params.append('size', size);
  return await cyfastAxios.get(`/project_documents?${params.toString()}`);
};

// Get a single project document
export const getProjectDocument = async (projectDocumentId) => {
  return await cyfastAxios.get(`/project_documents/${projectDocumentId}`);
};

// Upload a project document (multipart). `payload` is a FormData.
export const uploadProjectDocument = async (formData, onUploadProgress) => {
  return await cyfastAxios.post('/project_documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress
  });
};

// Delete a project document (soft by default; pass hardDelete=true to remove permanently)
export const deleteProjectDocument = async (projectDocumentId, hardDelete = false) => {
  return await cyfastAxios.delete(`/project_documents/${projectDocumentId}?hard_delete=${hardDelete ? 'true' : 'false'}`);
};

// Trigger re-parse + re-index for an existing document
export const reparseProjectDocument = async (projectDocumentId) => {
  return await cyfastAxios.post(`/project_documents/${projectDocumentId}/reparse`);
};

// Download URL helper — backend returns a 302 to storage_service
export const getProjectDocumentDownloadUrl = (projectDocumentId) => {
  const base = (import.meta.env.VITE_CYFAST_APP_API_URL || '').replace(/\/+$/, '');
  return `${base}/project_documents/${projectDocumentId}/download`;
};

// Vectorless RAG search across project documents (PageIndex tree-of-contents)
export const searchProjectDocuments = async ({ projectId, query, docTypes, projectDocumentIds, topK, maxBranch, maxDepth }) => {
  return await cyfastAxios.post('/project_documents/search', {
    project_id: projectId,
    query,
    doc_types: docTypes,
    project_document_ids: projectDocumentIds,
    top_k: topK,
    max_branch: maxBranch,
    max_depth: maxDepth
  });
};

// RAG chat grounded in indexed project documents (retrieval + optional LLM synthesis on ai_engine)
export const chatProjectDocuments = async ({
  projectId,
  organizationId,
  query,
  conversationHistory,
  docTypes,
  projectDocumentIds,
  topK,
  maxBranch,
  maxDepth
}) => {
  return await cyfastAxios.post('/project_documents/chat', {
    project_id: projectId,
    organization_id: organizationId,
    query,
    conversation_history: conversationHistory,
    doc_types: docTypes,
    project_document_ids: projectDocumentIds,
    top_k: topK,
    max_branch: maxBranch,
    max_depth: maxDepth
  });
};

// Console Logs
// Get Console Logs
export const getConsoleLogs = async (executionId, filters) => {
  let urlConsoleLogs = `/logs/console?page=1&size=100&sort[created_date]=asc&format=merged_agentwise&filters[orchestration_execution_id]=${executionId}`;
  for (let [key, filter_value] of Object.entries(filters)) {
    urlConsoleLogs += `&filters[${key}]=${filter_value}`;
  }
  return await cylogAxios.get(urlConsoleLogs);
};

// Get Execution Logs
export const getExecutionLogs = async (executionId) => {
  let urlExecutionLogs = '/logs/execution/orchestration_execution/' + executionId;
  return await cylogAxios.get(urlExecutionLogs);
};

export const downloadExecutionLogs = async (executionId) => {
  let urlExecutionLogs = '/logs/execution/orchestration_execution/' + executionId + '/reports/download/all';
  return await cylogAxios.get(urlExecutionLogs, { responseType: 'blob' });
};

// User Management
// Get Users
export const getUsers = async () => {
  return await cyuserAxios.get('/users');
};

// Get User
export const getUser = async (userId) => {
  return await cyuserAxios.get('/users/' + userId);
};

// Get My profile
export const getMyProfile = async () => {
  return await cyuserAxios.get('/users/my-profile');
};

//create new user
export const createUser = async (payload) => {
  return await cyuserAxios.post('/users', payload);
};

//edit /update the user
export const updateUser = async (userId, payload) => {
  return await cyuserAxios.post(`/users/${userId}`, payload);
};

// delete the user
export const deleteUser = async (userId) => {
  return await cyuserAxios.delete(`/users/${userId}`);
};

// Get Roles
export const getRoles = async () => {
  return await cyuserAxios.get('/roles');
};

//create new role
export const createRole = async (payload) => {
  return await cyuserAxios.post('/roles', payload);
};

//edit /update the role
export const updateRole = async (role_id, payload) => {
  return await cyuserAxios.post(`/roles/${role_id}`, payload);
};

// delete the role
export const deleteRole = async (role_id) => {
  return await cyuserAxios.delete(`/roles/${role_id}`);
};

// get the permission
export const getPermissions = async (filters = {}) => {
  return await cyuserAxios.get('/permissions', { params: filters });
};

// create the permission
export const createPermission = async (payload) => {
  return await cyuserAxios.post('/permissions', payload);
};

// edit / update the permission
export const updatePermission = async (permission_id, payload) => {
  return await cyuserAxios.post(`/permissions/${permission_id}`, payload);
};

// delete the permission
export const deletePermission = async (id) => {
  return await cyuserAxios.delete(`/permissions/${id}`);
};

// normalize role payloads
const toRoleIds = (roles) => {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((r) => {
      if (typeof r === 'number') return r;
      if (typeof r === 'string') return Number(r);
      if (r && typeof r === 'object') {
        if (r.value != null) return Number(r.value);
        if (r.role_id != null) return Number(r.role_id);
      }
      return NaN;
    })
    .filter(Number.isFinite);
};

// get the user by id
export const getUserById = async (userId) => {
  return await cyuserAxios.get(`/users/${userId}`);
};

export const createUserNormalized = async (form) => {
  const payload = {
    first_name: form.first_name?.trim(),
    last_name: form.last_name?.trim(),
    email: form.email?.trim(),
    password: form.password,
    is_active: form.is_active ? 1 : 0,
    role_ids: toRoleIds(form.roles ?? form.role_ids),
    organization_id: form.organization_id
  };
  return await createUser(payload);
};

export const updateUserNormalized = async (userId, form) => {
  const payload = {
    first_name: form.first_name?.trim(),
    last_name: form.last_name?.trim(),
    email: form.email?.trim(),
    is_active: form.is_active ? 1 : 0,
    role_ids: toRoleIds(form.roles ?? form.role_ids),
    organization_id: form.organization_id
  };
  if (form.password) payload.password = form.password;
  return await updateUser(userId, payload);
};
