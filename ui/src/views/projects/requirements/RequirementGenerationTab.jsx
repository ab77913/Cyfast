import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import { FormattedMessage, useIntl } from 'react-intl';

import {
  REQUIREMENT_GENERATION_CATEGORIES,
  createRequirementGenerationJob,
  getProjectDocuments,
  getRequirementGenerationJob
} from 'utils/apiServices';

export default function RequirementGenerationTab({ project, onGenerated }) {
  const intl = useIntl();

  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [selectedCats, setSelectedCats] = useState([]);
  /** Optional hints passed to retrieval + requirement LLM when generating. */
  const [genInstructions, setGenInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!project?.project_id) return;
      setLoadingDocs(true);
      try {
        const res = await getProjectDocuments({ project_id: project.project_id, status: 'INDEXED' }, 1, 200);
        const rows = res.data?.data || [];
        if (!cancelled) setDocuments(rows);
      } catch (e) {
        console.error(e);
        if (!cancelled) setDocuments([]);
      } finally {
        if (!cancelled) setLoadingDocs(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [project?.project_id]);

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
        id: 'requirements-gen-timeout',
        defaultMessage:
          'This is taking longer than expected. Check the job list or the bell notifications.'
      })
    );
  };

  const docOptions = documents.map((d) => ({
    value: d.project_document_id,
    label: `${d.title || d.original_filename || 'Document'} (${d.doc_type})`
  }));

  const handleGenerate = async () => {
    setError(null);
    setInfo(null);
    if (!selectedDocs.length || !selectedCats.length) {
      setError(
        intl.formatMessage({
          id: 'requirements-gen-validation',
          defaultMessage: 'Select at least one indexed document and one requirement category.'
        })
      );
      return;
    }
    if (!project?.organization_id) {
      setError('Project organization_id is required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        project_id: project.project_id,
        organization_id: project.organization_id,
        document_ids: selectedDocs.map((x) => x.value),
        requirement_categories: selectedCats.map((x) => x.value)
      };
      const extra = genInstructions.trim();
      if (extra) payload.additional_instructions = extra;
      const res = await createRequirementGenerationJob(payload);
      if (![200, 201, 202].includes(res.status)) {
        throw new Error(res.data?.error || res.data?.message || 'Generation failed');
      }
      let job = res.data;
      const jid = job?.job_id;
      if (!jid) throw new Error('Missing job_id from server.');
      if (['QUEUED', 'PROCESSING'].includes(job.status) || res.status === 202) {
        job = await pollJobUntilTerminal(jid);
      }
      if (job?.status === 'FAILED') {
        throw new Error(job.error_message || 'Job failed');
      }
      setInfo(
        intl.formatMessage({
          id: 'requirements-gen-success',
          defaultMessage: 'Draft requirements created. Review them under Pending approval.'
        })
      );
      setGenInstructions('');
      if (typeof onGenerated === 'function') onGenerated();
    } catch (e) {
      setError(e.response?.data?.error || e.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-3">
      <p className="text-muted">
        <FormattedMessage
          id="requirements-gen-intro"
          defaultMessage="Choose indexed documents and requirement types. The AI engine extracts grounded drafts for your approval."
        />
      </p>
      <p className="text-muted small mb-3">
        <FormattedMessage
          id="requirements-gen-regen-help"
          defaultMessage="To rerun the AI on specific drafts after they appear below, select them under Pending approval and use Regenerate with AI."
        />
      </p>

      {loadingDocs ? (
        <Spinner animation="border" size="sm" className="me-2" />
      ) : (
        <Alert variant="light" className="small py-2 mb-3 border">
          <FormattedMessage
            id="requirements-gen-doc-hint"
            defaultMessage="Only documents with status Indexed appear here. Upload files under Project Documents if needed."
          />
        </Alert>
      )}

      <Form.Group className="mb-3">
        <Form.Label>
          <FormattedMessage id="requirements-gen-docs-label" defaultMessage="Documents" />
        </Form.Label>
        <Select
          isMulti
          classNamePrefix="select"
          options={docOptions}
          value={selectedDocs}
          onChange={setSelectedDocs}
          placeholder={intl.formatMessage({
            id: 'requirements-gen-docs-ph',
            defaultMessage: 'Select documents…'
          })}
          menuPortalTarget={document.body}
          styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>
          <FormattedMessage id="requirements-gen-cats-label" defaultMessage="Requirement types" />
        </Form.Label>
        <Select
          isMulti
          classNamePrefix="select"
          options={REQUIREMENT_GENERATION_CATEGORIES}
          value={selectedCats}
          onChange={setSelectedCats}
          placeholder={intl.formatMessage({
            id: 'requirements-gen-cats-ph',
            defaultMessage: 'Functional, compliance, …'
          })}
          menuPortalTarget={document.body}
          styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>
          <FormattedMessage
            id="requirements-gen-instructions-label"
            defaultMessage="Additional instructions (optional)"
          />
        </Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={genInstructions}
          onChange={(e) => setGenInstructions(e.target.value)}
          placeholder={intl.formatMessage({
            id: 'requirements-gen-instructions-ph',
            defaultMessage:
              'Optional: standards to emphasize, exclusions, granularity, numbering style, stakeholder focus …'
          })}
          disabled={submitting || loadingDocs}
        />
        <Form.Text className="text-muted">
          <FormattedMessage
            id="requirements-gen-instructions-help"
            defaultMessage="Used for document search and drafting; stored on the job."
          />
        </Form.Text>
      </Form.Group>

      {error && (
        <Alert variant="danger" className="py-2">
          {error}
        </Alert>
      )}
      {info && (
        <Alert variant="success" className="py-2">
          {info}
        </Alert>
      )}

      <Button variant="primary" disabled={submitting || loadingDocs} onClick={handleGenerate}>
        {submitting ? (
          <>
            <Spinner animation="border" size="sm" className="me-2" />
            <FormattedMessage id="requirements-gen-working" defaultMessage="Generating…" />
          </>
        ) : (
          <FormattedMessage id="requirements-gen-submit" defaultMessage="Generate draft requirements" />
        )}
      </Button>
    </div>
  );
}
