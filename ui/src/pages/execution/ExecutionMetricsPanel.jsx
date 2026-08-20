import React from "react";

function percentage(value) {
  return value === null || value === undefined ? "—" : `${(Number(value) * 100).toFixed(1)}%`;
}

function duration(value) {
  if (value === null || value === undefined) return "—";
  const milliseconds = Number(value);
  if (milliseconds < 1000) return `${milliseconds} ms`;
  if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)} s`;
  return `${(milliseconds / 60000).toFixed(1)} min`;
}

function MetricCard({ label, value, detail }) {
  return (
    <div className="cyfast-metric-card">
      <div className="cyfast-metric-label">{label}</div>
      <div className="cyfast-metric-value">{value}</div>
      {detail ? <div className="cyfast-metric-detail">{detail}</div> : null}
    </div>
  );
}

export default function ExecutionMetricsPanel({ metrics, loading, error, onRefresh }) {
  if (loading && !metrics) return <div className="cyfast-empty">Loading execution metrics…</div>;
  if (error && !metrics) return <div className="cyfast-alert cyfast-alert-error">{error}</div>;
  if (!metrics) return <div className="cyfast-empty">No execution metrics are available yet.</div>;

  const quality = metrics.quality || {};
  const performance = metrics.performance || {};
  const counts = metrics.counts || {};
  return (
    <section className="cyfast-panel">
      <div className="cyfast-panel-heading">
        <div>
          <h3>Quality and performance</h3>
          <p>{metrics.window_days}-day project window. Only persisted run evidence is counted.</p>
        </div>
        <button type="button" className="cyfast-button cyfast-button-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="cyfast-metric-grid">
        <MetricCard label="Pass rate" value={percentage(quality.pass_rate)} detail={`${counts.passed || 0} passed`} />
        <MetricCard label="Blocked rate" value={percentage(quality.blocked_rate)} detail={`${counts.blocked || 0} blocked`} />
        <MetricCard label="Real execution" value={percentage(quality.real_execution_rate)} detail={`${counts.real_runs || 0} real runs`} />
        <MetricCard label="Truthful PASS" value={percentage(quality.truthful_pass_rate)} detail="Actions + assertions + proof" />
        <MetricCard label="Flakiness" value={percentage(quality.flakiness_rate)} detail="Roots with mixed outcomes" />
        <MetricCard label="Repair success" value={percentage(quality.repair_success_rate)} detail="Repaired roots later passed" />
        <MetricCard label="Median duration" value={duration(performance.median_duration_ms)} detail={`${performance.duration_samples || 0} samples`} />
        <MetricCard label="P95 duration" value={duration(performance.p95_duration_ms)} detail="End-to-end execution" />
      </div>

      <div className="cyfast-two-column">
        <div>
          <h4>Platform outcomes</h4>
          <div className="cyfast-table-wrap">
            <table className="cyfast-table">
              <thead>
                <tr><th>Platform</th><th>Runs</th><th>Passed</th><th>Blocked</th><th>Pass rate</th><th>Median</th></tr>
              </thead>
              <tbody>
                {Object.entries(metrics.platforms || {}).map(([platform, value]) => (
                  <tr key={platform}>
                    <td>{platform}</td>
                    <td>{value.total}</td>
                    <td>{value.passed}</td>
                    <td>{value.blocked}</td>
                    <td>{percentage(value.pass_rate)}</td>
                    <td>{duration(value.median_duration_ms)}</td>
                  </tr>
                ))}
                {!Object.keys(metrics.platforms || {}).length ? (
                  <tr><td colSpan="6" className="cyfast-empty-cell">No platform runs</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4>Failure classifications</h4>
          <div className="cyfast-table-wrap">
            <table className="cyfast-table">
              <thead><tr><th>Classification</th><th>Count</th><th>Share</th></tr></thead>
              <tbody>
                {(metrics.failure_classifications || []).map((item) => (
                  <tr key={item.classification}>
                    <td>{item.classification}</td>
                    <td>{item.count}</td>
                    <td>{percentage(item.rate)}</td>
                  </tr>
                ))}
                {!metrics.failure_classifications?.length ? (
                  <tr><td colSpan="3" className="cyfast-empty-cell">No classified failures</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h4>Stage latency</h4>
      <div className="cyfast-table-wrap">
        <table className="cyfast-table">
          <thead><tr><th>Stage</th><th>Samples</th><th>Average</th><th>Median</th><th>P95</th></tr></thead>
          <tbody>
            {Object.entries(performance.stages || {}).map(([stage, value]) => (
              <tr key={stage}>
                <td>{stage.replaceAll("_", " ")}</td>
                <td>{value.samples}</td>
                <td>{duration(value.average)}</td>
                <td>{duration(value.median)}</td>
                <td>{duration(value.p95)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
