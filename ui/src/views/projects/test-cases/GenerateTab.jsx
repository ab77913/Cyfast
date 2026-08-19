import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { FormattedMessage, useIntl } from 'react-intl';

import {
  createTestCaseGenerationJob,
  getTestCaseGenerationJob,
  getTestScenarios
} from 'utils/apiServices';

export default function GenerateTab({ project, onGenerated }) {
  const intl = useIntl();
  const [scenarioCount, setScenarioCount] = useState(0);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [genInstructions, setGenInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!project?.project_id) return;
      setLoadingScenarios(true);
      try {
        const res = await getTestScenarios({ project_id: project.project_id }, { page: 1, size: 1 });
        const total = res.data?.pagination?.totalItems ?? res.data?.data?.length ?? 0;
        if (!cancelled) setScenarioCount(total);
      } catch (e) {
        console.error(e);
        if (!cancelled) setScenarioCount(0);
      } finally {
        if (!cancelled) setLoadingScenarios(false);
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
      const res = await getTestCaseGenerationJob(jobId);
      const j = res.data;
      const s = j?.status;
      if (s === 'COMPLETED') return j;
      if (s === 'FAILED') throw new Error(j.error_message || 'Job failed.');
      await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error(
      intl.formatMessage({
        id: 'testcases-gen-timeout',
        defaultMessage:
          'This is taking longer than expected. Check notifications or the Pending tab shortly.'
      })
    );
  };

  const handleGenerate = async () => {
    setError(null);
    setInfo(null);
    if (!scenarioCount) {
      setError(
        intl.formatMessage({
          id: 'testcases-gen-no-scenarios',
          defaultMessage: 'No active test scenarios found. Approve scenarios first.'
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
        all_active: true
      };
      const extra = genInstructions.trim();
      if (extra) payload.additional_instructions = extra;

      const res = await createTestCaseGenerationJob(payload);
      if (![200, 201, 202].includes(res.status)) {
        throw new Error(
          res.data?.error ||
            res.data?.message ||
            'Generation failed'
        );
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
      const count = job?.generated_count ?? job?.pending_count ?? 'some';
      setInfo(
        intl.formatMessage(
          {
            id: 'testcases-gen-success',
            defaultMessage: 'Generated {count} draft test case(s). Review them on the Pending tab.'
          },
          { count }
        )
      );
      setGenInstructions('');
      if (typeof onGenerated === 'function') onGenerated();
    } catch (e) {
      setError(
        e.response?.data?.error ||
          e.response?.data?.message ||
          e.message ||
          String(e)
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-3">
      <p className="text-muted">
        <FormattedMessage
          id="testcases-gen-intro"
          defaultMessage="Generate draft test cases from approved active test scenarios in this project."
        />
      </p>

      <Alert variant="light" className="small py-2 mb-3 border">
        <FormattedMessage
          id="testcases-gen-scenario-count"
          defaultMessage="Active test scenarios available:"
        />{' '}
        {loadingScenarios ? <Spinner animation="border" size="sm" /> : scenarioCount}
      </Alert>

      <Form.Group className="mb-3">
        <Form.Label className="small text-muted fw-semibold">
          <FormattedMessage id="testcases-gen-instructions-label" defaultMessage="Optional hints for the model" />
        </Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={genInstructions}
          onChange={(e) => setGenInstructions(e.target.value)}
          placeholder={intl.formatMessage({
            id: 'testcases-gen-instructions-ph',
            defaultMessage: 'e.g., emphasize boundary values, keep steps manual …'
          })}
        />
      </Form.Group>

      {info && (
        <Alert variant="success" className="py-2" dismissible onClose={() => setInfo(null)}>
          {info}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" className="py-2" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Button variant="primary" onClick={handleGenerate} disabled={submitting || loadingScenarios}>
        {submitting ? (
          <>
            <Spinner animation="border" size="sm" className="me-2" />
            <FormattedMessage id="testcases-gen-busy" defaultMessage="Generating…" />
          </>
        ) : (
          <FormattedMessage id="testcases-gen-submit" defaultMessage="Generate draft test cases" />
        )}
      </Button>
    </div>
  );
}
