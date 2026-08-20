"use strict";

const db = require("../../database/mysql/models");
const { typedError } = require("./execution-contract");

async function getMetrics(actor, query = {}) {
  const days = Math.min(Math.max(Number.parseInt(query.days, 10) || 30, 1), 365);
  const platform = query.platform ? String(query.platform).toUpperCase() : null;
  const rows = await db.sequelize.query(
    `SELECT execution_run_id, root_execution_run_id, parent_execution_run_id,
            attempt_number, platform, status, failure_classification,
            real_execution, simulated, meaningful_actions, meaningful_assertions,
            started_at, finished_at, created_date
     FROM execution_run
     WHERE organization_id = :organizationId
       AND project_id = :projectId
       AND deleted_date IS NULL
       AND created_date >= DATE_SUB(NOW(3), INTERVAL ${days} DAY)
       AND (:platform IS NULL OR platform = :platform)
     ORDER BY created_date ASC`,
    {
      replacements: {
        organizationId: actor.organizationId,
        projectId: actor.projectId,
        days,
        platform,
      },
      type: db.Sequelize.QueryTypes.SELECT,
    },
  );

  const total = rows.length;
  const terminal = rows.filter((row) => ["PASSED", "FAILED", "BLOCKED", "CANCELLED"].includes(row.status));
  const passed = terminal.filter((row) => row.status === "PASSED");
  const failed = terminal.filter((row) => row.status === "FAILED");
  const blocked = terminal.filter((row) => row.status === "BLOCKED");
  const cancelled = terminal.filter((row) => row.status === "CANCELLED");
  const durations = terminal
    .map((row) => durationMs(row.started_at, row.finished_at))
    .filter((value) => Number.isFinite(value));
  const realRuns = terminal.filter((row) => row.real_execution === 1 || row.real_execution === true);
  const simulatedRuns = terminal.filter((row) => row.simulated === 1 || row.simulated === true);
  const proofEligible = passed.filter(
    (row) => Number(row.meaningful_actions || 0) > 0 && Number(row.meaningful_assertions || 0) > 0,
  );

  const roots = groupBy(rows, (row) => row.root_execution_run_id || row.execution_run_id);
  let flakyRoots = 0;
  let repairedRoots = 0;
  let repairSuccessfulRoots = 0;
  for (const attempts of roots.values()) {
    const statuses = new Set(attempts.map((item) => item.status));
    if (statuses.has("PASSED") && (statuses.has("FAILED") || statuses.has("BLOCKED"))) flakyRoots += 1;
    if (attempts.some((item) => Number(item.attempt_number || 1) > 1)) {
      repairedRoots += 1;
      if (attempts.some((item) => item.status === "PASSED")) repairSuccessfulRoots += 1;
    }
  }

  const failures = {};
  for (const row of failed.concat(blocked)) {
    const classification = row.failure_classification || "UNCLASSIFIED";
    failures[classification] = (failures[classification] || 0) + 1;
  }

  const stages = await getStageMetrics(actor, { days, platform });
  const platforms = {};
  for (const [name, items] of groupBy(rows, (row) => row.platform || "UNKNOWN")) {
    const platformTerminal = items.filter((row) => ["PASSED", "FAILED", "BLOCKED", "CANCELLED"].includes(row.status));
    platforms[name] = {
      total: items.length,
      terminal: platformTerminal.length,
      passed: platformTerminal.filter((row) => row.status === "PASSED").length,
      failed: platformTerminal.filter((row) => row.status === "FAILED").length,
      blocked: platformTerminal.filter((row) => row.status === "BLOCKED").length,
      pass_rate: ratio(platformTerminal.filter((row) => row.status === "PASSED").length, platformTerminal.length),
      median_duration_ms: percentile(
        platformTerminal
          .map((row) => durationMs(row.started_at, row.finished_at))
          .filter((value) => Number.isFinite(value)),
        0.5,
      ),
    };
  }

  return {
    window_days: days,
    platform_filter: platform,
    generated_at: new Date().toISOString(),
    counts: {
      total,
      terminal: terminal.length,
      passed: passed.length,
      failed: failed.length,
      blocked: blocked.length,
      cancelled: cancelled.length,
      real_runs: realRuns.length,
      simulated_runs: simulatedRuns.length,
      active: total - terminal.length,
    },
    quality: {
      pass_rate: ratio(passed.length, terminal.length),
      failure_rate: ratio(failed.length, terminal.length),
      blocked_rate: ratio(blocked.length, terminal.length),
      cancellation_rate: ratio(cancelled.length, terminal.length),
      real_execution_rate: ratio(realRuns.length, terminal.length),
      truthful_pass_rate: ratio(proofEligible.length, passed.length),
      flakiness_rate: ratio(flakyRoots, roots.size),
      repair_success_rate: ratio(repairSuccessfulRoots, repairedRoots),
    },
    performance: {
      duration_samples: durations.length,
      average_duration_ms: average(durations),
      median_duration_ms: percentile(durations, 0.5),
      p90_duration_ms: percentile(durations, 0.9),
      p95_duration_ms: percentile(durations, 0.95),
      p99_duration_ms: percentile(durations, 0.99),
      stages,
    },
    failure_classifications: Object.entries(failures)
      .map(([classification, count]) => ({ classification, count, rate: ratio(count, failed.length + blocked.length) }))
      .sort((a, b) => b.count - a.count),
    platforms,
  };
}

async function getStageMetrics(actor, { days, platform }) {
  const rows = await db.sequelize.query(
    `SELECT e.execution_run_id, e.event_type, e.occurred_at
     FROM execution_event e
     JOIN execution_run r ON r.execution_run_id = e.execution_run_id
     WHERE e.organization_id = :organizationId
       AND e.project_id = :projectId
       AND e.deleted_date IS NULL
       AND r.deleted_date IS NULL
       AND r.created_date >= DATE_SUB(NOW(3), INTERVAL ${days} DAY)
       AND (:platform IS NULL OR r.platform = :platform)
     ORDER BY e.execution_run_id ASC, e.sequence_number ASC`,
    {
      replacements: {
        organizationId: actor.organizationId,
        projectId: actor.projectId,
        days,
        platform,
      },
      type: db.Sequelize.QueryTypes.SELECT,
    },
  );
  const measurements = {
    validation_ms: [],
    target_readiness_ms: [],
    dispatch_ms: [],
    execution_ms: [],
    evidence_ms: [],
    classification_ms: [],
  };
  for (const events of groupBy(rows, (row) => row.execution_run_id).values()) {
    addStage(events, "execution.validation.started.v1", "execution.package.hydrated.v1", measurements.validation_ms);
    addStage(events, "execution.package.hydrated.v1", "execution.target.ready.v1", measurements.target_readiness_ms);
    addStage(events, "execution.dispatch.started.v1", "execution.dispatched.v1", measurements.dispatch_ms);
    addStage(events, "execution.dispatched.v1", "execution.result.received.v1", measurements.execution_ms);
    addStage(events, "execution.result.received.v1", "execution.proof.collected.v1", measurements.evidence_ms);
    addStage(events, "execution.classification.started.v1", ["execution.passed.v1", "execution.failed.v1", "execution.blocked.v1", "execution.repair.eligible.v1"], measurements.classification_ms);
  }
  const result = {};
  for (const [name, values] of Object.entries(measurements)) {
    result[name] = {
      samples: values.length,
      average: average(values),
      median: percentile(values, 0.5),
      p95: percentile(values, 0.95),
    };
  }
  return result;
}

function addStage(events, startType, endType, output) {
  const starts = Array.isArray(startType) ? startType : [startType];
  const ends = Array.isArray(endType) ? endType : [endType];
  const start = events.find((event) => starts.includes(event.event_type));
  const end = events.find((event) => ends.includes(event.event_type) && new Date(event.occurred_at) >= new Date(start?.occurred_at || 0));
  if (!start || !end) return;
  const duration = durationMs(start.occurred_at, end.occurred_at);
  if (Number.isFinite(duration)) output.push(duration);
}

function durationMs(start, finish) {
  if (!start || !finish) return Number.NaN;
  const value = new Date(finish).getTime() - new Date(start).getTime();
  return value >= 0 ? value : Number.NaN;
}

function average(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(Math.max(Math.ceil(quantile * sorted.length) - 1, 0), sorted.length - 1);
  return Math.round(sorted[index]);
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function groupBy(values, selector) {
  const output = new Map();
  for (const value of values) {
    const key = selector(value);
    const items = output.get(key) || [];
    items.push(value);
    output.set(key, items);
  }
  return output;
}

module.exports = {
  getMetrics,
  getStageMetrics,
  durationMs,
  percentile,
  ratio,
};
