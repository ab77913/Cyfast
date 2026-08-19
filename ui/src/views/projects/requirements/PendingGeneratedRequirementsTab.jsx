import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { FormattedMessage, useIntl } from 'react-intl';

import {
  bulkApproveGeneratedRequirements,
  bulkDiscardGeneratedRequirements,
  bulkRejectGeneratedRequirements,
  discardPendingRequirementJobs,
  getRequirementGenerationJob,
  listPendingGeneratedRequirements,
  regeneratePendingCandidatesWithAi
} from 'utils/apiServices';

import GenerationValidationModal from '../../shared-modals/GenerationValidationModal';
import ListPagination from 'views/shared/ListPagination';

const DEFAULT_PAGE_SIZE = 25;

export default function PendingGeneratedRequirementsTab({ project, onApproved }) {
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
    return rows.find((x) => x.generated_requirement_id === validatorRowId) || null;
  }, [validatorRowId, rows]);

  const validatorProjectForModal = useMemo(() => {
    if (!project) return null;
    if (validatedRow?.job?.organization_id != null) {
      return { ...project, organization_id: validatedRow.job.organization_id };
    }
    return project;
  }, [project, validatedRow]);

  const requirementValFragment = useMemo(() => {
    if (!validatedRow) return null;
    const r = validatedRow;
    const drafts = [
      {
        requirement_no: r.requirement_no,
        requirement_category: r.requirement_category,
        title: r.title,
        description: r.description,
        rationale: r.rationale
      }
    ];
    const related_drafts = rows
      .filter((x) => x.generated_requirement_id !== r.generated_requirement_id)
      .slice(0, 30)
      .map((x) => ({
        requirement_no: x.requirement_no,
        title: x.title,
        requirement_category: x.requirement_category
      }));
    return { drafts, related_drafts };
  }, [validatedRow, rows]);

  const selectedIdsArray = useMemo(() => [...selectedIds], [selectedIds]);

  const selectedDraftsResolved = useMemo(
    () =>
      selectedIdsArray
        .map((id) => rows.find((r) => r.generated_requirement_id === id))
        .filter(Boolean),
    [selectedIdsArray, rows]
  );

  const regenerateBarrier = useMemo(() => {
    if (!selectedIdsArray.length)
      return { kind: 'none', jobId: undefined };
    if (selectedDraftsResolved.length !== selectedIdsArray.length) {
      return { kind: 'not_all_visible', jobId: undefined };
    }
    const jobIds = [
      ...new Set(
        selectedDraftsResolved.map((r) => r.job?.job_id).filter((x) => x != null)
      )
    ];
    if (jobIds.length > 1) return { kind: 'multi_job', jobId: undefined };
    return { kind: 'ok', jobId: jobIds[0] };
  }, [selectedIdsArray, selectedDraftsResolved]);

  useEffect(() => {
    const valid = new Set(rows.map((r) => r.generated_requirement_id));
    setSelectedIds((prev) => new Set([...prev].filter((id) => valid.has(id))));
  }, [rows]);

  const fetchPending = useCallback(async () => {
    if (!project?.project_id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listPendingGeneratedRequirements(project.project_id, {
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

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(rows.map((r) => r.generated_requirement_id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const pollJobUntilTerminal = async (jobId) => {
    const maxMs = 20 * 60 * 1000;
    const delay = 4000;
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      /* eslint-disable no-await-in-loop */
      const res = await getRequirementGenerationJob(jobId);
      const j = res.data;
      const s = j?.status;
      if (s === 'COMPLETED') return j;
      if (s === 'FAILED') throw new Error(j.error_message || 'Job failed.');
      await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error(
      intl.formatMessage({
        id: 'requirements-pending-regen-timeout',
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
          id: 'requirements-pending-regen-feedback-required',
          defaultMessage: 'Describe how the AI should change the selected drafts.'
        })
      );
      return;
    }
    setBulkWorking(true);
    setError(null);
    try {
      const res = await regeneratePendingCandidatesWithAi({
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

  const approveByIds = async (ids) => {
    if (!ids.length || !project?.project_id) return;
    const multi = ids.length > 1;
    if (multi) setBulkWorking(true);
    else setActionBusy(ids[0]);
    try {
      const res = await bulkApproveGeneratedRequirements({
        project_id: project.project_id,
        candidate_ids: ids
      });
      if (res.status !== 200) throw new Error(res.data?.error || 'Approve failed');
      const d = res.data;
      if (d.failed > 0) {
        setError(
          intl.formatMessage(
            {
              id: 'req-pending-bulk-approve-partial',
              defaultMessage: 'Approved {ok}; {bad} failed.'
            },
            { ok: d.succeeded, bad: d.failed }
          )
        );
      }
      setSelectedIds((prev) => {
        const n = new Set(prev);
        ids.forEach((id) => n.delete(id));
        return n;
      });
      await fetchPending();
      if (d.succeeded > 0 && typeof onApproved === 'function') onApproved();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      if (multi) setBulkWorking(false);
      else setActionBusy(null);
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

  const submitReject = async () => {
    if (!rejectTargetIds?.length || !project?.project_id) return;
    const multi = rejectTargetIds.length > 1;
    if (multi) setBulkWorking(true);
    else setActionBusy(rejectTargetIds[0]);
    try {
      const res = await bulkRejectGeneratedRequirements({
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
              id: 'req-pending-bulk-reject-partial',
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
      setRejectModal(false);
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
      const res = await bulkDiscardGeneratedRequirements({
        project_id: project.project_id,
        candidate_ids: selectedIdsArray
      });
      if (res.status !== 200) throw new Error(res.data?.error || 'Discard failed');
      const d = res.data;
      if (d.failed > 0) {
        setError(
          intl.formatMessage(
            {
              id: 'req-pending-bulk-discard-partial',
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
      const res = await discardPendingRequirementJobs({
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

  return (
    <div className="py-3">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <p className="text-muted mb-0">
          <FormattedMessage
            id="requirements-pending-intro"
            defaultMessage="Approve drafts to promote them into the active requirements list. Reject removes them from review. Regenerate runs the AI again on selected pending drafts from the same batch (tick rows, then Regenerate with AI)."
          />
        </p>
        <Button variant="outline-primary" size="sm" onClick={fetchPending} disabled={loading}>
          <FormattedMessage id="requirements-pending-refresh" defaultMessage="Refresh" />
        </Button>
      </div>

      {pendingJobIds.length > 0 && (
        <div className="mb-3">
          <span className="small text-muted me-2">
            <FormattedMessage
              id="requirements-pending-job-batch-label"
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
                id="requirements-discard-job-pending"
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
              id="requirements-pending-selected-count"
              defaultMessage="{n} selected"
              values={{ n: selectedIdsArray.length }}
            />
          </span>
          <Button variant="success" size="sm" disabled={anyBusy || !project?.project_id} onClick={() => approveByIds(selectedIdsArray)}>
            <FormattedMessage id="requirements-pending-bulk-approve" defaultMessage="Approve selected" />
          </Button>
          <Button variant="outline-danger" size="sm" disabled={anyBusy || !project?.project_id} onClick={openBulkReject}>
            <FormattedMessage id="requirements-pending-bulk-reject" defaultMessage="Reject selected" />
          </Button>
          <Button variant="outline-primary" size="sm"
            disabled={
              anyBusy ||
              !project?.project_id ||
              regenerateBarrier.kind !== 'ok' ||
              !selectedIdsArray.length
            }
            onClick={openRegenerateModal}>
            <FormattedMessage id="requirements-pending-regen-ai" defaultMessage="Regenerate with AI" />
          </Button>
          <Button variant="outline-warning" size="sm" disabled={anyBusy || !project?.project_id} onClick={() => setBulkDiscardModal(true)}>
            <FormattedMessage id="requirements-pending-bulk-discard" defaultMessage="Discard selected" />
          </Button>
          <Button variant="link" size="sm" className="py-0" disabled={anyBusy} onClick={clearSelection}>
            <FormattedMessage id="requirements-pending-clear-selection" defaultMessage="Clear selection" />
          </Button>
          {regenerateBarrier.kind === 'multi_job' ? (
            <div className="w-100 small text-warning mb-0">
              <FormattedMessage
                id="requirements-pending-regen-multi-job"
                defaultMessage="AI regeneration needs drafts from one generation batch only. Narrow your selection."
              />
            </div>
          ) : regenerateBarrier.kind === 'not_all_visible' ? (
            <div className="w-100 small text-warning mb-0">
              <FormattedMessage
                id="requirements-pending-regen-not-visible"
                defaultMessage="Every selected draft must be on this page. Clear selection, navigate pages, or use Select all on each page separately."
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
        <Spinner animation="border" />
      ) : rows.length === 0 && Number(pagination?.totalItems ?? 0) === 0 ? (
        <Alert variant="light" className="border">
          <FormattedMessage id="requirements-pending-empty" defaultMessage="No drafts awaiting approval." />
        </Alert>
      ) : (
        <>
          {rows.length === 0 ? (
            <Alert variant="light" className="border mb-3">
              <FormattedMessage
                id="requirements-pending-page-empty"
                defaultMessage="No drafts on this page — use pagination or Refresh."
              />
            </Alert>
          ) : (
            <div className="scroll-container">
              <Table responsive hover className="align-middle mb-0">
            <thead className="thead-light">
              <tr>
                <th style={{ width: '42px' }} className="text-center">
                  <Form.Check
                    aria-label="select all"
                    checked={rows.length > 0 && selectedIdsArray.length === rows.length}
                    onChange={(e) => (e.target.checked ? selectAllVisible() : clearSelection())}
                    disabled={anyBusy}
                  />
                </th>
                <th>
                  <FormattedMessage id="requirements-pending-col-cat" defaultMessage="Type" />
                </th>
                <th>
                  <FormattedMessage id="requirements-pending-col-no" defaultMessage="Req #" />
                </th>
                <th>
                  <FormattedMessage id="requirements-pending-col-title" defaultMessage="Title" />
                </th>
                <th>
                  <FormattedMessage id="requirements-pending-col-desc" defaultMessage="Description" />
                </th>
                <th className="text-center">
                  <FormattedMessage id="requirements-pending-col-actions" defaultMessage="Actions" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.generated_requirement_id}>
                  <td className="text-center align-middle">
                    <Form.Check
                      aria-label="select row"
                      checked={selectedIds.has(r.generated_requirement_id)}
                      onChange={() => toggleSelected(r.generated_requirement_id)}
                      disabled={anyBusy}
                    />
                  </td>
                  <td className="small">{r.requirement_category}</td>
                  <td className="small">{r.requirement_no}</td>
                  <td>{r.title}</td>
                  <td className="small text-muted" style={{ maxWidth: '320px', whiteSpace: 'pre-wrap' }}>
                    {(r.description || '').slice(0, 400)}
                    {(r.description || '').length > 400 ? '…' : ''}
                  </td>
                  <td className="text-center text-nowrap">
                    <Button
                      variant="outline-info"
                      size="sm"
                      className="me-1"
                      disabled={actionBusy === r.generated_requirement_id || !project?.project_id || bulkWorking}
                      onClick={() => setValidatorRowId(r.generated_requirement_id)}
                    >
                      <FormattedMessage id="requirements-pending-validator" defaultMessage="Validate" />
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      className="me-1"
                      disabled={actionBusy === r.generated_requirement_id || bulkWorking}
                      onClick={() => approveByIds([r.generated_requirement_id])}
                    >
                      <FormattedMessage id="requirements-pending-approve" defaultMessage="Approve" />
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      disabled={actionBusy === r.generated_requirement_id || bulkWorking}
                      onClick={() => openReject(r.generated_requirement_id)}
                    >
                      <FormattedMessage id="requirements-pending-reject" defaultMessage="Reject" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
          )}
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

      <Modal
        show={regenerateModalOpen}
        onHide={() => !bulkWorking && setRegenerateModalOpen(false)}
        centered
      >
        <Modal.Header closeButton={!bulkWorking}>
          <Modal.Title>
            <FormattedMessage
              id="requirements-pending-regen-modal-title"
              defaultMessage="Regenerate selected drafts with AI"
            />
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted">
            <FormattedMessage
              id="requirements-pending-regen-modal-intro"
              defaultMessage='Job {job}: {count} draft(s). Only selected pending rows are revised; other pendings in this batch stay as-is.'
              values={{
                job: regenerateBarrier.jobId != null ? regenerateBarrier.jobId : '—',
                count: selectedIdsArray.length
              }}
            />
          </p>
          <Form.Group className="mb-3">
            <Form.Label>
              <FormattedMessage
                id="requirements-pending-regen-instructions-label"
                defaultMessage="Extraction hints (optional, stored on job)"
              />
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={regenerateInstructions}
              onChange={(e) => setRegenerateInstructions(e.target.value)}
              disabled={bulkWorking}
              placeholder={intl.formatMessage({
                id: 'requirements-pending-regen-instructions-ph',
                defaultMessage: 'Leave blank and submit to clear saved hints on this job.'
              })}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>
              <FormattedMessage
                id="requirements-pending-regen-feedback-label"
                defaultMessage="What should change"
              />
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              value={regenerateFeedback}
              onChange={(e) => setRegenerateFeedback(e.target.value)}
              disabled={bulkWorking}
              placeholder={intl.formatMessage({
                id: 'requirements-pending-regen-feedback-ph',
                defaultMessage:
                  'Describe edits: numbering, wording, merges, gaps, acceptance criteria …'
              })}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={bulkWorking} onClick={() => setRegenerateModalOpen(false)}>
            <FormattedMessage id="cancel" defaultMessage="Cancel" />
          </Button>
          <Button variant="primary" disabled={bulkWorking} onClick={submitAiRegeneration}>
            {bulkWorking ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                <FormattedMessage id="requirements-pending-regen-working" defaultMessage="Working…" />
              </>
            ) : (
              <FormattedMessage id="requirements-pending-regen-submit" defaultMessage="Queue regeneration" />
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
            <FormattedMessage
              id={
                rejectTargetIds && rejectTargetIds.length > 1
                  ? 'requirements-bulk-reject-title'
                  : 'requirements-reject-title'
              }
              defaultMessage={rejectTargetIds && rejectTargetIds.length > 1 ? 'Reject selected drafts' : 'Reject draft'}
            />
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {rejectTargetIds && rejectTargetIds.length > 1 ? (
            <p className="small text-muted">
              <FormattedMessage
                id="requirements-bulk-reject-count"
                defaultMessage="{n} draft(s)."
                values={{ n: rejectTargetIds.length }}
              />
            </p>
          ) : null}
          <Form.Group>
            <Form.Label>
              <FormattedMessage id="requirements-reject-reason" defaultMessage="Reason (optional)" />
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={!!bulkWorking || !!actionBusy} onClick={() => setRejectModal(false)}>
            <FormattedMessage id="cancel" defaultMessage="Cancel" />
          </Button>
          <Button variant="danger" disabled={!!bulkWorking || !!actionBusy} onClick={submitReject}>
            <FormattedMessage id="requirements-reject-submit" defaultMessage="Reject" />
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={bulkDiscardModal} onHide={() => !bulkWorking && setBulkDiscardModal(false)} centered>
        <Modal.Header closeButton={!bulkWorking}>
          <Modal.Title>
            <FormattedMessage id="requirements-bulk-discard-title" defaultMessage="Discard selected drafts?" />
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-0">
            <FormattedMessage
              id="requirements-bulk-discard-body"
              defaultMessage="Selected drafts will be marked discarded (not promoted). This does not call the AI again."
            />
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={bulkWorking} onClick={() => setBulkDiscardModal(false)}>
            <FormattedMessage id="cancel" defaultMessage="Cancel" />
          </Button>
          <Button variant="warning" disabled={bulkWorking} onClick={submitBulkDiscardCandidates}>
            {bulkWorking ? <Spinner animation="border" size="sm" /> : <FormattedMessage id="confirm" defaultMessage="Confirm" />}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={discardJobModal != null} onHide={() => !bulkWorking && setDiscardJobModal(null)} centered>
        <Modal.Header closeButton={!bulkWorking}>
          <Modal.Title>
            <FormattedMessage id="requirements-discard-job-title" defaultMessage="Discard all pending for this job?" />
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-0">
            <FormattedMessage
              id="requirements-discard-job-body"
              defaultMessage="Job {id}: every pending draft in this batch will be discarded (not promoted). Any approved drafts remain in the promoted requirements list. Jobs with nothing left pending or approved will be removed from history."
              values={{ id: discardJobModal ?? '' }}
            />
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={bulkWorking} onClick={() => setDiscardJobModal(null)}>
            <FormattedMessage id="cancel" defaultMessage="Cancel" />
          </Button>
          <Button variant="warning" disabled={bulkWorking} onClick={submitDiscardJob}>
            {bulkWorking ? <Spinner animation="border" size="sm" /> : <FormattedMessage id="confirm" defaultMessage="Confirm" />}
          </Button>
        </Modal.Footer>
      </Modal>

      <GenerationValidationModal
        show={validatorRowId != null && requirementValFragment != null}
        onHide={() => setValidatorRowId(null)}
        project={validatorProjectForModal}
        artifactKind="requirements"
        titleId="requirements-gen-val-title"
        titleDefaultMessage="Validator agent — requirement draft"
        labelId="requirements-gen-val-intro"
        labelDefaultMessage="Rubric: correctness, completeness, consistency, testability, traceability, compliance, non-ambiguity, and domain alignment. Results are advisory."
        requestFragment={requirementValFragment}
      />
    </div>
  );
}
