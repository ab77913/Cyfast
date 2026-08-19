import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Modal, Spinner, Table } from 'react-bootstrap';
import { FormattedMessage, useIntl } from 'react-intl';

import {
  validateGenerationRequirements,
  validateGenerationTestCases,
  validateGenerationTestScenarios,
  validateGenerationOther
} from 'utils/apiServices';

const fmtDim = (id) =>
  typeof id === 'string'
    ? id
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : id;

const normalizeDimensionScore = (score) => {
  const val = Number(score);
  if (!Number.isFinite(val)) return null;
  return Math.max(1, Math.min(5, Math.round(val)));
};

const deriveSeverityFromScore = (score) => {
  if (score == null) return null;
  if (score <= 2) return 'fail';
  if (score === 3) return 'warn';
  return 'pass';
};

const normalizeSeverity = (severity, score) => {
  const sev = typeof severity === 'string' ? severity.trim().toLowerCase() : '';
  if (sev === 'pass' || sev === 'warn' || sev === 'fail') return sev;
  return deriveSeverityFromScore(score) || 'unknown';
};

/** @param {{
 *   label?: string;
 *   artifactKind?: 'requirements'|'test_cases'|'test_scenarios'|'other';
 *   requestFragment: object;
 * }} props */
export default function GenerationValidationModal({
  show,
  onHide,
  project,
  artifactKind,
  titleId,
  titleDefaultMessage,
  requestFragment,
  labelId,
  labelDefaultMessage
}) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  const fragmentKey = useMemo(
    () => (requestFragment != null ? JSON.stringify(requestFragment) : ''),
    [requestFragment]
  );

  useEffect(() => {
    if (!show || !project?.project_id || !artifactKind || !requestFragment) return;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      setReport(null);
      const base = {
        project_id: project.project_id,
        ...(project.organization_id != null ? { organization_id: project.organization_id } : {})
      };

      try {
        let resp;
        if (artifactKind === 'requirements') {
          resp = await validateGenerationRequirements({ ...base, ...requestFragment });
        } else if (artifactKind === 'test_cases') {
          resp = await validateGenerationTestCases({ ...base, ...requestFragment });
        } else if (artifactKind === 'test_scenarios') {
          resp = await validateGenerationTestScenarios({ ...base, ...requestFragment });
        } else {
          resp = await validateGenerationOther({ ...base, ...requestFragment });
        }

        if (cancelled) return;

        const data = resp?.data;

        if (!resp || resp.status >= 400) {
          setError(data?.error || data?.detail || resp?.statusText || 'Request failed');
          return;
        }

        setReport(data ?? null);

        const st = data?.status;
        if (st === 'llm_unavailable' || st === 'llm_unreachable' || st === 'llm_bad_response') {
          setError(
            data?.message ||
              intl.formatMessage({
                id: 'gen-val-llm-fail',
                defaultMessage: 'LLM validation failed.'
              })
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.error || e.message || 'Request failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [show, artifactKind, fragmentKey, project?.project_id, project?.organization_id]);

  const overall = report?.overall_score;

  const badgeVariant =
    overall == null
      ? 'secondary'
      : overall >= 80
        ? 'success'
        : overall >= 60
          ? 'warning'
          : 'danger';

  return (
    <Modal show={show} onHide={onHide} centered size="lg" scrollable>
      <Modal.Header closeButton={!loading}>
        <Modal.Title>
          <FormattedMessage
            id={titleId || 'gen-val-title-default'}
            defaultMessage={titleDefaultMessage || 'Quality validation'}
          />
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {(labelDefaultMessage || labelId) && (
          <p className="text-muted small mb-3">
            {labelId ? <FormattedMessage id={labelId} defaultMessage={labelDefaultMessage || ''} /> : labelDefaultMessage}
          </p>
        )}
        {error && (
          <Alert variant="danger" dismissible className="py-2" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {loading && (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            <span>
              <FormattedMessage id="gen-val-running" defaultMessage="Running validation…" />
            </span>
          </div>
        )}
        {!loading && report?.status === 'ok' && (
          <>
            <div className="d-flex align-items-center gap-2 mb-3">
              <span>
                <FormattedMessage id="gen-val-overall" defaultMessage="Overall score:" />
              </span>
              <Badge bg={badgeVariant}>{overall ?? '–'}</Badge>
              <span className="text-muted small">{report.summary}</span>
            </div>

            <div className="scroll-container mb-3">
              <Table responsive bordered size="sm" className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '18%' }}>
                      <FormattedMessage id="gen-val-col-dimension" defaultMessage="Dimension" />
                    </th>
                    <th style={{ width: '10%' }}>
                      <FormattedMessage id="gen-val-col-score" defaultMessage="Score" />
                    </th>
                    <th style={{ width: '12%' }}>
                      <FormattedMessage id="gen-val-col-severity" defaultMessage="Severity" />
                    </th>
                    <th>
                      <FormattedMessage id="gen-val-col-finding" defaultMessage="Finding" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(report.dimensions || []).map((d, i) => (
                    <tr key={`${d.id || i}-${i}`}>
                      <td className="small">
                        {(d.label && String(d.label)) || fmtDim(d.id)}
                      </td>
                      <td className="text-center">{d.score != null ? d.score : '–'}</td>
                      <td className="small text-muted">
                        {normalizeSeverity(d.severity, normalizeDimensionScore(d.score))}
                      </td>
                      <td className="small">
                        {d.finding || ''}
                        {(d.hints && d.hints.length > 0) ? (
                          <ul className="mb-0 mt-1 ps-3">
                            {d.hints.map((h, j) => (
                              <li key={j}>{h}</li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {report.recommendations && report.recommendations.length > 0 && (
              <div className="mb-2">
                <div className="fw-semibold small mb-1">
                  <FormattedMessage id="gen-val-rec" defaultMessage="Recommendations" />
                </div>
                <ul className="small mb-0">
                  {report.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {!loading && report && report.status !== 'ok' && !error && (
          <Alert variant="warning">
            {report.message || (
              <FormattedMessage id="gen-val-no-result" defaultMessage="Validation did not return a complete rubric." />
            )}
          </Alert>
        )}
      </Modal.Body>
    </Modal>
  );
}
