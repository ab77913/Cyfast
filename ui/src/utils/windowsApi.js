import cyfastAxios from './cyfastAxios';

const base = '/windows_';

export const listWindowsNodes = () => cyfastAxios.get(`${base}nodes`);
export const getWindowsNode = (nodeId) => cyfastAxios.get(`${base}nodes/${nodeId}`);
export const getWindowsNodeCapabilities = (nodeId) => cyfastAxios.get(`${base}nodes/${nodeId}/capabilities`);
export const revokeWindowsNode = (nodeId) => cyfastAxios.post(`${base}nodes/${nodeId}/revoke`);
export const listWindowsProfiles = () => cyfastAxios.get(`${base}application_profiles`);
export const createWindowsEnrollment = (payload) => cyfastAxios.post('/agent_enrollments', payload);
export const createWindowsSession = (nodeId, payload) => cyfastAxios.post(`${base}nodes/${nodeId}/sessions`, payload);
export const getWindowsSession = (sessionId) => cyfastAxios.get(`${base}sessions/${sessionId}`);
export const getWindowsEvidence = (sessionId) => cyfastAxios.get(`${base}sessions/${sessionId}/evidence`);
export const getWindowsEvidenceContent = (evidenceId) => cyfastAxios.get(`${base}evidence/${evidenceId}/content`, { responseType: 'blob' });

export const sendWindowsCommand = (sessionId, action, payload = {}) =>
  cyfastAxios.post(`${base}sessions/${sessionId}/${action}`, { payload });

export const getWindowsCommand = (commandId) => cyfastAxios.get(`/windows_commands/${commandId}`);

/** Poll until command reaches a terminal lifecycle state (evidence-complete or typed failure). */
export async function waitForWindowsCommandTerminal(commandId, { timeoutMs = 120000, intervalMs = 2000 } = {}) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    const response = await getWindowsCommand(commandId);
    last = response.data;
    if (last?.terminal) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  const err = new Error('Windows command evidence wait timed out');
  err.code = 'EVIDENCE_TIMEOUT';
  err.data = last;
  throw err;
}
