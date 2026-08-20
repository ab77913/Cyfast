import React, { useMemo, useState } from "react";

const STATE_ORDER = [
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
  "SCRIPT_GENERATED",
  "SCRIPT_VALIDATED",
  "READY_FOR_EXECUTION",
  "EXECUTING",
  "COMPLETED",
];

const NEXT_STATE = Object.fromEntries(STATE_ORDER.slice(0, -1).map((state, index) => [state, STATE_ORDER[index + 1]]));
const ADDABLE_TYPES = {
  DOCUMENT_UPLOADED: ["REQUIREMENT", "RISK"],
  REQUIREMENTS_GENERATED: ["REQUIREMENT", "RISK"],
  REQUIREMENTS_APPROVED: ["TEST_SCENARIO", "RISK"],
  SCENARIOS_GENERATED: ["TEST_SCENARIO"],
  SCENARIOS_APPROVED: ["TEST_CASE"],
  TEST_CASES_GENERATED: ["TEST_CASE"],
  TEST_CASES_APPROVED: ["TEST_DATA"],
  TEST_DATA_GENERATED: ["TEST_DATA"],
  TEST_DATA_APPROVED: ["LOGICAL_STEP"],
  LOGICAL_STEPS_GENERATED: ["LOGICAL_STEP", "TEST_SCRIPT"],
  SCRIPT_GENERATED: ["TEST_SCRIPT", "VALIDATION_REPORT"],
  SCRIPT_VALIDATED: ["TEST_SCRIPT", "VALIDATION_REPORT"],
};

function statusClass(status) {
  return `cyfast-status cyfast-status-${String(status || "unknown").toLowerCase()}`;
}

function sha256Pattern(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ""));
}

export default function QualityLifecyclePanel({
  lifecycles = [],
  selected,
  items = [],
  events = [],
  readiness,
  loading,
  error,
  onCreate,
  onSelect,
  onAddItem,
  onApproveItem,
  onTransition,
  onStartExecution,
  targets = [],
  onRefresh,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    source_document_file_id: "",
    source_document_hash: "",
    source_document_version: "1",
  });
  const [itemForm, setItemForm] = useState({
    item_type: "",
    resource_id: "",
    resource_version: "1",
    source_item_id: "",
    source_anchor: "{}",
    content_hash: "",
    generation_origin: "AI",
    model_id: "",
  });
  const [localError, setLocalError] = useState("");
  const [executionTargetId, setExecutionTargetId] = useState("");

  const sourceItems = useMemo(() => items.filter((item) => item.approval_status === "APPROVED"), [items]);
  const addableTypes = selected ? ADDABLE_TYPES[selected.status] || [] : [];
  const nextState = selected ? NEXT_STATE[selected.status] : null;

  async function submitCreate(event) {
    event.preventDefault();
    setLocalError("");
    if (!sha256Pattern(createForm.source_document_hash)) {
      setLocalError("Source document hash must be a 64-character SHA-256 value.");
      return;
    }
    await onCreate(createForm);
    setShowCreate(false);
    setCreateForm({ name: "", source_document_file_id: "", source_document_hash: "", source_document_version: "1" });
  }

  async function submitItem(event) {
    event.preventDefault();
    setLocalError("");
    if (!sha256Pattern(itemForm.content_hash)) {
      setLocalError("Item content hash must be a 64-character SHA-256 value.");
      return;
    }
    let sourceAnchor;
    try {
      sourceAnchor = JSON.parse(itemForm.source_anchor || "{}");
    } catch (_) {
      setLocalError("Source anchor must be valid JSON.");
      return;
    }
    await onAddItem({
      item_type: itemForm.item_type,
      resource_id: itemForm.resource_id,
      resource_version: itemForm.resource_version,
      source_item_id: itemForm.source_item_id,
      source_anchor: sourceAnchor,
      generation_metadata: {
        origin: itemForm.generation_origin,
        ...(itemForm.model_id ? { model_id: itemForm.model_id } : {}),
      },
      approval_status: "PENDING",
      content_hash: itemForm.content_hash.toLowerCase(),
    });
    setItemForm({
      item_type: addableTypes[0] || "",
      resource_id: "",
      resource_version: "1",
      source_item_id: "",
      source_anchor: "{}",
      content_hash: "",
      generation_origin: "AI",
      model_id: "",
    });
  }

  return (
    <div className="cyfast-lifecycle-layout">
      <section className="cyfast-panel cyfast-lifecycle-list">
        <div className="cyfast-panel-heading">
          <div>
            <h3>Document-to-execution lifecycles</h3>
            <p>Every generated artifact keeps its source, version and approval.</p>
          </div>
          <div className="cyfast-actions">
            <button type="button" className="cyfast-button cyfast-button-secondary" onClick={onRefresh} disabled={loading}>
              Refresh
            </button>
            <button type="button" className="cyfast-button" onClick={() => setShowCreate((value) => !value)}>
              {showCreate ? "Close" : "New lifecycle"}
            </button>
          </div>
        </div>
        {error ? <div className="cyfast-alert cyfast-alert-error">{error}</div> : null}
        {localError ? <div className="cyfast-alert cyfast-alert-error">{localError}</div> : null}

        {showCreate ? (
          <form className="cyfast-form-grid" onSubmit={submitCreate}>
            <label>
              Lifecycle name
              <input required value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} />
            </label>
            <label>
              Uploaded document file ID
              <input required value={createForm.source_document_file_id} onChange={(event) => setCreateForm({ ...createForm, source_document_file_id: event.target.value })} />
            </label>
            <label className="cyfast-span-two">
              Source document SHA-256
              <input required className="cyfast-monospace" value={createForm.source_document_hash} onChange={(event) => setCreateForm({ ...createForm, source_document_hash: event.target.value })} />
            </label>
            <label>
              Document version
              <input required value={createForm.source_document_version} onChange={(event) => setCreateForm({ ...createForm, source_document_version: event.target.value })} />
            </label>
            <div className="cyfast-form-actions">
              <button type="submit" className="cyfast-button">Create lifecycle</button>
            </div>
          </form>
        ) : null}

        <div className="cyfast-card-list">
          {lifecycles.map((value) => (
            <button
              type="button"
              className={`cyfast-select-card ${selected?.quality_lifecycle_id === value.quality_lifecycle_id ? "is-selected" : ""}`}
              key={value.quality_lifecycle_id}
              onClick={() => onSelect(value)}
            >
              <span>
                <strong>{value.name}</strong>
                <small>{value.current_stage} · v{value.version}</small>
              </span>
              <span className={statusClass(value.status)}>{value.status}</span>
            </button>
          ))}
          {!lifecycles.length ? <div className="cyfast-empty">No lifecycle has been created for this project.</div> : null}
        </div>
      </section>

      {selected ? (
        <section className="cyfast-panel cyfast-lifecycle-detail">
          <div className="cyfast-panel-heading">
            <div>
              <h3>{selected.name}</h3>
              <p className="cyfast-monospace">{selected.quality_lifecycle_id}</p>
            </div>
            <span className={statusClass(selected.status)}>{selected.status}</span>
          </div>

          <div className="cyfast-stage-track" aria-label="Lifecycle stages">
            {STATE_ORDER.map((state) => {
              const currentIndex = STATE_ORDER.indexOf(selected.status);
              const stateIndex = STATE_ORDER.indexOf(state);
              return (
                <div className={`cyfast-stage ${stateIndex < currentIndex ? "is-complete" : stateIndex === currentIndex ? "is-current" : ""}`} key={state}>
                  <span>{stateIndex < currentIndex ? "✓" : stateIndex + 1}</span>
                  <small>{state.replaceAll("_", " ")}</small>
                </div>
              );
            })}
          </div>

          <div className="cyfast-proof-grid">
            <div><span>Document</span><strong>{selected.source_document_file_id}</strong></div>
            <div><span>Document version</span><strong>{selected.source_document_version}</strong></div>
            <div><span>Traceability complete</span><strong>{selected.traceability_complete ? "Yes" : "No"}</strong></div>
            <div><span>Ready for execution</span><strong>{selected.ready_for_execution ? "Yes" : "No"}</strong></div>
          </div>

          {readiness ? (
            <div className={readiness.ready ? "cyfast-alert cyfast-alert-success" : "cyfast-alert cyfast-alert-warning"}>
              <strong>{readiness.ready ? "Ready for real execution" : "Readiness gates remain"}</strong>
              {readiness.errors?.length ? <ul>{readiness.errors.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            </div>
          ) : null}

          {addableTypes.length ? (
            <form className="cyfast-form-grid" onSubmit={submitItem}>
              <h4 className="cyfast-span-two">Add generated or validated lifecycle item</h4>
              <label>
                Item type
                <select required value={itemForm.item_type} onChange={(event) => setItemForm({ ...itemForm, item_type: event.target.value })}>
                  <option value="">Select type</option>
                  {addableTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label>
                Resource ID
                <input required value={itemForm.resource_id} onChange={(event) => setItemForm({ ...itemForm, resource_id: event.target.value })} />
              </label>
              <label>
                Resource version
                <input required value={itemForm.resource_version} onChange={(event) => setItemForm({ ...itemForm, resource_version: event.target.value })} />
              </label>
              <label>
                Source item
                <select required value={itemForm.source_item_id} onChange={(event) => setItemForm({ ...itemForm, source_item_id: event.target.value })}>
                  <option value="">Select approved source</option>
                  {sourceItems.map((item) => (
                    <option value={item.quality_lifecycle_item_id} key={item.quality_lifecycle_item_id}>
                      {item.item_type} · {item.resource_id} · v{item.resource_version}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cyfast-span-two">
                Source anchor JSON
                <textarea required rows="3" value={itemForm.source_anchor} onChange={(event) => setItemForm({ ...itemForm, source_anchor: event.target.value })} />
              </label>
              <label className="cyfast-span-two">
                Content SHA-256
                <input required className="cyfast-monospace" value={itemForm.content_hash} onChange={(event) => setItemForm({ ...itemForm, content_hash: event.target.value })} />
              </label>
              <label>
                Origin
                <select value={itemForm.generation_origin} onChange={(event) => setItemForm({ ...itemForm, generation_origin: event.target.value })}>
                  <option value="AI">AI generated</option>
                  <option value="USER">User authored</option>
                  <option value="IMPORT">Imported</option>
                </select>
              </label>
              <label>
                Model ID
                <input value={itemForm.model_id} onChange={(event) => setItemForm({ ...itemForm, model_id: event.target.value })} />
              </label>
              <div className="cyfast-form-actions cyfast-span-two">
                <button type="submit" className="cyfast-button">Add versioned item</button>
              </div>
            </form>
          ) : null}

          <div className="cyfast-table-wrap">
            <table className="cyfast-table">
              <thead><tr><th>Type</th><th>Resource</th><th>Version</th><th>Source</th><th>Approval</th><th /></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.quality_lifecycle_item_id}>
                    <td>{item.item_type}</td>
                    <td>{item.resource_id}</td>
                    <td>{item.resource_version}</td>
                    <td className="cyfast-monospace">{item.source_item_id || "Original upload"}</td>
                    <td><span className={statusClass(item.approval_status)}>{item.approval_status}</span></td>
                    <td>
                      {item.approval_status === "PENDING" ? (
                        <div className="cyfast-actions">
                          <button type="button" className="cyfast-link-button" onClick={() => onApproveItem(item, "APPROVED")}>Approve</button>
                          <button type="button" className="cyfast-link-button cyfast-link-danger" onClick={() => onApproveItem(item, "REJECTED")}>Reject</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected.status === "READY_FOR_EXECUTION" ? (
            <div className="cyfast-transition-box">
              <div>
                <strong>Start approved script in real environment</strong>
                <span>The run is linked to this lifecycle and cannot PASS without real proof.</span>
              </div>
              <div className="cyfast-actions">
                <select value={executionTargetId} onChange={(event) => setExecutionTargetId(event.target.value)}>
                  <option value="">Select ready target</option>
                  {targets.filter((target) => target.status === "READY").map((target) => (
                    <option value={target.execution_target_id} key={target.execution_target_id}>{target.name} · {target.platform}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="cyfast-button"
                  disabled={!executionTargetId || loading}
                  onClick={() => onStartExecution({
                    execution_target_id: executionTargetId,
                    timeout_seconds: 900,
                    evidence_policy: {
                      screen_recording: true,
                      screenshots: true,
                      device_logs: true,
                      protocol_trace: true,
                    },
                  })}
                >
                  Start real execution
                </button>
              </div>
            </div>
          ) : null}

          {nextState ? (
            <div className="cyfast-transition-box">
              <div>
                <strong>Next controlled transition</strong>
                <span>{selected.status} → {nextState}</span>
              </div>
              <button type="button" className="cyfast-button" onClick={() => onTransition(nextState)} disabled={loading}>
                Move to {nextState.replaceAll("_", " ")}
              </button>
            </div>
          ) : null}

          <details className="cyfast-details">
            <summary>Immutable lifecycle events ({events.length})</summary>
            <ol className="cyfast-timeline">
              {events.map((event) => (
                <li key={event.quality_lifecycle_event_id}>
                  <div className="cyfast-timeline-dot" />
                  <div><strong>{event.event_type}</strong><small>#{event.sequence_number} · {event.occurred_at}</small></div>
                </li>
              ))}
            </ol>
          </details>
        </section>
      ) : (
        <section className="cyfast-panel cyfast-empty">Select a lifecycle to review generation and approval gates.</section>
      )}
    </div>
  );
}
