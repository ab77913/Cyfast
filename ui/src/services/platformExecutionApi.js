const DEFAULT_BASE_URL = import.meta.env.VITE_GENERAL_MANAGEMENT_URL || "";

function storageValue(...keys) {
  for (const key of keys) {
    const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
    if (value) return value;
  }
  return "";
}

function authHeaders(projectId, extra = {}) {
  const token = storageValue("access_token", "accessToken", "token");
  const userId = storageValue("user_id", "userId");
  const organizationId = storageValue("organization_id", "organizationId");
  return {
    ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
    ...(userId ? { "x-user-id": userId } : {}),
    ...(organizationId ? { "x-organization-id": organizationId } : {}),
    ...(projectId ? { "x-project-id": String(projectId) } : {}),
    ...extra,
  };
}

async function request(path, { method = "GET", projectId, body, headers = {}, signal } = {}) {
  const response = await fetch(`${DEFAULT_BASE_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(projectId, headers),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    credentials: "include",
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.detail?.message || payload?.detail || `Request failed with HTTP ${response.status}`);
    error.status = response.status;
    error.code = payload?.code || payload?.detail?.code || "REQUEST_FAILED";
    error.details = payload;
    throw error;
  }
  return payload;
}

function queryString(values) {
  const query = new URLSearchParams();
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export const platformExecutionApi = {
  listTargets(projectId, options = {}) {
    return request(`/execution_targets${queryString({ project_id: projectId, ...options })}`, { projectId });
  },
  createTarget(projectId, target) {
    return request("/execution_targets", { method: "POST", projectId, body: { ...target, project_id: Number(projectId) } });
  },
  checkTarget(projectId, targetId) {
    return request(`/execution_targets/${encodeURIComponent(targetId)}/check`, {
      method: "POST",
      projectId,
      body: { project_id: Number(projectId) },
    });
  },
  revokeTarget(projectId, targetId) {
    return request(`/execution_targets/${encodeURIComponent(targetId)}/revoke`, {
      method: "POST",
      projectId,
      body: { project_id: Number(projectId) },
    });
  },
  listRuns(projectId, options = {}) {
    return request(`/execution_runs${queryString({ project_id: projectId, ...options })}`, { projectId });
  },
  getRun(projectId, runId, signal) {
    return request(`/execution_runs/${encodeURIComponent(runId)}${queryString({ project_id: projectId })}`, { projectId, signal });
  },
  startRun(projectId, input) {
    const idempotencyKey = input.idempotency_key || `ui-${Date.now()}-${crypto.randomUUID()}`;
    return request("/execution_runs", {
      method: "POST",
      projectId,
      headers: { "idempotency-key": idempotencyKey },
      body: { ...input, project_id: Number(projectId), idempotency_key: idempotencyKey },
    });
  },
  cancelRun(projectId, runId) {
    return request(`/execution_runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
      projectId,
      body: { project_id: Number(projectId) },
    });
  },
  runEvents(projectId, runId, options = {}) {
    return request(`/execution_runs/${encodeURIComponent(runId)}/events${queryString({ project_id: projectId, page_size: 100, ...options })}`, { projectId });
  },
  runArtifacts(projectId, runId, options = {}) {
    return request(`/execution_runs/${encodeURIComponent(runId)}/artifacts${queryString({ project_id: projectId, page_size: 100, ...options })}`, { projectId });
  },
  runRecordings(projectId, runId, options = {}) {
    return request(`/execution_runs/${encodeURIComponent(runId)}/recordings${queryString({ project_id: projectId, page_size: 100, ...options })}`, { projectId });
  },
  runDefects(projectId, runId, options = {}) {
    return request(`/execution_runs/${encodeURIComponent(runId)}/defects${queryString({ project_id: projectId, page_size: 100, ...options })}`, { projectId });
  },
  runRepairs(projectId, runId, options = {}) {
    return request(`/execution_runs/${encodeURIComponent(runId)}/repairs${queryString({ project_id: projectId, page_size: 100, ...options })}`, { projectId });
  },
  proposeRepair(projectId, runId, proposal) {
    return request(`/execution_runs/${encodeURIComponent(runId)}/repairs`, {
      method: "POST",
      projectId,
      body: { ...proposal, project_id: Number(projectId) },
    });
  },
  approveRepairAndRerun(projectId, runId, repairId, input) {
    const idempotencyKey = input.idempotency_key || `repair-${Date.now()}-${crypto.randomUUID()}`;
    return request(`/execution_runs/${encodeURIComponent(runId)}/repairs/${encodeURIComponent(repairId)}/approve-and-rerun`, {
      method: "POST",
      projectId,
      headers: { "idempotency-key": idempotencyKey },
      body: { ...input, project_id: Number(projectId), idempotency_key: idempotencyKey },
    });
  },
  updateDefect(projectId, defectId, patch) {
    return request(`/execution_defects/${encodeURIComponent(defectId)}`, {
      method: "PATCH",
      projectId,
      body: { ...patch, project_id: Number(projectId) },
    });
  },
  runTraceability(projectId, runId) {
    return request(`/execution_runs/${encodeURIComponent(runId)}/traceability/graph${queryString({ project_id: projectId })}`, { projectId });
  },
  metrics(projectId, options = {}) {
    return request(`/execution_metrics${queryString({ project_id: projectId, ...options })}`, { projectId });
  },
  listQualityLifecycles(projectId, options = {}) {
    return request(`/quality_lifecycles${queryString({ project_id: projectId, ...options })}`, { projectId });
  },
  createQualityLifecycle(projectId, input) {
    return request("/quality_lifecycles", {
      method: "POST",
      projectId,
      body: { ...input, project_id: Number(projectId) },
    });
  },
  getQualityLifecycle(projectId, lifecycleId) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}${queryString({ project_id: projectId })}`, { projectId });
  },
  lifecycleItems(projectId, lifecycleId, options = {}) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/items${queryString({ project_id: projectId, page_size: 100, ...options })}`, { projectId });
  },
  addLifecycleItem(projectId, lifecycleId, item) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/items`, {
      method: "POST",
      projectId,
      body: { ...item, project_id: Number(projectId) },
    });
  },
  approveLifecycleItem(projectId, lifecycleId, itemId, approval) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/items/${encodeURIComponent(itemId)}/approval`, {
      method: "POST",
      projectId,
      body: { ...approval, project_id: Number(projectId) },
    });
  },
  transitionLifecycle(projectId, lifecycleId, status, metadata = {}) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/transition`, {
      method: "POST",
      projectId,
      body: { project_id: Number(projectId), status, metadata },
    });
  },
  lifecycleEvents(projectId, lifecycleId) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/events${queryString({ project_id: projectId, page_size: 100 })}`, { projectId });
  },
  lifecycleReadiness(projectId, lifecycleId) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/readiness${queryString({ project_id: projectId })}`, { projectId });
  },
  artifactUrl(projectId, artifactId) {
    return `${DEFAULT_BASE_URL}/execution_artifacts/${encodeURIComponent(artifactId)}/content${queryString({ project_id: projectId })}`;
  },
};

export default platformExecutionApi;
