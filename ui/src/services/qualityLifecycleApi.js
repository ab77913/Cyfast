const BASE_URL = import.meta.env.VITE_GENERAL_MANAGEMENT_URL || "";

function storageValue(...keys) {
  for (const key of keys) {
    const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
    if (value) return value;
  }
  return "";
}

function requestId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function headers(projectId, body, extra = {}) {
  const token = storageValue("access_token", "accessToken", "token");
  const userId = storageValue("user_id", "userId");
  const organizationId = storageValue("organization_id", "organizationId");
  return {
    Accept: "application/json",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
    ...(userId ? { "x-user-id": userId } : {}),
    ...(organizationId ? { "x-organization-id": organizationId } : {}),
    ...(projectId ? { "x-project-id": String(projectId) } : {}),
    ...extra,
  };
}

async function request(path, { method = "GET", projectId, body, extraHeaders = {}, signal } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(projectId, body, extraHeaders),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
    signal,
  });
  const contentType = response.headers.get("content-type") || "";
  const value = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(value?.message || value?.detail?.message || value?.detail || `Request failed with HTTP ${response.status}`);
    error.code = value?.code || value?.detail?.code || "REQUEST_FAILED";
    error.status = response.status;
    error.details = value;
    throw error;
  }
  return value;
}

function query(values) {
  const parameters = new URLSearchParams();
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") parameters.set(key, String(value));
  });
  const encoded = parameters.toString();
  return encoded ? `?${encoded}` : "";
}

export const qualityLifecycleApi = {
  list(projectId, options = {}) {
    return request(`/quality_lifecycles${query({ project_id: projectId, page_size: 100, ...options })}`, { projectId });
  },
  create(projectId, input) {
    return request("/quality_lifecycles", {
      method: "POST",
      projectId,
      body: { ...input, project_id: Number(projectId) },
    });
  },
  get(projectId, lifecycleId) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}${query({ project_id: projectId })}`, { projectId });
  },
  items(projectId, lifecycleId, options = {}) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/items${query({ project_id: projectId, page_size: 250, ...options })}`, { projectId });
  },
  contents(projectId, lifecycleId, options = {}) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/contents${query({ project_id: projectId, page_size: 250, ...options })}`, { projectId });
  },
  events(projectId, lifecycleId, options = {}) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/events${query({ project_id: projectId, page_size: 250, ...options })}`, { projectId });
  },
  readiness(projectId, lifecycleId) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/readiness${query({ project_id: projectId })}`, { projectId });
  },
  executions(projectId, lifecycleId, options = {}) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/executions${query({ project_id: projectId, page_size: 100, ...options })}`, { projectId });
  },
  addContent(projectId, lifecycleId, input) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/content_items`, {
      method: "POST",
      projectId,
      body: { ...input, project_id: Number(projectId) },
    });
  },
  approveItem(projectId, lifecycleId, itemId, approvalStatus, comment = "") {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/items/${encodeURIComponent(itemId)}/approval`, {
      method: "POST",
      projectId,
      body: { project_id: Number(projectId), approval_status: approvalStatus, comment },
    });
  },
  transition(projectId, lifecycleId, status, metadata = {}) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/transition`, {
      method: "POST",
      projectId,
      body: { project_id: Number(projectId), status, metadata },
    });
  },
  generate(projectId, lifecycleId, stage, platform, context = {}) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/generate`, {
      method: "POST",
      projectId,
      body: {
        project_id: Number(projectId),
        stage,
        platform,
        application_context: context.application_context || {},
        safety_context: context.safety_context || {},
      },
    });
  },
  validateScripts(projectId, lifecycleId) {
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/validate_scripts`, {
      method: "POST",
      projectId,
      body: { project_id: Number(projectId) },
    });
  },
  startExecution(projectId, lifecycleId, input) {
    const idempotencyKey = input.idempotency_key || requestId("quality-run");
    return request(`/quality_lifecycles/${encodeURIComponent(lifecycleId)}/executions`, {
      method: "POST",
      projectId,
      extraHeaders: { "idempotency-key": idempotencyKey },
      body: { ...input, project_id: Number(projectId), idempotency_key: idempotencyKey },
    });
  },
};

export default qualityLifecycleApi;
