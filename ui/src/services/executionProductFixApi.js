const BASE_URL = import.meta.env.VITE_GENERAL_MANAGEMENT_URL || "";

function stored(...keys) {
  for (const key of keys) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value) return value;
  }
  return "";
}

async function request(path, { method = "GET", projectId, body } = {}) {
  const token = stored("access_token", "accessToken", "token");
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
      ...(stored("user_id", "userId") ? { "x-user-id": stored("user_id", "userId") } : {}),
      ...(stored("organization_id", "organizationId") ? { "x-organization-id": stored("organization_id", "organizationId") } : {}),
      ...(projectId ? { "x-project-id": String(projectId) } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify({ ...body, project_id: Number(projectId) }),
  });
  const value = (response.headers.get("content-type") || "").includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const error = new Error(value?.message || value?.detail || `Request failed with HTTP ${response.status}`);
    error.code = value?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return value;
}

function query(projectId) {
  return `?project_id=${encodeURIComponent(projectId)}&page_size=100`;
}

export const executionProductFixApi = {
  list(projectId, runId) {
    return request(`/execution_runs/${encodeURIComponent(runId)}/product_fixes${query(projectId)}`, { projectId });
  },
  create(projectId, defectId, input) {
    return request(`/execution_defects/${encodeURIComponent(defectId)}/product_fixes`, { method: "POST", projectId, body: input });
  },
  review(projectId, fixId, input) {
    return request(`/execution_product_fixes/${encodeURIComponent(fixId)}/review`, { method: "POST", projectId, body: input });
  },
  deployment(projectId, fixId, input) {
    return request(`/execution_product_fixes/${encodeURIComponent(fixId)}/deployment`, { method: "POST", projectId, body: input });
  },
  verification(projectId, fixId, executionRunId) {
    return request(`/execution_product_fixes/${encodeURIComponent(fixId)}/verification`, {
      method: "POST",
      projectId,
      body: { execution_run_id: executionRunId },
    });
  },
};

export default executionProductFixApi;
