import React, { useCallback, useEffect, useMemo, useState } from "react";
import executionProductFixApi from "../../services/executionProductFixApi";

function statusClass(status) {
  return `cyfast-status cyfast-status-${String(status || "unknown").toLowerCase()}`;
}

export default function ProductFixPanel({ projectId, run, defects = [] }) {
  const [fixes, setFixes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createFor, setCreateFor] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [deploying, setDeploying] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [createForm, setCreateForm] = useState({
    repository_url: "https://",
    base_branch: "main",
    fix_branch: "fix/",
    pull_request_url: "",
    commit_sha: "",
    change_summary: "",
    risk_assessment: "{}",
  });
  const [reviewForm, setReviewForm] = useState({ commit_sha: "", pull_request_url: "", comment: "" });
  const [deploymentForm, setDeploymentForm] = useState({
    deployment_status: "DEPLOYED",
    deployment_environment: "",
    deployment_id: "",
    deployment_version: "",
  });
  const [verificationRunId, setVerificationRunId] = useState("");

  const productDefects = useMemo(
    () => defects.filter((defect) => defect.classification === "PRODUCT_DEFECT"),
    [defects],
  );

  const load = useCallback(async () => {
    if (!run?.execution_run_id || !projectId) return;
    try {
      const result = await executionProductFixApi.list(projectId, run.execution_run_id);
      setFixes(result.items || []);
    } catch (value) {
      setError(`${value.code ? `${value.code}: ` : ""}${value.message || value}`);
    }
  }, [projectId, run?.execution_run_id]);

  useEffect(() => { load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    let riskAssessment;
    try {
      riskAssessment = JSON.parse(createForm.risk_assessment || "{}");
    } catch (_) {
      setError("Risk assessment must be valid JSON.");
      return;
    }
    setLoading(true);
    try {
      await executionProductFixApi.create(projectId, createFor.execution_defect_id, {
        ...createForm,
        risk_assessment: riskAssessment,
        pull_request_url: createForm.pull_request_url || undefined,
        commit_sha: createForm.commit_sha || undefined,
      });
      setNotice("Product fix lineage was created and is awaiting review.");
      setCreateFor(null);
      await load();
    } catch (value) {
      setError(`${value.code ? `${value.code}: ` : ""}${value.message || value}`);
    } finally {
      setLoading(false);
    }
  }

  async function review(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await executionProductFixApi.review(projectId, reviewing.execution_product_fix_id, {
        review_status: "APPROVED",
        ...reviewForm,
      });
      setNotice("Reviewed product commit was approved. Deployment evidence is now required.");
      setReviewing(null);
      await load();
    } catch (value) {
      setError(`${value.code ? `${value.code}: ` : ""}${value.message || value}`);
    } finally {
      setLoading(false);
    }
  }

  async function deployment(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await executionProductFixApi.deployment(projectId, deploying.execution_product_fix_id, deploymentForm);
      setNotice("Deployment evidence was linked. A separate verification run can now be associated.");
      setDeploying(null);
      await load();
    } catch (value) {
      setError(`${value.code ? `${value.code}: ` : ""}${value.message || value}`);
    } finally {
      setLoading(false);
    }
  }

  async function verification(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await executionProductFixApi.verification(projectId, verifying.execution_product_fix_id, verificationRunId);
      setNotice("Verification rerun was linked. The defect resolves only if that run passes with real proof.");
      setVerifying(null);
      setVerificationRunId("");
      await load();
    } catch (value) {
      setError(`${value.code ? `${value.code}: ` : ""}${value.message || value}`);
    } finally {
      setLoading(false);
    }
  }

  if (!productDefects.length && !fixes.length) return null;

  return (
    <section className="cyfast-subpanel">
      <div className="cyfast-subpanel-heading">
        <div>
          <h4>Product-code correction lineage</h4>
          <p>The original script and assertion remain unchanged. A reviewed deployment and separate rerun are mandatory.</p>
        </div>
        {productDefects.map((defect) => (
          <button type="button" className="cyfast-button cyfast-button-secondary" key={defect.execution_defect_id} onClick={() => setCreateFor(defect)}>
            Link fix for {defect.execution_defect_id.slice(0, 8)}
          </button>
        ))}
      </div>
      {notice ? <div className="cyfast-alert cyfast-alert-success">{notice}</div> : null}
      {error ? <div className="cyfast-alert cyfast-alert-error">{error}</div> : null}
      <div className="cyfast-card-list">
        {fixes.map((fix) => (
          <article className="cyfast-mini-card" key={fix.execution_product_fix_id}>
            <div className="cyfast-mini-card-heading">
              <div><strong>{fix.fix_branch}</strong><small>{fix.repository_url}</small></div>
              <span className={statusClass(fix.verification_status === "PASSED" ? "PASSED" : fix.review_status)}>{fix.verification_status === "PASSED" ? "VERIFIED" : fix.review_status}</span>
            </div>
            <p>{fix.change_summary}</p>
            <div className="cyfast-proof-grid">
              <div><span>Commit</span><strong className="cyfast-monospace">{fix.commit_sha || "Pending review"}</strong></div>
              <div><span>Deployment</span><strong>{fix.deployment_status}</strong></div>
              <div><span>Deployment version</span><strong>{fix.deployment_version || "—"}</strong></div>
              <div><span>Verification</span><strong>{fix.verification_status}</strong></div>
            </div>
            <div className="cyfast-actions">
              {fix.review_status === "PENDING" ? <button type="button" className="cyfast-link-button" onClick={() => { setReviewing(fix); setReviewForm({ commit_sha: fix.commit_sha || "", pull_request_url: fix.pull_request_url || "", comment: "" }); }}>Approve reviewed commit</button> : null}
              {fix.review_status === "APPROVED" && fix.deployment_status !== "DEPLOYED" ? <button type="button" className="cyfast-link-button" onClick={() => setDeploying(fix)}>Add deployment evidence</button> : null}
              {fix.deployment_status === "DEPLOYED" && !fix.verification_execution_run_id ? <button type="button" className="cyfast-link-button" onClick={() => setVerifying(fix)}>Link verification rerun</button> : null}
            </div>
          </article>
        ))}
      </div>

      {createFor ? (
        <div className="cyfast-modal-backdrop" onMouseDown={() => setCreateFor(null)}>
          <form className="cyfast-modal" onSubmit={create} onMouseDown={(event) => event.stopPropagation()}>
            <div className="cyfast-panel-heading"><h3>Link product code fix</h3><button type="button" className="cyfast-link-button" onClick={() => setCreateFor(null)}>Close</button></div>
            <label>Repository URL<input required value={createForm.repository_url} onChange={(event) => setCreateForm({ ...createForm, repository_url: event.target.value })} /></label>
            <label>Base branch<input required value={createForm.base_branch} onChange={(event) => setCreateForm({ ...createForm, base_branch: event.target.value })} /></label>
            <label>Fix branch<input required value={createForm.fix_branch} onChange={(event) => setCreateForm({ ...createForm, fix_branch: event.target.value })} /></label>
            <label>Pull request URL<input value={createForm.pull_request_url} onChange={(event) => setCreateForm({ ...createForm, pull_request_url: event.target.value })} /></label>
            <label>Commit SHA, when available<input className="cyfast-monospace" value={createForm.commit_sha} onChange={(event) => setCreateForm({ ...createForm, commit_sha: event.target.value })} /></label>
            <label>Change summary<textarea required rows="5" value={createForm.change_summary} onChange={(event) => setCreateForm({ ...createForm, change_summary: event.target.value })} /></label>
            <label>Risk assessment JSON<textarea required rows="4" value={createForm.risk_assessment} onChange={(event) => setCreateForm({ ...createForm, risk_assessment: event.target.value })} /></label>
            <div className="cyfast-form-actions"><button type="submit" className="cyfast-button" disabled={loading}>Create review record</button></div>
          </form>
        </div>
      ) : null}

      {reviewing ? (
        <div className="cyfast-modal-backdrop" onMouseDown={() => setReviewing(null)}>
          <form className="cyfast-modal" onSubmit={review} onMouseDown={(event) => event.stopPropagation()}>
            <div className="cyfast-panel-heading"><h3>Approve reviewed commit</h3><button type="button" className="cyfast-link-button" onClick={() => setReviewing(null)}>Close</button></div>
            <label>Commit SHA<input required className="cyfast-monospace" value={reviewForm.commit_sha} onChange={(event) => setReviewForm({ ...reviewForm, commit_sha: event.target.value })} /></label>
            <label>Pull request URL<input value={reviewForm.pull_request_url} onChange={(event) => setReviewForm({ ...reviewForm, pull_request_url: event.target.value })} /></label>
            <label>Review comment<textarea rows="4" value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} /></label>
            <div className="cyfast-alert cyfast-alert-warning">Approval records lineage only. It never edits the test assertion or fabricates a PASS.</div>
            <div className="cyfast-form-actions"><button type="submit" className="cyfast-button" disabled={loading}>Approve commit</button></div>
          </form>
        </div>
      ) : null}

      {deploying ? (
        <div className="cyfast-modal-backdrop" onMouseDown={() => setDeploying(null)}>
          <form className="cyfast-modal" onSubmit={deployment} onMouseDown={(event) => event.stopPropagation()}>
            <div className="cyfast-panel-heading"><h3>Deployment evidence</h3><button type="button" className="cyfast-link-button" onClick={() => setDeploying(null)}>Close</button></div>
            <label>Environment<input required value={deploymentForm.deployment_environment} onChange={(event) => setDeploymentForm({ ...deploymentForm, deployment_environment: event.target.value })} /></label>
            <label>Deployment ID<input required value={deploymentForm.deployment_id} onChange={(event) => setDeploymentForm({ ...deploymentForm, deployment_id: event.target.value })} /></label>
            <label>Deployment version<input required value={deploymentForm.deployment_version} onChange={(event) => setDeploymentForm({ ...deploymentForm, deployment_version: event.target.value })} /></label>
            <div className="cyfast-form-actions"><button type="submit" className="cyfast-button" disabled={loading}>Mark deployed</button></div>
          </form>
        </div>
      ) : null}

      {verifying ? (
        <div className="cyfast-modal-backdrop" onMouseDown={() => setVerifying(null)}>
          <form className="cyfast-modal" onSubmit={verification} onMouseDown={(event) => event.stopPropagation()}>
            <div className="cyfast-panel-heading"><h3>Link verification rerun</h3><button type="button" className="cyfast-link-button" onClick={() => setVerifying(null)}>Close</button></div>
            <label>Verification execution run ID<input required className="cyfast-monospace" value={verificationRunId} onChange={(event) => setVerificationRunId(event.target.value)} /></label>
            <div className="cyfast-alert cyfast-alert-warning">The run must share the original root lineage and must be a separate attempt.</div>
            <div className="cyfast-form-actions"><button type="submit" className="cyfast-button" disabled={loading}>Link verification</button></div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
