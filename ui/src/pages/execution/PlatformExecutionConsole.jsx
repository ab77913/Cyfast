import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import platformExecutionApi from "../../services/platformExecutionApi";
import ExecutionMetricsPanel from "./ExecutionMetricsPanel";
import ExecutionProofPanel from "./ExecutionProofPanel";
import QualityLifecycleWorkspace from "./QualityLifecycleWorkspace";
import "./platform-execution.css";

const TERMINAL = new Set(["PASSED", "FAILED", "BLOCKED", "CANCELLED"]);
const PLATFORMS = ["WINDOWS", "LINUX", "ANDROID", "EMBEDDED"];
const DEFAULT_CAPABILITIES = {
  WINDOWS: "windows_robot,interactive_desktop,windows_uia,appium_windows",
  LINUX: "linux_robot,pytest,ssh",
  ANDROID: "android_appium,adb,screen_recording,device_log",
  EMBEDDED: "can,embedded_generic",
};
const DEFAULT_CONFIGURATION = {
  WINDOWS: { interactive_session_required: true },
  LINUX: { desktop_required: false },
  ANDROID: { device_id: "" },
  EMBEDDED: { protocol: "can", interface_reference: "" },
};

function storageValue(...keys) {
  for (const key of keys) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value) return value;
  }
  return "";
}

function statusClass(status) {
  return `cyfast-status cyfast-status-${String(status || "unknown").toLowerCase()}`;
}

function timestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function objectValue(value) {
  return value?.toJSON ? value.toJSON() : value;
}

export default function PlatformExecutionConsole() {
  const params = useParams();
  const projectId = Number(
    params.projectId
      || params.project_id
      || params.id
      || storageValue("selected_project_id", "project_id", "projectId"),
  );
  const [activeTab, setActiveTab] = useState("execute");
  const [targets, setTargets] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [defects, setDefects] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [traceGraph, setTraceGraph] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [lifecycles, setLifecycles] = useState([]);
  const [selectedLifecycle, setSelectedLifecycle] = useState(null);
  const [lifecycleItems, setLifecycleItems] = useState([]);
  const [lifecycleEvents, setLifecycleEvents] = useState([]);
  const [lifecycleReadiness, setLifecycleReadiness] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetForm, setTargetForm] = useState({
    name: "",
    platform: "WINDOWS",
    endpoint: "https://",
    credential_reference: "CYFAST_TARGET_TOKEN",
    capabilities: DEFAULT_CAPABILITIES.WINDOWS,
    configuration: JSON.stringify(DEFAULT_CONFIGURATION.WINDOWS, null, 2),
  });
  const [runForm, setRunForm] = useState({
    execution_target_id: "",
    test_script_id: "",
    timeout_seconds: 900,
    evidence_policy: {
      screen_recording: true,
      screenshots: true,
      device_logs: true,
      protocol_trace: true,
      retention_classification: "STANDARD",
    },
  });
  const [repairApproval, setRepairApproval] = useState(null);
  const [aiRepairLoading, setAiRepairLoading] = useState(false);
  const pollController = useRef(null);

  const selectedTarget = useMemo(
    () => targets.find((target) => target.execution_target_id === runForm.execution_target_id),
    [targets, runForm.execution_target_id],
  );

  const clearMessages = useCallback(() => {
    setError("");
    setNotice("");
  }, []);

  const reportError = useCallback((value) => {
    setError(`${value.code ? `${value.code}: ` : ""}${value.message || value}`);
  }, []);

  const loadTargetsAndRuns = useCallback(async () => {
    if (!Number.isInteger(projectId) || projectId <= 0) return;
    setLoading(true);
    clearMessages();
    try {
      const [targetResult, runResult] = await Promise.all([
        platformExecutionApi.listTargets(projectId, { page_size: 100 }),
        platformExecutionApi.listRuns(projectId, { page_size: 100 }),
      ]);
      const targetItems = targetResult.items || [];
      setTargets(targetItems);
      setRuns(runResult.items || []);
      setRunForm((current) => ({
        ...current,
        execution_target_id: current.execution_target_id || targetItems[0]?.execution_target_id || "",
      }));
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }, [clearMessages, projectId, reportError]);

  const loadRunDetails = useCallback(async (runId, { quiet = false } = {}) => {
    if (!runId || !projectId) return null;
    if (!quiet) setDetailLoading(true);
    pollController.current?.abort();
    const controller = new AbortController();
    pollController.current = controller;
    try {
      const [runValue, eventResult, artifactResult, recordingResult, defectResult, repairResult, traceValue] = await Promise.all([
        platformExecutionApi.getRun(projectId, runId, controller.signal),
        platformExecutionApi.runEvents(projectId, runId),
        platformExecutionApi.runArtifacts(projectId, runId),
        platformExecutionApi.runRecordings(projectId, runId),
        platformExecutionApi.runDefects(projectId, runId),
        platformExecutionApi.runRepairs(projectId, runId),
        platformExecutionApi.runTraceability(projectId, runId).catch(() => ({ nodes: [], edges: [] })),
      ]);
      setRun(runValue);
      setEvents(eventResult.items || []);
      setArtifacts(artifactResult.items || []);
      setRecordings(recordingResult.items || []);
      setDefects(defectResult.items || []);
      setRepairs(repairResult.items || []);
      setTraceGraph(traceValue);
      setRuns((current) => current.map((item) => item.execution_run_id === runId ? runValue : item));
      return runValue;
    } catch (value) {
      if (value.name !== "AbortError") reportError(value);
      return null;
    } finally {
      if (!quiet) setDetailLoading(false);
    }
  }, [projectId, reportError]);

  const loadMetrics = useCallback(async () => {
    if (!projectId) return;
    setMetricsLoading(true);
    try {
      setMetrics(await platformExecutionApi.metrics(projectId, { days: 30 }));
    } catch (value) {
      reportError(value);
    } finally {
      setMetricsLoading(false);
    }
  }, [projectId, reportError]);

  const loadLifecycles = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await platformExecutionApi.listQualityLifecycles(projectId, { page_size: 100 });
      const items = result.items || [];
      setLifecycles(items);
      if (selectedLifecycle) {
        const latest = items.find((item) => item.quality_lifecycle_id === selectedLifecycle.quality_lifecycle_id);
        if (latest) setSelectedLifecycle(latest);
      }
    } catch (value) {
      reportError(value);
    }
  }, [projectId, reportError, selectedLifecycle]);

  const loadLifecycleDetails = useCallback(async (value) => {
    if (!value || !projectId) return;
    setSelectedLifecycle(value);
    setDetailLoading(true);
    try {
      const [latest, itemResult, eventResult, readinessValue] = await Promise.all([
        platformExecutionApi.getQualityLifecycle(projectId, value.quality_lifecycle_id),
        platformExecutionApi.lifecycleItems(projectId, value.quality_lifecycle_id),
        platformExecutionApi.lifecycleEvents(projectId, value.quality_lifecycle_id),
        platformExecutionApi.lifecycleReadiness(projectId, value.quality_lifecycle_id),
      ]);
      setSelectedLifecycle(latest);
      setLifecycleItems(itemResult.items || []);
      setLifecycleEvents(eventResult.items || []);
      setLifecycleReadiness(readinessValue);
    } catch (reason) {
      reportError(reason);
    } finally {
      setDetailLoading(false);
    }
  }, [projectId, reportError]);

  useEffect(() => {
    loadTargetsAndRuns();
    loadMetrics();
    loadLifecycles();
    return () => pollController.current?.abort();
  }, [loadTargetsAndRuns, loadMetrics, loadLifecycles]);

  useEffect(() => {
    if (!selectedRunId) return undefined;
    loadRunDetails(selectedRunId);
    const interval = window.setInterval(async () => {
      const latest = await loadRunDetails(selectedRunId, { quiet: true });
      if (latest && TERMINAL.has(latest.status)) window.clearInterval(interval);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [loadRunDetails, selectedRunId]);

  async function createTarget(event) {
    event.preventDefault();
    clearMessages();
    let configuration;
    try {
      configuration = JSON.parse(targetForm.configuration || "{}");
    } catch (_) {
      setError("Target configuration must be valid JSON.");
      return;
    }
    setLoading(true);
    try {
      const created = await platformExecutionApi.createTarget(projectId, {
        name: targetForm.name,
        platform: targetForm.platform,
        endpoint: targetForm.endpoint,
        credential_reference: targetForm.credential_reference,
        capabilities: targetForm.capabilities.split(",").map((value) => value.trim()).filter(Boolean),
        configuration,
      });
      setNotice(`Target ${created.name} was registered.`);
      setShowTargetForm(false);
      await loadTargetsAndRuns();
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }

  async function checkTarget(target) {
    clearMessages();
    setLoading(true);
    try {
      const health = await platformExecutionApi.checkTarget(projectId, target.execution_target_id);
      setNotice(health.ready ? `${target.name} is ready.` : `${target.name} is not ready: ${health.message || health.error_code}`);
      await loadTargetsAndRuns();
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }

  async function startRun(event) {
    event.preventDefault();
    clearMessages();
    if (!runForm.execution_target_id || !runForm.test_script_id) {
      setError("Select a target and an approved test script.");
      return;
    }
    setLoading(true);
    try {
      const created = await platformExecutionApi.startRun(projectId, {
        execution_target_id: runForm.execution_target_id,
        test_script_id: runForm.test_script_id,
        timeout_seconds: Number(runForm.timeout_seconds),
        evidence_policy: runForm.evidence_policy,
        runtime: selectedTarget?.configuration || {},
      });
      setNotice(`Execution ${created.execution_run_id} was accepted.`);
      await loadTargetsAndRuns();
      setSelectedRunId(created.execution_run_id);
      setActiveTab("runs");
    } catch (value) {
      reportError(value);
    } finally {
      setLoading(false);
    }
  }

  async function cancelRun(value) {
    clearMessages();
    try {
      await platformExecutionApi.cancelRun(projectId, value.execution_run_id);
      setNotice("Cancellation was recorded and propagated to the target.");
      await loadRunDetails(value.execution_run_id);
    } catch (reason) {
      reportError(reason);
    }
  }

  async function updateDefect(defect, patch) {
    clearMessages();
    try {
      await platformExecutionApi.updateDefect(projectId, defect.execution_defect_id, patch);
      setNotice(`Defect ${defect.execution_defect_id} was updated.`);
      await loadRunDetails(run.execution_run_id);
    } catch (value) {
      reportError(value);
    }
  }

  async function generateAiRepair(value) {
    clearMessages();
    setAiRepairLoading(true);
    try {
      const generated = await platformExecutionApi.proposeAiRepair(projectId, value.execution_run_id);
      setNotice(`AI repair attempt ${generated.repair.attempt_number} was generated and is awaiting review.`);
      await loadRunDetails(value.execution_run_id);
    } catch (reason) {
      reportError(reason);
    } finally {
      setAiRepairLoading(false);
    }
  }

  async function approveRepair(event) {
    event.preventDefault();
    clearMessages();
    try {
      const rerun = await platformExecutionApi.approveRepairAndRerun(
        projectId,
        run.execution_run_id,
        repairApproval.execution_repair_attempt_id,
        {
          approved_test_script_id: repairApproval.approved_test_script_id,
          approved_test_script_version: repairApproval.approved_test_script_version,
          timeout_seconds: Number(repairApproval.timeout_seconds || runForm.timeout_seconds),
        },
      );
      setRepairApproval(null);
      setNotice(`Approved script version was dispatched as rerun ${rerun.execution_run_id}.`);
      await loadTargetsAndRuns();
      setSelectedRunId(rerun.execution_run_id);
    } catch (value) {
      reportError(value);
    }
  }

  async function createLifecycle(input) {
    clearMessages();
    try {
      const created = await platformExecutionApi.createQualityLifecycle(projectId, input);
      setNotice(`Lifecycle ${created.name} was created.`);
      await loadLifecycles();
      await loadLifecycleDetails(created);
    } catch (value) {
      reportError(value);
    }
  }

  async function addLifecycleItem(input) {
    clearMessages();
    try {
      await platformExecutionApi.addLifecycleItem(projectId, selectedLifecycle.quality_lifecycle_id, input);
      setNotice(`${input.item_type} version was linked to the lifecycle.`);
      await loadLifecycleDetails(selectedLifecycle);
    } catch (value) {
      reportError(value);
    }
  }

  async function approveLifecycleItem(item, approvalStatus) {
    clearMessages();
    try {
      await platformExecutionApi.approveLifecycleItem(projectId, selectedLifecycle.quality_lifecycle_id, item.quality_lifecycle_item_id, {
        approval_status: approvalStatus,
      });
      setNotice(`${item.item_type} was ${approvalStatus.toLowerCase()}.`);
      await loadLifecycleDetails(selectedLifecycle);
    } catch (value) {
      reportError(value);
    }
  }

  async function startQualityLifecycleExecution(input) {
    clearMessages();
    setLoading(true);
    try {
      const value = await platformExecutionApi.startLifecycleExecution(
        projectId,
        selectedLifecycle.quality_lifecycle_id,
        input,
      );
      setNotice(`Lifecycle execution ${value.run.execution_run_id} was started.`);
      await loadLifecycles();
      await loadTargetsAndRuns();
      setSelectedRunId(value.run.execution_run_id);
      setActiveTab("runs");
    } catch (reason) {
      reportError(reason);
    } finally {
      setLoading(false);
    }
  }

  async function transitionLifecycle(status) {
    clearMessages();
    try {
      await platformExecutionApi.transitionLifecycle(projectId, selectedLifecycle.quality_lifecycle_id, status);
      setNotice(`Lifecycle moved to ${status}.`);
      await loadLifecycles();
      await loadLifecycleDetails(selectedLifecycle);
    } catch (value) {
      reportError(value);
    }
  }

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return <div className="cyfast-alert cyfast-alert-error">A valid project must be selected before opening the execution lifecycle.</div>;
  }

  return (
    <main className="cyfast-execution-page">
      <header className="cyfast-page-header">
        <div>
          <span className="cyfast-eyebrow">CyFAST quality lifecycle</span>
          <h1>Generate, execute, repair and prove</h1>
          <p>One evidence-based process for Windows, Linux, Android and embedded targets.</p>
        </div>
        <div className="cyfast-project-chip">Project {projectId}</div>
      </header>

      {notice ? <div className="cyfast-alert cyfast-alert-success">{notice}</div> : null}
      {error ? <div className="cyfast-alert cyfast-alert-error">{error}</div> : null}

      <nav className="cyfast-tabs" aria-label="Execution lifecycle sections">
        {[
          ["execute", "Execute"],
          ["runs", "Runs and evidence"],
          ["lifecycle", "Document lifecycle"],
          ["metrics", "Performance"],
        ].map(([value, label]) => (
          <button type="button" key={value} className={activeTab === value ? "is-active" : ""} onClick={() => setActiveTab(value)}>
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "execute" ? (
        <div className="cyfast-two-column cyfast-execute-grid">
          <section className="cyfast-panel">
            <div className="cyfast-panel-heading">
              <div><h3>Execution targets</h3><p>Health is checked on the real target before dispatch.</p></div>
              <button type="button" className="cyfast-button" onClick={() => setShowTargetForm((value) => !value)}>
                {showTargetForm ? "Close" : "Register target"}
              </button>
            </div>
            {showTargetForm ? (
              <form className="cyfast-form-grid" onSubmit={createTarget}>
                <label>Target name<input required value={targetForm.name} onChange={(event) => setTargetForm({ ...targetForm, name: event.target.value })} /></label>
                <label>
                  Platform
                  <select value={targetForm.platform} onChange={(event) => {
                    const platform = event.target.value;
                    setTargetForm({
                      ...targetForm,
                      platform,
                      capabilities: DEFAULT_CAPABILITIES[platform],
                      configuration: JSON.stringify(DEFAULT_CONFIGURATION[platform], null, 2),
                    });
                  }}>
                    {PLATFORMS.map((platform) => <option key={platform}>{platform}</option>)}
                  </select>
                </label>
                <label className="cyfast-span-two">HTTPS endpoint<input required value={targetForm.endpoint} onChange={(event) => setTargetForm({ ...targetForm, endpoint: event.target.value })} /></label>
                <label>Credential environment reference<input required value={targetForm.credential_reference} onChange={(event) => setTargetForm({ ...targetForm, credential_reference: event.target.value })} /></label>
                <label>Capabilities<input required value={targetForm.capabilities} onChange={(event) => setTargetForm({ ...targetForm, capabilities: event.target.value })} /></label>
                <label className="cyfast-span-two">Configuration JSON<textarea rows="5" value={targetForm.configuration} onChange={(event) => setTargetForm({ ...targetForm, configuration: event.target.value })} /></label>
                <div className="cyfast-form-actions cyfast-span-two"><button className="cyfast-button" type="submit" disabled={loading}>Save target</button></div>
              </form>
            ) : null}
            <div className="cyfast-card-list">
              {targets.map((target) => (
                <article className="cyfast-mini-card" key={target.execution_target_id}>
                  <div className="cyfast-mini-card-heading">
                    <div><strong>{target.name}</strong><small>{target.platform}</small></div>
                    <span className={statusClass(target.status)}>{target.status}</span>
                  </div>
                  <p>{target.endpoint}</p>
                  <small>{(target.capabilities || []).join(" · ")}</small>
                  <div className="cyfast-actions">
                    <button type="button" className="cyfast-link-button" onClick={() => checkTarget(target)}>Check readiness</button>
                  </div>
                </article>
              ))}
              {!targets.length ? <div className="cyfast-empty">Register a real Windows, Linux, Android or embedded target.</div> : null}
            </div>
          </section>

          <section className="cyfast-panel">
            <div className="cyfast-panel-heading">
              <div><h3>Run approved test script</h3><p>The server hydrates and validates the stored script package.</p></div>
            </div>
            <form className="cyfast-form-grid" onSubmit={startRun}>
              <label className="cyfast-span-two">
                Real execution target
                <select required value={runForm.execution_target_id} onChange={(event) => setRunForm({ ...runForm, execution_target_id: event.target.value })}>
                  <option value="">Select target</option>
                  {targets.filter((target) => target.status !== "REVOKED").map((target) => (
                    <option value={target.execution_target_id} key={target.execution_target_id}>{target.name} · {target.platform} · {target.status}</option>
                  ))}
                </select>
              </label>
              <label>
                Approved Test Script ID
                <input required value={runForm.test_script_id} onChange={(event) => setRunForm({ ...runForm, test_script_id: event.target.value })} />
              </label>
              <label>
                Timeout seconds
                <input type="number" min="30" max="86400" value={runForm.timeout_seconds} onChange={(event) => setRunForm({ ...runForm, timeout_seconds: event.target.value })} />
              </label>
              <fieldset className="cyfast-span-two cyfast-fieldset">
                <legend>Evidence policy</legend>
                {[
                  ["screen_recording", "Screen recording"],
                  ["screenshots", "Screenshots"],
                  ["device_logs", "Device logs"],
                  ["protocol_trace", "Protocol trace"],
                ].map(([key, label]) => (
                  <label className="cyfast-checkbox" key={key}>
                    <input type="checkbox" checked={runForm.evidence_policy[key]} onChange={(event) => setRunForm({ ...runForm, evidence_policy: { ...runForm.evidence_policy, [key]: event.target.checked } })} />
                    {label}
                  </label>
                ))}
              </fieldset>
              {selectedTarget ? (
                <div className="cyfast-span-two cyfast-target-summary">
                  <strong>{selectedTarget.platform}</strong>
                  <span>{selectedTarget.name}</span>
                  <span className={statusClass(selectedTarget.status)}>{selectedTarget.status}</span>
                </div>
              ) : null}
              <div className="cyfast-form-actions cyfast-span-two">
                <button type="submit" className="cyfast-button" disabled={loading || !targets.length}>
                  {loading ? "Starting…" : "Run in real environment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {activeTab === "runs" ? (
        <div className="cyfast-runs-layout">
          <aside className="cyfast-panel cyfast-run-list">
            <div className="cyfast-panel-heading">
              <div><h3>Execution runs</h3><p>Failed attempts are never overwritten.</p></div>
              <button type="button" className="cyfast-button cyfast-button-secondary" onClick={loadTargetsAndRuns}>Refresh</button>
            </div>
            {runs.map((value) => (
              <button type="button" key={value.execution_run_id} className={`cyfast-select-card ${selectedRunId === value.execution_run_id ? "is-selected" : ""}`} onClick={() => setSelectedRunId(value.execution_run_id)}>
                <span><strong>{value.platform} · Script {value.test_script_id}</strong><small>{timestamp(value.created_date)} · Attempt {value.attempt_number || 1}</small></span>
                <span className={statusClass(value.status)}>{value.status}</span>
              </button>
            ))}
            {!runs.length ? <div className="cyfast-empty">No execution runs yet.</div> : null}
          </aside>
          <ExecutionProofPanel
            projectId={projectId}
            run={run}
            events={events}
            artifacts={artifacts}
            recordings={recordings}
            defects={defects}
            repairs={repairs}
            traceGraph={traceGraph}
            loading={detailLoading}
            error=""
            onCancel={cancelRun}
            onRefresh={() => loadRunDetails(selectedRunId)}
            onUpdateDefect={updateDefect}
            onApproveRepair={(repair) => setRepairApproval({ ...repair, approved_test_script_id: "", approved_test_script_version: "", timeout_seconds: runForm.timeout_seconds })}
            onGenerateAiRepair={generateAiRepair}
            aiRepairLoading={aiRepairLoading}
            artifactUrl={platformExecutionApi.artifactUrl}
          />
        </div>
      ) : null}

      {activeTab === "lifecycle" ? (
        <QualityLifecycleWorkspace
          projectId={projectId}
          targets={targets}
          onExecutionStarted={(value) => {
            setRuns((current) => [value, ...current.filter((item) => item.execution_run_id !== value.execution_run_id)]);
            setSelectedRunId(value.execution_run_id);
            setActiveTab("runs");
          }}
        />
      ) : null}

      {activeTab === "metrics" ? (
        <ExecutionMetricsPanel metrics={metrics} loading={metricsLoading} error="" onRefresh={loadMetrics} />
      ) : null}

      {repairApproval ? (
        <div className="cyfast-modal-backdrop" role="presentation" onMouseDown={() => setRepairApproval(null)}>
          <form className="cyfast-modal" onSubmit={approveRepair} onMouseDown={(event) => event.stopPropagation()}>
            <div className="cyfast-panel-heading"><h3>Approve saved repair version</h3><button type="button" className="cyfast-link-button" onClick={() => setRepairApproval(null)}>Close</button></div>
            <p>Save the proposed script through the normal Test Script versioning/review flow first. CyFAST will not run an unsaved AI response.</p>
            <label>Approved Test Script ID<input required value={repairApproval.approved_test_script_id} onChange={(event) => setRepairApproval({ ...repairApproval, approved_test_script_id: event.target.value })} /></label>
            <label>Approved script version<input required value={repairApproval.approved_test_script_version} onChange={(event) => setRepairApproval({ ...repairApproval, approved_test_script_version: event.target.value })} /></label>
            <label>Timeout seconds<input type="number" min="30" max="86400" value={repairApproval.timeout_seconds} onChange={(event) => setRepairApproval({ ...repairApproval, timeout_seconds: event.target.value })} /></label>
            <div className="cyfast-alert cyfast-alert-warning">The original failed run remains immutable. This creates a new linked attempt.</div>
            <div className="cyfast-form-actions"><button type="submit" className="cyfast-button">Approve and create rerun</button></div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
