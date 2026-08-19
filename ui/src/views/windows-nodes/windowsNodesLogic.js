export const nodeState = (node = {}) => String(node.status || node.health?.status || '').toUpperCase();
export const canStartSession = (node) => ['ONLINE', 'READY', 'ACTIVE'].includes(nodeState(node));
export const canControlSession = (node, session) => {
  const state = nodeState(node);
  if (['SESSION_LOCKED', 'SESSION_DISCONNECTED', 'NO_INTERACTIVE_SESSION', 'SESSION_LOGGING_OFF'].includes(state)) {
    return false;
  }
  return canStartSession(node) && !['ENDING', 'ENDED', 'FAILED'].includes(String(session?.status || '').toUpperCase());
};

export const commandLifecycleLabel = (commandPayload) => {
  const status = String(commandPayload?.command?.status || commandPayload?.status || '').toUpperCase();
  if (['EVIDENCE_PENDING', 'EVIDENCE_UPLOADING', 'RESULT_RECEIVED'].includes(status)) return 'Evidence pending';
  if (status === 'EVIDENCE_FAILED') return 'Evidence failed';
  if (status === 'COMPLETED' && commandPayload?.evidence_ready) return 'Completed';
  if (status === 'COMPLETED' && !commandPayload?.evidence_ready) return 'Evidence pending';
  return status || 'Unknown';
};

export const mapError = (error) => {
  const value = error?.response?.data || error || {};
  return {
    code: value.code || error?.code || 'WINDOWS_REQUEST_FAILED',
    message: value.message || value.error || error?.message || 'The Windows service could not complete this request.'
  };
};

export const asArray = (value) => (Array.isArray(value) ? value : value?.data || []);
export const formatValue = (value) => (value === undefined || value === null || value === '' ? '—' : String(value));

export const flattenUiTree = (nodes, query = '') => {
  const term = query.trim().toLowerCase();
  const flattened = [];
  const visit = (items, depth = 0) =>
    asArray(items).forEach((item) => {
      const properties = item.properties || item;
      const text = [properties.name, properties.controlType, properties.automationId, properties.className].join(' ').toLowerCase();
      if (!term || text.includes(term)) flattened.push({ ...properties, depth });
      visit(item.children || properties.children, depth + 1);
    });
  visit(nodes);
  return flattened;
};
