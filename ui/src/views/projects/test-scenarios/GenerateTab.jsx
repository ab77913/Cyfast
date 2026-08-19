import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import { FormattedMessage, useIntl } from 'react-intl';

import {
  TEST_SCENARIO_GENERATION_TYPES,
  TEST_SCENARIO_SAFETY_OPTIONS,
  createTestScenarioGenerationJob,
  getTestScenarioGenerationJob,
  getRequirements
} from 'utils/apiServices';

const DEFAULT_SELECTED_TYPES = TEST_SCENARIO_GENERATION_TYPES.filter((x) => x.defaultOn).map((x) => x.value);

function buildSafetyState() {
  const o = {};
  TEST_SCENARIO_SAFETY_OPTIONS.forEach((x) => {
    o[x.key] = false;
  });
  return o;
}

export default function GenerateTab({ project, onGenerated }) {
  const intl = useIntl();
  const [requirements, setRequirements] = useState([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [allApproved, setAllApproved] = useState(true);
  const [selectedReqs, setSelectedReqs] = useState([]);
  const [scenarioTypesSel, setScenarioTypesSel] = useState(() => [...DEFAULT_SELECTED_TYPES]);
  const [safety, setSafety] = useState(() => buildSafetyState());
  const [genInstructions, setGenInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!project?.project_id) return;
      setLoadingReqs(true);
      try {
        const res = await getRequirements({ project_id: project.project_id, status: 'ACTIVE' }, { page: 1, size: 500 });
        const rows = res.data?.data || [];
        if (!cancelled) setRequirements(rows);
      } catch (e) {
        console.error(e);
        if (!cancelled) setRequirements([]);
      } finally {
        if (!cancelled) setLoadingReqs(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [project?.project_id]);

  const scenarioTypeOptions = useMemo(
    () => TEST_SCENARIO_GENERATION_TYPES.map((x) => ({ value: x.value, label: x.label })),
    []
  );

  const selectedScenarioTypeOptions = useMemo(
    () => scenarioTypeOptions.filter((o) => scenarioTypesSel.includes(o.value)),
    [scenarioTypeOptions, scenarioTypesSel]
  );

  const reqOptions = useMemo(
    () =>
      requirements.map((r) => ({
        value: r.requirement_id,
        label: `${r.requirement_no || r.requirement_id} — ${r.title || '(no title)'}`
      })),
    [requirements]
  );

  const pollJobUntilTerminal = async (jobId) => {
    const maxMs = 20 * 60 * 1000;
    const delay = 4000;
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      /* eslint-disable no-await-in-loop */
      const res = await getTestScenarioGenerationJob(jobId);
      const j = res.data;
      const s = j?.status;
      if (s === 'COMPLETED') return j;
      if (s === 'FAILED') throw new Error(j.error_message || 'Job failed.');
      await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error(
      intl.formatMessage({
        id: 'scenarios-gen-timeout',
        defaultMessage:
          'This is taking longer than expected. Check the job list or the bell notifications.'
      })
    );
  };

  const handleGenerate = async () => {
    setError(null);
    setInfo(null);
    if (!scenarioTypesSel.length) {
      setError(
        intl.formatMessage({
          id: 'scenarios-gen-types-required',
          defaultMessage: 'Select at least one scenario category.'
        })
      );
      return;
    }
    if (!allApproved && (!selectedReqs || !selectedReqs.length)) {
      setError(
        intl.formatMessage({
          id: 'scenarios-gen-reqs-required',
          defaultMessage: 'Select at least one ACTIVE requirement or choose all approved requirements.'
        })
      );
      return;
    }
    if (!project?.organization_id) {
      setError('Project organization_id is required.');
      return;
    }

    const safetyPayload = {};
    TEST_SCENARIO_SAFETY_OPTIONS.forEach((x) => {
      if (safety[x.key]) safetyPayload[x.key] = true;
    });

    setSubmitting(true);
    try {
      const payload = {
        project_id: project.project_id,
        organization_id: project.organization_id,
        all_approved: allApproved,
        requirement_ids: allApproved ? [] : selectedReqs.map((x) => x.value),
        scenario_types: [...scenarioTypesSel],
        safety_options: safetyPayload
      };
      const extra = genInstructions.trim();
      if (extra) payload.additional_instructions = extra;
      const res = await createTestScenarioGenerationJob(payload);
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
          id: 'scenarios-gen-success',
          defaultMessage: 'Draft scenarios created. Switch to the Pending tab on this screen to review them.'
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
          id="scenarios-gen-intro"
          defaultMessage="Generate structured, requirement-traceable test scenarios from ACTIVE requirements in this project."
        />
      </p>
      <p className="text-muted small mb-3">
        <FormattedMessage
          id="scenarios-gen-scope"
          defaultMessage='Generated scenarios stay separate from automation inventory ("test cases" parsed from code). Approve drafts to persist them into the test_scenario backlog.'
        />
      </p>

      <Form.Group className="mb-3">
        <Form.Check
          type="radio"
          name="scenario-req-scope"
          id="scenario-req-all"
          label={
            <FormattedMessage
              id="scenarios-gen-all-approved"
              defaultMessage="Generate for all ACTIVE (approved) requirements in this project."
            />
          }
          checked={allApproved}
          onChange={() => setAllApproved(true)}
        />
        <Form.Check
          type="radio"
          name="scenario-req-scope"
          id="scenario-req-multi"
          className="mt-1"
          label={
            <FormattedMessage id="scenarios-gen-multi-select" defaultMessage="Generate for selected requirements only." />
          }
          checked={!allApproved}
          onChange={() => setAllApproved(false)}
        />
      </Form.Group>

      {!allApproved ? (
        <Form.Group className="mb-3">
          <Form.Label className="small text-muted fw-semibold">
            <FormattedMessage id="scenarios-gen-req-label" defaultMessage="Requirements" />
          </Form.Label>
          {loadingReqs ? (
            <Spinner animation="border" size="sm" className="ms-2" />
          ) : (
            <Select
              isMulti
              options={reqOptions}
              value={selectedReqs}
              onChange={setSelectedReqs}
              placeholder={intl.formatMessage({
                id: 'scenarios-gen-req-placeholder',
                defaultMessage: 'Pick one or more requirements…'
              })}
            />
          )}
        </Form.Group>
      ) : (
        <Alert variant="light" className="small py-2 mb-3 border">
          <FormattedMessage
            id="scenarios-gen-all-hint"
            defaultMessage="Every ACTIVE requirement loaded for this project is included automatically (maximum 50 per job on the server)."
          />
          {loadingReqs ? (
            <>
              {' '}
              <Spinner animation="border" size="sm" />
            </>
          ) : (
            <>
              {' '}
              <FormattedMessage id="scenarios-gen-all-count" defaultMessage="({n} requirements visible for this project.)" values={{ n: requirements.length }} />
            </>
          )}
        </Alert>
      )}

      <Form.Group className="mb-3">
        <Form.Label className="small text-muted fw-semibold">
          <FormattedMessage id="scenarios-gen-types-label" defaultMessage="Scenario categories" />
        </Form.Label>
        <Select
          isMulti
          options={scenarioTypeOptions}
          value={selectedScenarioTypeOptions}
          onChange={(opts) => setScenarioTypesSel((opts || []).map((o) => o.value))}
          placeholder={intl.formatMessage({
            id: 'scenarios-gen-types-ph',
            defaultMessage: 'Which kinds of scenarios should the model produce?'
          })}
        />
      </Form.Group>

      <div className="mb-3">
        <div className="small text-muted fw-semibold mb-2">
          <FormattedMessage
            id="scenarios-gen-safety-heading"
            defaultMessage="Regulated / safety-critical add-ons (optional)"
          />
        </div>
        {TEST_SCENARIO_SAFETY_OPTIONS.map((x) => (
          <Form.Check
            key={x.key}
            type="checkbox"
            id={`safety-${x.key}`}
            className="mb-1"
            label={x.label}
            checked={Boolean(safety[x.key])}
            onChange={(e) => setSafety((prev) => ({ ...prev, [x.key]: e.target.checked }))}
          />
        ))}
      </div>

      <Form.Group className="mb-3">
        <Form.Label className="small text-muted fw-semibold">
          <FormattedMessage id="scenarios-gen-instructions-label" defaultMessage="Optional hints for the model" />
        </Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={genInstructions}
          onChange={(e) => setGenInstructions(e.target.value)}
          placeholder={intl.formatMessage({
            id: 'scenarios-gen-instructions-ph',
            defaultMessage: 'e.g., focus on role-based workflows, HIPAA constraints …'
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

      <Button variant="primary" onClick={handleGenerate} disabled={submitting}>
        {submitting ? (
          <>
            <Spinner animation="border" size="sm" className="me-2" />
            <FormattedMessage id="scenarios-gen-busy" defaultMessage="Generating…" />
          </>
        ) : (
          <FormattedMessage id="scenarios-gen-submit" defaultMessage="Generate test scenarios" />
        )}
      </Button>
    </div>
  );
}
