import React, { useMemo, useState } from "react";
import ProductFixPanel from "./ProductFixPanel";

const TERMINAL = new Set(["PASSED", "FAILED", "BLOCKED", "CANCELLED"]);

function statusClass(status) {
  const normalized = String(status || "UNKNOWN").toLowerCase();
  return `cyfast-status cyfast-status-${normalized}`;
}

function timestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function boolLabel(value) {
  return value === true || value === 1 ? "Yes" : "No";
}

function Section({ title, children, count }) {
  return (
    <section className="cyfast-subpanel">
      <div className="cyfast-subpanel-heading">
        <h4>{title}</h4>
        {count !== undefined ? <span className="cyfast-count">{count}</span> : null}
      </div>
      {children}
    </section>
  );
}

export default function ExecutionProofPanel({
  projectId,
  run,
  events = [],
  artifacts = [],
  recordings = [],
  defects = [],
  repairs = [],
  traceGraph,
  loading,
  error,
  onCancel,
  onRefresh,
  onUpdateDefect,
  onApproveRepair,
  onGenerateAiRepair,
  aiRepairLoading,
  artifactUrl,
}) {
  const [downloading, setDownloading] = useState("");
  const evidenceTypes = useMemo(() => new Set(artifacts.map((item) => item.artifact_type)), [artifacts]);
  if (!run) return <div className="cyfast-empty">Select an execution run to inspect its proof and evidence.</div>;

  async function download(artifact) {
    setDownloading(artifact.execution_artifact_id);
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
      const userId = localStorage.getItem("user_id") || localStorage.getItem("userId") || "";
      const organizationId = localStorage.getItem("organization_id") || localStorage.getItem("organizationId") || "";
      const response = await fetch(artifactUrl(projectId, artifact.execution_artifact_id), {
        credentials: "include",
        headers: {
          ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
          ...(userId ? { "x-user-id": userId } : {}),
          ...(organizationId ? { "x-organization-id": organizationId } : {}),
          "x-project-id": String(projectId),
        },
      });
      if (!response.ok) throw new Error(`Artifact download failed with HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = artifact.filename || "artifact.bin";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading("");
    }
  }

  const terminal = TERMINAL.has(run.status);
  return (
    <div className="cyfast-proof-layout">
      <section className="cyfast-panel">
        <div className="cyfast-panel-heading">
          <div>
            <h3>Execution proof</h3>
            <p className="cyfast-monospace">{run.execution_run_id}</p>
          </div>
          <div className="cyfast-actions">
            <span className={statusClass(run.status)}>{run.status}</span>
            <button type="button" className="cyfast-button cyfast-button-secondary" onClick={onRefresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            {!terminal ? (
              <button type="button" className="cyfast-button cyfast-button-danger" onClick={() => onCancel(run)}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
        {error ? <div className="cyfast-alert cyfast-alert-error">{error}</div> : null}

        <div className="cyfast-proof-grid">
          <div><span>Platform</span><strong>{run.platform}</strong></div>
          <div><span>Real execution</span><strong>{boolLabel(run.real_execution)}</strong></div>
          <div><span>Simulated</span><strong>{boolLabel(run.simulated)}</strong></div>
          <div><span>Target connected</span><strong>{boolLabel(run.target_connected)}</strong></div>
          <div><span>Session created</span><strong>{boolLabel(run.session_created)}</strong></div>
          <div><span>Exit code</span><strong>{run.exit_code ?? "—"}</strong></div>
          <div><span>Meaningful actions</span><strong>{run.meaningful_actions ?? 0}</strong></div>
          <div><span>Meaningful assertions</span><strong>{run.meaningful_assertions ?? 0}</strong></div>
          <div><span>Started</span><strong>{timestamp(run.started_at)}</strong></div>
          <div><span>Finished</span><strong>{timestamp(run.finished_at)}</strong></div>
          <div><span>Attempt</span><strong>{run.attempt_number || 1}</strong></div>
          <div><span>Proof hash</span><strong className="cyfast-monospace">{run.proof_hash || "Not established"}</strong></div>
        </div>

        {run.failure_classification || run.failure_message ? (
          <div className="cyfast-alert cyfast-alert-warning">
            <strong>{run.failure_classification || "Execution failure"}</strong>
            <div>{run.failure_message}</div>
          </div>
        ) : null}

        <div className="cyfast-proof-checks">
          {["execution_log", "output_xml", "runtime_proof", "screenshot", "device_log", "protocol_trace"].map((type) => (
            <span key={type} className={evidenceTypes.has(type) ? "cyfast-proof-check is-present" : "cyfast-proof-check"}>
              {evidenceTypes.has(type) ? "✓" : "—"} {type.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      </section>

      <Section title="Ordered timeline" count={events.length}>
        <ol className="cyfast-timeline">
          {events.map((event) => (
            <li key={event.execution_event_id || `${event.sequence_number}-${event.event_type}`}>
              <div className="cyfast-timeline-dot" />
              <div>
                <strong>{event.event_type}</strong>
                <div>{timestamp(event.occurred_at)}</div>
                <small>#{event.sequence_number} · {event.actor_type}{event.actor_id ? ` · ${event.actor_id}` : ""}</small>
              </div>
            </li>
          ))}
          {!events.length ? <li className="cyfast-empty">No execution events yet.</li> : null}
        </ol>
      </Section>

      <Section title="Artifacts and evidence" count={artifacts.length}>
        <div className="cyfast-table-wrap">
          <table className="cyfast-table">
            <thead><tr><th>Type</th><th>File</th><th>Size</th><th>Checksum</th><th /></tr></thead>
            <tbody>
              {artifacts.map((artifact) => (
                <tr key={artifact.execution_artifact_id}>
                  <td>{artifact.artifact_type}</td>
                  <td>{artifact.filename}</td>
                  <td>{Number(artifact.size_bytes || 0).toLocaleString()} B</td>
                  <td className="cyfast-monospace">{artifact.content_hash}</td>
                  <td>
                    <button type="button" className="cyfast-link-button" onClick={() => download(artifact)} disabled={downloading === artifact.execution_artifact_id}>
                      {downloading === artifact.execution_artifact_id ? "Downloading…" : "Download"}
                    </button>
                  </td>
                </tr>
              ))}
              {!artifacts.length ? <tr><td colSpan="5" className="cyfast-empty-cell">No artifacts stored</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recordings" count={recordings.length}>
        <div className="cyfast-card-list">
          {recordings.map((recording) => (
            <article className="cyfast-mini-card" key={recording.execution_recording_id}>
              <strong>{recording.recording_type}</strong>
              <span>{recording.format}</span>
              <small>{timestamp(recording.started_at)} → {timestamp(recording.finished_at)}</small>
              <small>{recording.redacted ? "Secrets redacted" : "Unredacted — review required"}</small>
            </article>
          ))}
          {!recordings.length ? <div className="cyfast-empty">No recording was stored for this run.</div> : null}
        </div>
      </Section>

      <Section title="Defects" count={defects.length}>
        <div className="cyfast-card-list">
          {defects.map((defect) => (
            <article className="cyfast-mini-card" key={defect.execution_defect_id}>
              <div className="cyfast-mini-card-heading">
                <strong>{defect.title}</strong>
                <span className={statusClass(defect.status)}>{defect.status}</span>
              </div>
              <p>{defect.description}</p>
              <small>{defect.classification} · {defect.severity}</small>
              <div className="cyfast-actions">
                {defect.status !== "RESOLVED" ? (
                  <button type="button" className="cyfast-link-button" onClick={() => onUpdateDefect(defect, { status: "RESOLVED", resolution: "Resolved and linked to rerun evidence" })}>
                    Mark resolved
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!defects.length ? <div className="cyfast-empty">No defects are linked to this run.</div> : null}
        </div>
      </Section>

      {run.status === "REPAIR_PENDING" ? (
        <section className="cyfast-subpanel">
          <div className="cyfast-subpanel-heading">
            <div>
              <h4>Bounded AI script repair</h4>
              <p>Only locator, timing, import, or script defects are eligible. Approval and a saved script version remain required.</p>
            </div>
            <button type="button" className="cyfast-button" onClick={() => onGenerateAiRepair(run)} disabled={aiRepairLoading}>
              {aiRepairLoading ? "Generating…" : "Generate bounded AI repair"}
            </button>
          </div>
        </section>
      ) : null}

      <ProductFixPanel projectId={projectId} run={run} defects={defects} />

      <Section title="Repair attempts" count={repairs.length}>
        <div className="cyfast-card-list">
          {repairs.map((repair) => (
            <article className="cyfast-mini-card" key={repair.execution_repair_attempt_id}>
              <div className="cyfast-mini-card-heading">
                <strong>Attempt {repair.attempt_number}</strong>
                <span className={statusClass(repair.approval_status)}>{repair.approval_status}</span>
              </div>
              <p>{repair.rationale}</p>
              <small className="cyfast-monospace">{repair.proposed_script_hash}</small>
              {repair.approval_status === "PENDING" ? (
                <button type="button" className="cyfast-link-button" onClick={() => onApproveRepair(repair)}>
                  Review, save version and rerun
                </button>
              ) : null}
            </article>
          ))}
          {!repairs.length ? <div className="cyfast-empty">No AI repair attempts are linked to this run.</div> : null}
        </div>
      </Section>

      <Section title="Traceability graph" count={traceGraph?.nodes?.length || 0}>
        <div className="cyfast-trace-grid">
          {(traceGraph?.nodes || []).map((node) => (
            <div className="cyfast-trace-node" key={node.id}>
              <strong>{node.type}</strong>
              <span>{node.resource_id}</span>
              {node.resource_version ? <small>v{node.resource_version}</small> : null}
            </div>
          ))}
          {!traceGraph?.nodes?.length ? <div className="cyfast-empty">No traceability links have been persisted.</div> : null}
        </div>
      </Section>
    </div>
  );
}
