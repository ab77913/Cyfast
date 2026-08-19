import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { FormattedMessage, useIntl } from 'react-intl';

import {
  approveGeneratedTestCase,
  bulkApproveGeneratedTestCases,
  bulkDiscardGeneratedTestCases,
  bulkRejectGeneratedTestCases,
  discardPendingTestCaseJobs,
  getTestCaseGenerationJob,
  listPendingGeneratedTestCases,
  regeneratePendingTestCasesWithAi,
  rejectGeneratedTestCase
} from 'utils/apiServices';

import ListPagination from 'views/shared/ListPagination';
import GenerationValidationModal from '../../shared-modals/GenerationValidationModal';

const DEFAULT_PAGE_SIZE = 25;

function fieldToText(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item != null && typeof item === 'object') {
          if (typeof item.action === 'string') return item.action;
          if (typeof item.detail === 'string') return item.detail;
          try {
            return JSON.stringify(item);
          } catch {
            return String(item);
          }
        }
        return String(item);
      })
      .join('\n');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export default function PendingTab({ project, onApproved }) {
  const intl = useIntl();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pendingJobIds, setPendingJobIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionBusy, setActionBusy] = useState(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [rejectModal, setRejectModal] = useState(false);
  /** @type {number[] | null} */
  const [rejectTargetIds, setRejectTargetIds] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const [bulkDiscardModal, setBulkDiscardModal] = useState(false);
  const [discardJobModal, setDiscardJobModal] = useState(null);

  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [regenerateFeedback, setRegenerateFeedback] = useState('');
  const [regenerateInstructions, setRegenerateInstructions] = useState('');

  const [validatorRowId, setValidatorRowId] = useState(null);

  const anyBusy = bulkWorking || actionBusy != null;

  const validatedRow = useMemo(() => {
    if (validatorRowId == null) return null;
    return rows.find((x) => x.generated_test_case_id === validatorRowId) || null;
  }, [validatorRowId, rows]);

  const validatorProjectForModal = useMemo(() => {
    if (!project) return null;
    if (validatedRow?.organization_id != null) {
      return { ...project, organization_id: validatedRow.organization_id };
    }
    return project;
  }, [project, validatedRow]);

  const testCaseValFragment = useMemo(() => {
    if (!validatedRow) return null;
    const r = validatedRow;
    const test_case_drafts = [
      {
        requirement_id: r.requirement_id,
        title: r.test_case_name,
        description: r.test_case_description,
        pre_condition: r.preconditions,
        steps_json: r.test_steps,
        test_type: r.test_type,
        priority: r.priority,
        test_data: r.test_data,
        expected_result: r.expected_result,
        automation_percentage: r.automation_percentage
      }
    ];
    const req = r.requirement;
    const source_requirements = [];
    if (req) {
      source_requirements.push({
        requirement_id: req.requirement_id ?? r.requirement_id,
        requirement_no: req.requirement_no ?? r.requirement_no,
        title: req.title,
        description: req.description
      });
    } else if (r.requirement_id != null || r.requirement_no) {
      source_requirements.push({
        requirement_id: r.requirement_id,
        requirement_no: r.requirement_no
      });
    }
    return { test_case_drafts, source_requirements };
  }, [validatedRow]);

  const selectedIdsArray = useMemo(() => [...selectedIds], [selectedIds]);

  const selectedDraftsResolved = useMemo(
    () =>
      selectedIdsArray
        .map((id) => rows.find((r) => r.generated_test_case_id === id))
        .filter(Boolean),
    [selectedIdsArray, rows]
  );

  const regenerateBarrier = useMemo(() => {
    if (!selectedIdsArray.length) return { kind: 'none', jobId: undefined };
    if (selectedDraftsResolved.length !== selectedIdsArray.length) {
      return { kind: 'not_all_visible', jobId: undefined };
    }
    const jobIds = [
      ...new Set(selectedDraftsResolved.map((r) => r.job?.job_id).filter((x) => x != null))
    ];
    if (jobIds.length > 1) return { kind: 'multi_job', jobId: undefined };
    return { kind: 'ok', jobId: jobIds[0] };
  }, [selectedIdsArray, selectedDraftsResolved]);

  const fetchPending = useCallback(async () => {
    if (!project?.project_id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listPendingGeneratedTestCases(project.project_id, {
        page: listPage,
        size: pageSize
      });
      const body = res.data || {};
      setRows(body.data || []);
      setPagination(body.pagination || null);
      setPendingJobIds(Array.isArray(body.pending_job_ids) ? body.pending_job_ids : []);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || e.message);
      setRows([]);
      setPagination(null);
      setPendingJobIds([]);
    } finally {
      setLoading(false);
    }
  }, [project?.project_id, listPage, pageSize]);

  useLayoutEffect(() => {
    setListPage(1);
  }, [project?.project_id]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    const valid = new Set(rows.map((r) => r.generated_test_case_id));
    setSelectedIds((prev) => new Set([...prev].filter((id) => valid.has(id))));
  }, [rows]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(rows.map((r) => r.generated_test_case_id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const pollJobUntilTerminal = async (jobId) => {
    const maxMs = 20 * 60 * 1000;
    const delay = 4000;
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      /* eslint-disable no-await-in-loop */
      const res = await getTestCaseGenerationJob(jobId);
      const j = res.data;
      const s = j?.status;
      if (s === 'COMPLETED') return j;
      if (s === 'FAILED') throw new Error(j.error_message || 'Job failed.');
      await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error(
      intl.formatMessage({
        id: 'testcases-pending-regen-timeout',
        defaultMessage:
          'Regeneration is taking longer than expected. Check notifications or refresh this list.'
      })
    );
  };

  const openRegenerateModal = () => {
    if (regenerateBarrier.kind !== 'ok') return;
    setRegenerateFeedback('');
    const raw = selectedDraftsResolved[0]?.job?.additional_instructions;
    setRegenerateInstructions(raw != null && String(raw).trim() ? String(raw) : '');
    setRegenerateModalOpen(true);
  };

  const submitAiRegeneration = async () => {
    if (!project?.project_id || regenerateBarrier.kind !== 'ok') return;
    const fb = regenerateFeedback.trim();
    if (!fb) {
      setError(
        intl.formatMessage({
          id: 'testcases-pending-regen-feedback-required',
          defaultMessage: 'Describe how the AI should change the selected drafts.'
        })
      );
      return;
    }
    setBulkWorking(true);
    setError(null);
    try {
      const res = await regeneratePendingTestCasesWithAi({
        project_id: project.project_id,
        candidate_ids: selectedIdsArray,
        user_feedback: fb,
        additional_instructions: regenerateInstructions.trim() || null
      });
      if (![200, 202].includes(res.status)) {
        throw new Error(res.data?.error || res.data?.message || 'Regeneration failed.');
      }
      let job = res.data;
      const jid = job?.job_id;
      if (!jid) throw new Error('Missing job_id from server.');
      if (['QUEUED', 'PROCESSING'].includes(job.status) || res.status === 202) {
        job = await pollJobUntilTerminal(jid);
      }
      if (job?.status === 'FAILED') {
        throw new Error(job.error_message || 'Regeneration failed.');
      }
      setRegenerateModalOpen(false);
      setRegenerateFeedback('');
      clearSelection();
      await fetchPending();
    } catch (e) {
      setError(e.response?.data?.error || e.message || String(e));
    } finally {
      setBulkWorking(false);
    }
  };

  const handleApprove = async (id) => {
    setActionBusy(id);
    try {
      await approveGeneratedTestCase(id);
      await fetchPending();
      if (typeof onApproved === 'function') onApproved();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setActionBusy(null);
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedIdsArray.length) return;
    setBulkWorking(true);
    setError(null);
    try {
      await bulkApproveGeneratedTestCases({
        project_id: project.project_id,
        candidate_ids: selectedIdsArray
      });
      clearSelection();
      await fetchPending();
      if (typeof onApproved === 'function') onApproved();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBulkWorking(false);
    }
  };

  const openReject = (id) => {
    setRejectTargetIds([id]);
    setRejectReason('');
    setRejectModal(true);
  };

  const openBulkReject = () => {
    if (!selectedIdsArray.length) return;
    setRejectTargetIds(selectedIdsArray);
    setRejectReason('');
    setRejectModal(true);
  };

  const handleReject = async () => {
    if (!rejectTargetIds?.length || !project?.project_id) return;
    const multi = rejectTargetIds.length > 1;
    if (multi) setBulkWorking(true);
    else setActionBusy(rejectTargetIds[0]);
    try {
      if (multi) {
        const res = await bulkRejectGeneratedTestCases({
          project_id: project.project_id,
          candidate_ids: rejectTargetIds,
          reason: rejectReason.trim() || undefined
        });
        if (res.status !== 200) throw new Error(res.data?.error || 'Reject failed');
        const d = res.data;
        if (d.failed > 0) {
          setError(
            intl.formatMessage(
              {
                id: 'testcases-pending-bulk-reject-partial',
                defaultMessage: 'Rejected {ok}; {bad} failed.'
              },
              { ok: d.succeeded, bad: d.failed }
            )
          );
        }
        setSelectedIds((prev) => {
          const n = new Set(prev);
          rejectTargetIds.forEach((id) => n.delete(id));
          return n;
        });
      } else {
        await rejectGeneratedTestCase(rejectTargetIds[0], rejectReason);
      }
      setRejectModal(false);
      setRejectTargetIds(null);
      setRejectReason('');
      await fetchPending();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      if (multi) setBulkWorking(false);
      else setActionBusy(null);
    }
  };

  const submitBulkDiscardCandidates = async () => {
    if (!selectedIdsArray.length || !project?.project_id) return;
    setBulkWorking(true);
    try {
      const res = await bulkDiscardGeneratedTestCases({
        project_id: project.project_id,
        candidate_ids: selectedIdsArray
      });
      if (res.status !== 200) throw new Error(res.data?.error || 'Discard failed');
      const d = res.data;
      if (d.failed > 0) {
        setError(
          intl.formatMessage(
            {
              id: 'testcases-pending-bulk-discard-partial',
              defaultMessage: 'Discarded {ok}; {bad} failed.'
            },
            { ok: d.succeeded, bad: d.failed }
          )
        );
      }
      clearSelection();
      setBulkDiscardModal(false);
      await fetchPending();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBulkWorking(false);
    }
  };

  const submitDiscardJob = async () => {
    const jid = discardJobModal;
    if (jid == null || !project?.project_id) return;
    setBulkWorking(true);
    try {
      const res = await discardPendingTestCaseJobs({
        project_id: project.project_id,
        job_ids: [jid]
      });
      if (res.status !== 200) throw new Error(res.data?.error || 'Discard failed');
      setDiscardJobModal(null);
      clearSelection();
      await fetchPending();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBulkWorking(false);
    }
  };

  const reqLabel = (r) => r.requirement_no || r.requirement?.requirement_no || r.requirement_id || '—';
  const scenarioLabel = (r) => r.scenario_title || r.test_scenario?.title || r.test_scenario_id || '—';

  return (
    <div className="py-2">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <p className="text-muted mb-0">
          <FormattedMessage
            id="testcases-pending-intro"
            defaultMessage="Approve to promote drafts into persisted test cases. Reject or discard skips promotion. Regenerate reruns AI on pending rows from one batch."
          />
        </p>
        <Button variant="outline-primary" size="sm" onClick={fetchPending} disabled={loading || anyBusy}>
          <FormattedMessage id="testcases-pending-refresh" defaultMessage="Refresh" />
        </Button>
      </div>

      {pendingJobIds.length > 0 && (
        <div className="mb-3">
          <span className="small text-muted me-2">
            <FormattedMessage
              id="testcases-pending-job-batch-label"
              defaultMessage="Discard entire pending batch by job:"
            />
          </span>
          {pendingJobIds.map((jid) => (
            <Button
              key={jid}
              variant="outline-warning"
              size="sm"
              className="me-2 mb-2"
              disabled={anyBusy || !project?.project_id}
              onClick={() => setDiscardJobModal(Number(jid))}
            >
              <FormattedMessage
                id="testcases-discard-job-pending"
                defaultMessage="Discard pending — job {id}"
                values={{ id: jid }}
              />
            </Button>
          ))}
        </div>
      )}

      {selectedIdsArray.length > 0 && (
        <Alert variant="info" className="py-2 d-flex flex-wrap align-items-center gap-2 mb-3">
          <span className="small">
            <FormattedMessage
              id="testcases-pending-selected-count"
              defaultMessage="{n} selected"
              values={{ n: selectedIdsArray.length }}
            />
          </span>
          <Button variant="success" size="sm" disabled={anyBusy || !project?.project_id} onClick={handleBulkApprove}>
            {bulkWorking ? (
              <Spinner animation="border" size="sm" />
            ) : (
              <FormattedMessage id="testcases-pending-bulk-approve" defaultMessage="Approve selected" />
            )}
          </Button>
          <Button variant="outline-danger" size="sm" disabled={anyBusy || !project?.project_id} onClick={openBulkReject}>
            <FormattedMessage id="testcases-pending-bulk-reject" defaultMessage="Reject selected" />
          </Button>
          <Button
            variant="outline-primary"
            size="sm"
            disabled={
              anyBusy || !project?.project_id || regenerateBarrier.kind !== 'ok' || !selectedIdsArray.length
            }
            onClick={openRegenerateModal}
          >
            <FormattedMessage id="testcases-pending-regen-ai" defaultMessage="Regenerate with AI" />
          </Button>
          <Button
            variant="outline-warning"
            size="sm"
            disabled={anyBusy || !project?.project_id}
            onClick={() => setBulkDiscardModal(true)}
          >
            <FormattedMessage id="testcases-pending-bulk-discard" defaultMessage="Discard selected" />
          </Button>
          <Button variant="link" size="sm" className="py-0" disabled={anyBusy} onClick={clearSelection}>
            <FormattedMessage id="testcases-pending-clear-selection" defaultMessage="Clear selection" />
          </Button>
          {regenerateBarrier.kind === 'multi_job' ? (
            <div className="w-100 small text-warning mb-0">
              <FormattedMessage
                id="testcases-pending-regen-multi-job"
                defaultMessage="Regeneration requires drafts from a single AI batch."
              />
            </div>
          ) : regenerateBarrier.kind === 'not_all_visible' ? (
            <div className="w-100 small text-warning mb-0">
              <FormattedMessage
                id="testcases-pending-regen-not-visible"
                defaultMessage="Each selected draft must appear on this page."
              />
            </div>
          ) : null}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" className="py-2" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      ) : (
        <>
          <div className="scroll-container">
            <Table responsive hover className="align-middle mb-0">
              <thead className="thead-light">
                <tr>
                  <th style={{ width: 36 }}>
                    <Form.Check
                      type="checkbox"
                      checked={rows.length > 0 && selectedIdsArray.length === rows.length}
                      onChange={(e) => (e.target.checked ? selectAllVisible() : clearSelection())}
                      disabled={anyBusy}
                      aria-label="Select all"
                    />
                  </th>
                  <th>
                    <FormattedMessage id="testcases-pending-col-no" defaultMessage="TC No" />
                  </th>
                  <th>
                    <FormattedMessage id="testcases-pending-col-name" defaultMessage="Test Case Name" />
                  </th>
                  <th>
                    <FormattedMessage id="testcases-pending-col-req" defaultMessage="Requirement" />
                  </th>
                  <th>
                    <FormattedMessage id="testcases-pending-col-scenario" defaultMessage="Scenario" />
                  </th>
                  <th>
                    <FormattedMessage id="testcases-pending-col-type" defaultMessage="Type" />
                  </th>
                  <th>
                    <FormattedMessage id="testcases-pending-col-priority" defaultMessage="Priority" />
                  </th>
                  <th>
                    <FormattedMessage id="testcases-pending-col-pre" defaultMessage="Preconditions" />
                  </th>
                  <th>
                    <FormattedMessage id="testcases-pending-col-steps" defaultMessage="Test Steps" />
                  </th>
                  <th>
                    <FormattedMessage id="testcases-pending-col-data" defaultMessage="Test Data" />
                  </th>
                  <th>
                    <FormattedMessage id="testcases-pending-col-expected" defaultMessage="Expected Result" />
                  </th>
                  <th>
                    <FormattedMessage id="testcases-pending-col-auto" defaultMessage="Auto %" />
                  </th>
                  <th className="text-center">
                    <FormattedMessage id="testcases-pending-col-actions" defaultMessage="Actions" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.generated_test_case_id}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        checked={selectedIds.has(r.generated_test_case_id)}
                        onChange={() => toggleSelected(r.generated_test_case_id)}
                        disabled={anyBusy}
                      />
                    </td>
                    <td className="small fw-semibold">{r.test_case_no || '—'}</td>
                    <td>{r.test_case_name}</td>
                    <td className="small">{reqLabel(r)}</td>
                    <td className="small">{scenarioLabel(r)}</td>
                    <td className="small">{r.test_type || '—'}</td>
                    <td className="small">{r.priority || '—'}</td>
                    <td className="small" style={{ maxWidth: 160, whiteSpace: 'pre-wrap' }}>
                      {fieldToText(r.preconditions).slice(0, 200)}
                    </td>
                    <td className="small" style={{ maxWidth: 200, whiteSpace: 'pre-wrap' }}>
                      {fieldToText(r.test_steps).slice(0, 300)}
                    </td>
                    <td className="small" style={{ maxWidth: 160, whiteSpace: 'pre-wrap' }}>
                      {fieldToText(r.test_data).slice(0, 200)}
                    </td>
                    <td className="small" style={{ maxWidth: 180, whiteSpace: 'pre-wrap' }}>
                      {fieldToText(r.expected_result).slice(0, 200)}
                    </td>
                    <td className="small text-center">
                      {r.automation_percentage != null ? String(r.automation_percentage) : '—'}
                    </td>
                    <td className="text-center text-nowrap">
                      <Button
                        variant="outline-info"
                        size="sm"
                        className="me-1"
                        disabled={anyBusy || !project?.project_id}
                        onClick={() => setValidatorRowId(r.generated_test_case_id)}
                      >
                        <FormattedMessage id="testcases-pending-validator" defaultMessage="Validate" />
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        className="me-1"
                        disabled={anyBusy}
                        onClick={() => handleApprove(r.generated_test_case_id)}
                      >
                        {actionBusy === r.generated_test_case_id ? (
                          <Spinner animation="border" size="sm" />
                        ) : (
                          <FormattedMessage id="testcases-pending-approve" defaultMessage="Approve" />
                        )}
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        disabled={anyBusy}
                        onClick={() => openReject(r.generated_test_case_id)}
                      >
                        <FormattedMessage id="testcases-pending-reject" defaultMessage="Reject" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <ListPagination
            pagination={pagination}
            pageSize={pageSize}
            disabled={loading || anyBusy}
            onPageChange={(p) => setListPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setListPage(1);
            }}
          />
        </>
      )}

      <Modal show={regenerateModalOpen} onHide={() => !bulkWorking && setRegenerateModalOpen(false)} centered>
        <Modal.Header closeButton={!bulkWorking}>
          <Modal.Title>
            <FormattedMessage
              id="testcases-pending-regen-modal-title"
              defaultMessage="Regenerate drafts with AI"
            />
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>
              <FormattedMessage
                id="testcases-pending-regen-instructions-label"
                defaultMessage="Hints (optional, stored on job)"
              />
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={regenerateInstructions}
              onChange={(e) => setRegenerateInstructions(e.target.value)}
              disabled={bulkWorking}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>
              <FormattedMessage
                id="testcases-pending-regen-feedback-label"
                defaultMessage="What should change"
              />
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              value={regenerateFeedback}
              onChange={(e) => setRegenerateFeedback(e.target.value)}
              disabled={bulkWorking}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={bulkWorking} onClick={() => setRegenerateModalOpen(false)}>
            <FormattedMessage id="common-cancel" defaultMessage="Cancel" />
          </Button>
          <Button variant="primary" disabled={bulkWorking} onClick={submitAiRegeneration}>
            {bulkWorking ? (
              <Spinner animation="border" size="sm" />
            ) : (
              <FormattedMessage id="testcases-pending-regen-submit" defaultMessage="Queue" />
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={rejectModal}
        onHide={() => {
          if (!bulkWorking && !actionBusy) setRejectModal(false);
        }}
        centered
      >
        <Modal.Header closeButton={!bulkWorking && !actionBusy}>
          <Modal.Title>
            {rejectTargetIds && rejectTargetIds.length > 1 ? (
              <FormattedMessage id="testcases-bulk-reject-title" defaultMessage="Reject selected drafts" />
            ) : (
              <FormattedMessage id="testcases-pending-reject-title" defaultMessage="Reject draft test case" />
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label className="small text-muted">
              <FormattedMessage id="testcases-pending-reject-reason" defaultMessage="Reason (optional)" />
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={!!bulkWorking || !!actionBusy} onClick={() => setRejectModal(false)}>
            <FormattedMessage id="common-cancel" defaultMessage="Cancel" />
          </Button>
          <Button variant="danger" onClick={handleReject} disabled={!!bulkWorking || !!actionBusy}>
            {bulkWorking || actionBusy != null ? (
              <Spinner animation="border" size="sm" />
            ) : (
              <FormattedMessage id="testcases-pending-reject-confirm" defaultMessage="Reject" />
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={bulkDiscardModal} onHide={() => !bulkWorking && setBulkDiscardModal(false)} centered>
        <Modal.Header closeButton={!bulkWorking}>
          <Modal.Title>
            <FormattedMessage id="testcases-bulk-discard-title" defaultMessage="Discard selected drafts?" />
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-0">
            <FormattedMessage
              id="testcases-bulk-discard-body"
              defaultMessage="Drafts will be discarded (not promoted). This does not call the AI again."
            />
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={bulkWorking} onClick={() => setBulkDiscardModal(false)}>
            <FormattedMessage id="common-cancel" defaultMessage="Cancel" />
          </Button>
          <Button variant="warning" disabled={bulkWorking} onClick={submitBulkDiscardCandidates}>
            {bulkWorking ? (
              <Spinner animation="border" size="sm" />
            ) : (
              <FormattedMessage id="testcases-pending-discard-confirm" defaultMessage="Confirm" />
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={discardJobModal != null} onHide={() => !bulkWorking && setDiscardJobModal(null)} centered>
        <Modal.Header closeButton={!bulkWorking}>
          <Modal.Title>
            <FormattedMessage id="testcases-discard-job-title" defaultMessage="Discard all pending for this job?" />
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-0">
            <FormattedMessage
              id="testcases-discard-job-body"
              defaultMessage="Job {id}: every pending test case in this batch will be discarded."
              values={{ id: discardJobModal ?? '' }}
            />
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={bulkWorking} onClick={() => setDiscardJobModal(null)}>
            <FormattedMessage id="common-cancel" defaultMessage="Cancel" />
          </Button>
          <Button variant="warning" disabled={bulkWorking} onClick={submitDiscardJob}>
            {bulkWorking ? (
              <Spinner animation="border" size="sm" />
            ) : (
              <FormattedMessage id="testcases-pending-discard-confirm" defaultMessage="Confirm" />
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <GenerationValidationModal
        show={validatorRowId != null && testCaseValFragment != null}
        onHide={() => setValidatorRowId(null)}
        project={validatorProjectForModal}
        artifactKind="test_cases"
        titleId="testcases-gen-val-title"
        titleDefaultMessage="Validator agent — test case draft"
        labelId="testcases-gen-val-intro"
        labelDefaultMessage="Rubric: requirement coverage, expected behavior, negatives, boundaries, compliance, redundancy, and automation readiness. Results are advisory."
        requestFragment={testCaseValFragment}
      />
    </div>
  );
}
