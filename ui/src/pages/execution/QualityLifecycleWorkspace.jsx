import React, { useCallback, useEffect, useMemo, useState } from "react";
import qualityLifecycleApi from "../../services/qualityLifecycleApi";
import "./quality-lifecycle-workspace.css";

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const STAGES = [
  "DOCUMENT_UPLOADED",
  "REQUIREMENTS_GENERATED",
  "REQUIREMENTS_APPROVED",
  "SCENARIOS_GENERATED",
  "SCENARIOS_APPROVED",
  "TEST_CASES_GENERATED",
  "TEST_CASES_APPROVED",
  "TEST_DATA_GENERATED",
  "TEST_DATA_APPROVED",
  "LOGICAL_STEPS_GENERATED",
  "LOGICAL_STEPS_APPROVED",
  "SCRIPT_GENERATED",
  "SCRIPT_VALIDATED",
  "READY_FOR_EXECUTION",
  "EXECUTING",
  "COMPLETED",
];
const GENERATION_STAGE = {
  DOCUMENT_UPLOADED: "REQUIREMENTS",
  REQUIREMENTS_APPROVED: "TEST_SCENARIOS",
  SCENARIOS_APPROVED: "TEST_CASES",
  TEST_CASES_APPROVED: "TEST_DATA",
  TEST_DATA_APPROVED: "LOGICAL_STEPS",
  LOGICAL_STEPS_APPROVED: "TEST_SCRIPTS",
};
const APPROVAL_TRANSITION = {
  REQUIREMENTS_GENERATED: "REQUIREMENTS_APPROVED",
  SCENARIOS_GENERATED: "SCENARIOS_APPROVED",
  TEST_CASES_GENERATED: "TEST_CASES_APPROVED",
  TEST_DATA_GENERATED: "TEST_DATA_APPROVED",
  LOGICAL_STEPS_GENERATED: "LOGICAL_STEPS_APPROVED",
};
const GENERATED_TYPE = {
  REQUIREMENTS_GENERATED: "REQUIREMENT",
  SCENARIOS_GENERATED: "TEST_SCENARIO",
  TEST_CASES_GENERATED: "TEST_CASE",
  TEST_DATA_GENERATED: "TEST_DATA",
  LOGICAL_STEPS_GENERATED: "LOGICAL_STEP",
  SCRIPT_GENERATED: "TEST_SCRIPT",
};
const BINDING_TYPES = ["APPLICATION", "DEVICE", "LOCATOR_SET", "TARGET_PROFILE"];

function statusClass(status) {
  return `cyfast-status cyfast-status-${String(status || "unknown").toLowerCase()}`;
}

function timestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
}

async function fileSha256(file) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function ContentPreview({ content, onClose }) {
  if (!content) return null;
  const value = content.content_format === "ROBOT" || content.content_format === "TEXT"
    ? content.content_text
    : content.content_json;
  return (
    <div className="cyfast-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="cyfast-modal cyfast-content-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="cyfast-panel-heading">
          <div><h3>{content.title}</h3><small>{content.item_type} · v{content.resource_version}</small></div>
          <button type="button" className="cyfast-link-button" onClick={onClose}>Close</button>
        </div>
        <div className="cyfast-proof-grid">
          <div><span>Format</span><strong>{content.content_format}</strong></div>
          <div><span>Status</span><strong>{content.generation_status}</strong></div>
          <div><span>Model</span><strong>{content.model_id || "User/system"}</strong></div>
          <div><span>Hash</span><strong className="cyfast-monospace">{content.content_hash}</strong></div>
        </div>
        <pre className="cyfast-content-preview">{typeof value === "string" ? value : safeJson(value)}</pre>
      </section>
    </div>
  );
}

export default function QualityLifecycleWorkspace({ projectId, targets = [], onExecutionStarted }) {
  const [lifecycles, setLifecycles] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);
  const [contents, setContents] = useState([]);
  const [events, setEvents] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBinding, setShowBinding] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    source_document_file_id: "",
    source_document_hash: "",
    source_document_version: "1",
    source_document_filename: "",
    source_document_content_type: "application/octet-stream",
    platform: "WINDOWS",
  });
  const [bindingForm, setBindingForm] = useState({
    item_type: "APPLICATION",
    resource_id: "",
    resource_version: "1",
    title: "",
    source_item_id: "",
    content: "{}",
  });
  const [executionForm, setExecutionForm] = useState({ execution_target_id: "", timeout_seconds: 900 });

  const contentByItem = useMemo(
    () => new Map(contents.map((content) => [content.quality_lifecycle_item_id, content])),
    [contents],
  );
  const approvedItems = useMemo(() => items.filter((item) => item.approval_status === "APPROVED"), [items]);
  const selectedPlatform = String(selected?.generation_policy?.selected_platform || "").toUpperCase();
  const compatibleTargets = useMemo(
    () => targets.filter((target) => target.status === "READY" && (!selectedPlatform || target.platform === selectedPlatform)),
    [targets, selectedPlatform],
  );
  const generationStage = selected ? GENERATION_STAGE[selected.status] : null;
  const approvalTransition = selected ? APPROVAL_TRANSITION[selected.status] : null;
  const currentGeneratedType = selected ? GENERATED_TYPE[selected.status] : null;
  const pendingCurrentItems = currentGeneratedType
    ? items.filter((item) => item.item_type === currentGeneratedType && item.approval_status === "PENDING")
    : [];
  const rejectedCurrentItems = currentGeneratedType
    ? items.filter((item) => item.item_type === currentGeneratedType && item.approval_status === "REJECTED")
    : [];

  const reportError = useCallback((value) => {
    setError(`${value.code ? `${value.code}: ` : ""}${value.message || value}`);
  }, []);

  const refreshList = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await qualityLifecycleApi.list(projectId);
      const values = result.items || [];
      setLifecycles(values);
      setSelectedId((current) => current || values[0]?.quality_lifecycle_id || "");
    } catch (value) {
      reportError(value);
    }
  }, [projectId, reportError]);

  const refreshSelected = useCallback(async (lifecycleId = selectedId, quiet = false) => {
    if (!projectId || !lifecycleId) return;
    if (!quiet) setLoading(true);
    try {
      const [lifecycle, itemResult, contentResult, eventResult, readinessValue, executionResult] = await Promise.all([
        qualityLifecycleApi.get(projectId, lifecycleId),
        qualityLifecycleApi.items(projectId, lifecycleId),
        qualityLifecycleApi.contents(projectId, lifecycleId),
        qualityLifecycleApi.events(projectId, lifecycleId),
        qualityLifecycleApi.readiness(projectId, lifecycleId),
        qualityLifecycleApi.executions(projectId, lifecycleId),
      ]);
      setSelected(lifecycle);
      setItems(itemResult.items || []);
      setContents(contentResult.items || []);
      setEvents(eventResult.items || []);
      setReadiness(readinessValue);
      setExecutions(executionResult.items || []);
      setLifecycles((current) => current.map((item) => item.quality_lifecycle_id === lifecycleId ? lifecycle : item));
      const defaultSource = (itemResult.items || []).find((item) => item.approval_status === "APPROVED");
      setBindingForm((current) => ({ ...current, source_item_id: current.source_item_id || defaultSource?.quality_lifecycle_item_id || "" }));
      setExecutionForm((current) => ({ ...current, execution_target_id: current.execution_target_id || compatibleTargets[0]?.execution_target_id || "" }));
    } catch (value) {
      reportError(value);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [compatibleTargets, projectId, reportError, selectedId]);

  useEffect(() => { refreshList(); }, [refreshList]);
  useEffect(() => { if (selectedId) refreshSelected(selectedId); }, [refreshSelected, selectedId]);

  async function createLifecycle(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!/^[a-f0-9]{64}$/i.test(createForm.source_document_hash)) {
      setError("Source document SHA-256 must contain exactly 64 hexadecimal characters.");
      return;
    }
    setLoading(true);
    try {
      const value = await qualityLifecycleApi.create(projectId, {
        name: createForm.name,
        source_document_file_id: createForm.source_document_file_id,
        source_document_hash: createForm.source_document_hash.toLowerCase(),
        source_document_version: createForm.source_document_version,
        generation_policy: {
          selected_platform: createForm.platform,
          source_document_filename: createForm.source_document_filename,
          source_document_content_type: createForm.source_document_content_type,
          require_source_anchor: true,
          require_human_approval: true,
          generate_negative_cases: true,
          generate_boundary_cases: true,
          generate_recovery_cases: true,
          script_repair_maximum_attempts: 3,
        },
      });
      setShowCreate(false);
      setNotice(`Lifecycle ${value.name} was created from the immutable document snapshot.`);
      await refreshList();
      setSelectedId(value.quality_lifecycle_id);
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }

  async function computeHash(file) {
    if (!file) return;
    setLoading(true);
    try {
      const hash = await fileSha256(file);
      setCreateForm((current) => ({
        ...current,
        source_document_hash: hash,
        source_document_filename: file.name,
        source_document_content_type: file.type || "application/octet-stream",
      }));
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const value = await qualityLifecycleApi.generate(
        projectId,
        selected.quality_lifecycle_id,
        generationStage,
        selectedPlatform,
      );
      setNotice(`${value.generated_items.length} ${value.stage} items were generated and are awaiting review.`);
      await refreshSelected(selected.quality_lifecycle_id);
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }

  async function approveItem(item, approvalStatus) {
    setError("");
    setLoading(true);
    try {
      await qualityLifecycleApi.approveItem(projectId, selected.quality_lifecycle_id, item.quality_lifecycle_item_id, approvalStatus);
      setNotice(`${item.item_type} ${item.resource_id} was ${approvalStatus.toLowerCase()}.`);
      await refreshSelected(selected.quality_lifecycle_id);
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }

  async function transition(status) {
    setError("");
    setLoading(true);
    try {
      await qualityLifecycleApi.transition(projectId, selected.quality_lifecycle_id, status);
      setNotice(`Lifecycle moved to ${status}.`);
      await refreshSelected(selected.quality_lifecycle_id);
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }

  async function validateScripts() {
    setError("");
    setLoading(true);
    try {
      const value = await qualityLifecycleApi.validateScripts(projectId, selected.quality_lifecycle_id);
      setNotice(`${value.reports.length} approved script version(s) passed static package and security validation.`);
      await refreshSelected(selected.quality_lifecycle_id);
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }

  async function addBinding(event) {
    event.preventDefault();
    setError("");
    let content;
    try {
      content = JSON.parse(bindingForm.content);
    } catch (_) {
      setError("Binding content must be valid JSON.");
      return;
    }
    setLoading(true);
    try {
      await qualityLifecycleApi.addContent(projectId, selected.quality_lifecycle_id, {
        item_type: bindingForm.item_type,
        resource_id: bindingForm.resource_id,
        resource_version: bindingForm.resource_version,
        title: bindingForm.title || bindingForm.resource_id,
        source_item_id: bindingForm.source_item_id,
        source_anchor: { binding_type: bindingForm.item_type, source_item_id: bindingForm.source_item_id },
        generation_metadata: { origin: "USER", binding: true },
        approval_status: "PENDING",
        content_format: bindingForm.item_type === "LOCATOR_SET" ? "LOCATORS" : "PROFILE",
        content,
      });
      setShowBinding(false);
      setNotice(`${bindingForm.item_type} profile was saved as a pending immutable version.`);
      setBindingForm((current) => ({ ...current, resource_id: "", resource_version: "1", title: "", content: "{}" }));
      await refreshSelected(selected.quality_lifecycle_id);
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }

  async function startExecution(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const value = await qualityLifecycleApi.startExecution(projectId, selected.quality_lifecycle_id, {
        execution_target_id: executionForm.execution_target_id,
        timeout_seconds: Number(executionForm.timeout_seconds),
        evidence_policy: {
          screen_recording: true,
          screenshots: true,
          device_logs: true,
          protocol_trace: true,
          retention_classification: "STANDARD",
        },
      });
      setNotice(`Real execution ${value.run.execution_run_id} was accepted and linked to this lifecycle.`);
      await refreshSelected(selected.quality_lifecycle_id);
      onExecutionStarted?.(value.run);
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }

  const currentIndex = selected ? STAGES.indexOf(selected.status) : -1;
  const canTransitionApproval = approvalTransition
    && pendingCurrentItems.length === 0
    && rejectedCurrentItems.length === 0
    && items.some((item) => item.item_type === currentGeneratedType && item.approval_status === "APPROVED");

  return (
    <div className="cyfast-lifecycle-layout">
      <section className="cyfast-panel cyfast-lifecycle-list">
        <div className="cyfast-panel-heading">
          <div><h3>Quality lifecycles</h3><p>Uploaded source to real execution proof.</p></div>
          <button type="button" className="cyfast-button" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Close" : "New lifecycle"}
          </button>
        </div>
        {showCreate ? (
          <form className="cyfast-form-grid" onSubmit={createLifecycle}>
            <label className="cyfast-span-two">Lifecycle name<input required value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} /></label>
            <label>Uploaded file ID<input required value={createForm.source_document_file_id} onChange={(event) => setCreateForm({ ...createForm, source_document_file_id: event.target.value })} /></label>
            <label>Document version<input required value={createForm.source_document_version} onChange={(event) => setCreateForm({ ...createForm, source_document_version: event.target.value })} /></label>
            <label>Target platform<select value={createForm.platform} onChange={(event) => setCreateForm({ ...createForm, platform: event.target.value })}><option>WINDOWS</option><option>LINUX</option><option>ANDROID</option><option>EMBEDDED</option></select></label>
            <label>Verify local source<input type="file" onChange={(event) => computeHash(event.target.files?.[0])} /></label>
            <label>Filename<input required value={createForm.source_document_filename} onChange={(event) => setCreateForm({ ...createForm, source_document_filename: event.target.value })} /></label>
            <label>Content type<input required value={createForm.source_document_content_type} onChange={(event) => setCreateForm({ ...createForm, source_document_content_type: event.target.value })} /></label>
            <label className="cyfast-span-two">Source SHA-256<input required className="cyfast-monospace" value={createForm.source_document_hash} onChange={(event) => setCreateForm({ ...createForm, source_document_hash: event.target.value })} /></label>
            <div className="cyfast-form-actions cyfast-span-two"><button type="submit" className="cyfast-button" disabled={loading}>Create immutable lifecycle</button></div>
          </form>
        ) : null}
        <div className="cyfast-card-list">
          {lifecycles.map((value) => (
            <button type="button" className={`cyfast-select-card ${selectedId === value.quality_lifecycle_id ? "is-selected" : ""}`} key={value.quality_lifecycle_id} onClick={() => setSelectedId(value.quality_lifecycle_id)}>
              <span><strong>{value.name}</strong><small>{value.generation_policy?.selected_platform || "No platform"} · v{value.version}</small></span>
              <span className={statusClass(value.status)}>{value.status}</span>
            </button>
          ))}
          {!lifecycles.length ? <div className="cyfast-empty">Create a lifecycle from an uploaded document.</div> : null}
        </div>
      </section>

      {selected ? (
        <section className="cyfast-panel cyfast-lifecycle-detail">
          <div className="cyfast-panel-heading">
            <div><h3>{selected.name}</h3><p className="cyfast-monospace">{selected.quality_lifecycle_id}</p></div>
            <div className="cyfast-actions"><span className={statusClass(selected.status)}>{selected.status}</span><button type="button" className="cyfast-button cyfast-button-secondary" onClick={() => refreshSelected(selected.quality_lifecycle_id)}>Refresh</button></div>
          </div>
          {notice ? <div className="cyfast-alert cyfast-alert-success">{notice}</div> : null}
          {error ? <div className="cyfast-alert cyfast-alert-error">{error}</div> : null}

          <div className="cyfast-stage-track">
            {STAGES.map((stage, index) => (
              <div className={`cyfast-stage ${index < currentIndex ? "is-complete" : index === currentIndex ? "is-current" : ""}`} key={stage}>
                <span>{index < currentIndex ? "✓" : index + 1}</span><small>{stage.replaceAll("_", " ")}</small>
              </div>
            ))}
          </div>

          <div className="cyfast-proof-grid">
            <div><span>Platform</span><strong>{selectedPlatform || "—"}</strong></div>
            <div><span>Document</span><strong>{selected.source_document_file_id}</strong></div>
            <div><span>Traceability</span><strong>{selected.traceability_complete ? "Complete" : "Incomplete"}</strong></div>
            <div><span>Execution ready</span><strong>{selected.ready_for_execution ? "Yes" : "No"}</strong></div>
          </div>

          {generationStage ? (
            <div className="cyfast-transition-box">
              <div><strong>Generate {generationStage.replaceAll("_", " ")}</strong><span>Uses approved source versions and the configured local model. Results remain pending until reviewed.</span></div>
              <button type="button" className="cyfast-button" onClick={generate} disabled={loading}>Generate with AI</button>
            </div>
          ) : null}

          {approvalTransition ? (
            <div className="cyfast-transition-box">
              <div><strong>Approve generated stage</strong><span>{pendingCurrentItems.length} pending · {rejectedCurrentItems.length} rejected. All items must be approved before advancing.</span></div>
              <button type="button" className="cyfast-button" onClick={() => transition(approvalTransition)} disabled={!canTransitionApproval || loading}>Move to {approvalTransition.replaceAll("_", " ")}</button>
            </div>
          ) : null}

          {selected.status === "SCRIPT_GENERATED" ? (
            <div className="cyfast-transition-box">
              <div><strong>Validate approved scripts</strong><span>Runs package, import, security, action and assertion validation. It does not claim real execution.</span></div>
              <button type="button" className="cyfast-button" onClick={validateScripts} disabled={pendingCurrentItems.length > 0 || rejectedCurrentItems.length > 0 || loading}>Validate scripts</button>
            </div>
          ) : null}

          {selected.status === "SCRIPT_VALIDATED" ? (
            <div className="cyfast-transition-box">
              <div><strong>Evaluate execution readiness</strong><span>{readiness?.ready ? "All approval and traceability gates are complete." : "Resolve the readiness findings below."}</span></div>
              <button type="button" className="cyfast-button" onClick={() => transition("READY_FOR_EXECUTION")} disabled={!readiness?.ready || loading}>Mark ready for real execution</button>
            </div>
          ) : null}

          {readiness && !readiness.ready ? (
            <div className="cyfast-alert cyfast-alert-warning"><strong>Readiness findings</strong><ul>{(readiness.errors || []).map((value) => <li key={value}>{value}</li>)}</ul></div>
          ) : null}

          <div className="cyfast-panel-heading cyfast-section-heading">
            <div><h4>Versioned lifecycle content</h4><p>Every item retains source, model, prompt, hash and approval.</p></div>
            <button type="button" className="cyfast-button cyfast-button-secondary" onClick={() => setShowBinding((value) => !value)}>{showBinding ? "Close binding" : "Add application/device/locator binding"}</button>
          </div>

          {showBinding ? (
            <form className="cyfast-form-grid" onSubmit={addBinding}>
              <label>Binding type<select value={bindingForm.item_type} onChange={(event) => setBindingForm({ ...bindingForm, item_type: event.target.value })}>{BINDING_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Resource ID<input required value={bindingForm.resource_id} onChange={(event) => setBindingForm({ ...bindingForm, resource_id: event.target.value })} /></label>
              <label>Version<input required value={bindingForm.resource_version} onChange={(event) => setBindingForm({ ...bindingForm, resource_version: event.target.value })} /></label>
              <label>Title<input required value={bindingForm.title} onChange={(event) => setBindingForm({ ...bindingForm, title: event.target.value })} /></label>
              <label className="cyfast-span-two">Approved source item<select required value={bindingForm.source_item_id} onChange={(event) => setBindingForm({ ...bindingForm, source_item_id: event.target.value })}><option value="">Select source</option>{approvedItems.map((item) => <option key={item.quality_lifecycle_item_id} value={item.quality_lifecycle_item_id}>{item.item_type} · {item.resource_id} · v{item.resource_version}</option>)}</select></label>
              <label className="cyfast-span-two">Binding/profile JSON<textarea rows="8" required value={bindingForm.content} onChange={(event) => setBindingForm({ ...bindingForm, content: event.target.value })} /></label>
              <div className="cyfast-form-actions cyfast-span-two"><button type="submit" className="cyfast-button" disabled={loading}>Save pending binding version</button></div>
            </form>
          ) : null}

          <div className="cyfast-table-wrap">
            <table className="cyfast-table">
              <thead><tr><th>Type</th><th>Resource</th><th>Version</th><th>Origin</th><th>Approval</th><th /></tr></thead>
              <tbody>
                {items.map((item) => {
                  const content = contentByItem.get(item.quality_lifecycle_item_id);
                  return (
                    <tr key={item.quality_lifecycle_item_id}>
                      <td>{item.item_type}</td><td>{item.resource_id}</td><td>{item.resource_version}</td>
                      <td>{item.generation_metadata?.origin || "USER"}</td>
                      <td><span className={statusClass(item.approval_status)}>{item.approval_status}</span></td>
                      <td><div className="cyfast-actions">{content ? <button type="button" className="cyfast-link-button" onClick={() => setPreview(content)}>View</button> : null}{item.approval_status === "PENDING" ? <><button type="button" className="cyfast-link-button" onClick={() => approveItem(item, "APPROVED")}>Approve</button><button type="button" className="cyfast-link-button cyfast-link-danger" onClick={() => approveItem(item, "REJECTED")}>Reject</button></> : null}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selected.status === "READY_FOR_EXECUTION" ? (
            <form className="cyfast-transition-box" onSubmit={startExecution}>
              <div><strong>Run in the real environment</strong><span>Only compatible targets with READY health are selectable.</span></div>
              <div className="cyfast-actions"><select required value={executionForm.execution_target_id} onChange={(event) => setExecutionForm({ ...executionForm, execution_target_id: event.target.value })}><option value="">Select {selectedPlatform} target</option>{compatibleTargets.map((target) => <option value={target.execution_target_id} key={target.execution_target_id}>{target.name} · {target.status}</option>)}</select><input type="number" min="30" max="86400" value={executionForm.timeout_seconds} onChange={(event) => setExecutionForm({ ...executionForm, timeout_seconds: event.target.value })} /><button type="submit" className="cyfast-button" disabled={loading || !compatibleTargets.length}>Start real execution</button></div>
            </form>
          ) : null}

          <details className="cyfast-details"><summary>Execution attempts ({executions.length})</summary><div className="cyfast-table-wrap"><table className="cyfast-table"><thead><tr><th>Run</th><th>Relationship</th><th>Status</th><th>Created</th></tr></thead><tbody>{executions.map((value) => <tr key={value.execution_run_id}><td className="cyfast-monospace">{value.execution_run_id}</td><td>{value.relationship}</td><td><span className={statusClass(value.status_snapshot)}>{value.status_snapshot}</span></td><td>{timestamp(value.created_date)}</td></tr>)}</tbody></table></div></details>
          <details className="cyfast-details"><summary>Immutable lifecycle events ({events.length})</summary><ol className="cyfast-timeline">{events.map((event) => <li key={event.quality_lifecycle_event_id}><div className="cyfast-timeline-dot" /><div><strong>{event.event_type}</strong><small>#{event.sequence_number} · {timestamp(event.occurred_at)}</small></div></li>)}</ol></details>
        </section>
      ) : <section className="cyfast-panel cyfast-empty">Select or create a lifecycle.</section>}
      <ContentPreview content={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
