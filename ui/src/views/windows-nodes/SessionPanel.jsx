import React, { useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row } from 'react-bootstrap';
import { canControlSession, canStartSession, mapError } from './windowsNodesLogic';

const SessionPanel = ({ node, profiles, session, onStart, onCommand, error, commandStatus }) => {
  const [projectId, setProjectId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [automationId, setAutomationId] = useState('');
  const [value, setValue] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const startable = canStartSession(node);
  const controllable = canControlSession(node, session);
  const disabledReason = startable ? 'Session is not ready for controls.' : `Node is ${node.status || 'unavailable'}.`;

  const command = async (action, payload = {}) => {
    try {
      await onCommand(action, payload);
    } catch (_) {
      /* parent displays typed error */
    }
  };

  return (
    <section>
      <h6>Interactive session</h6>
      {error && (
        <Alert variant="danger">
          <strong>{mapError(error).code}:</strong> {mapError(error).message}
        </Alert>
      )}
      {commandStatus && (
        <Alert variant={commandStatus === 'Evidence failed' ? 'danger' : commandStatus === 'Evidence pending' ? 'warning' : 'info'}>
          Command status: {commandStatus}
        </Alert>
      )}
      <Row className="g-2 align-items-end">
        <Col md={3}>
          <Form.Label>Project</Form.Label>
          <Form.Control value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="Project ID" />
        </Col>
        <Col md={4}>
          <Form.Label>Application profile</Form.Label>
          <Form.Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">Select profile</option>
            {profiles.map((profile) => (
              <option key={profile.windows_application_profile_id} value={profile.windows_application_profile_id}>
                {profile.name}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={2}>
          <Button
            className="w-100"
            disabled={!startable || !projectId || !profileId}
            title={disabledReason}
            onClick={() => onStart({ project_id: Number(projectId), application_profile_id: Number(profileId) })}
          >
            Start session
          </Button>
        </Col>
        <Col md={3}>
          <span className={`badge bg-${controllable ? 'success' : 'secondary'}`}>{session?.status || 'No active session'}</span>
        </Col>
      </Row>
      <div className="d-flex flex-wrap gap-2 mt-3">
        <Button
          size="sm"
          variant="outline-primary"
          disabled={!controllable}
          title={disabledReason}
          onClick={() => command('launch', { application_profile_id: Number(profileId) })}
        >
          Launch
        </Button>
        <Button size="sm" variant="outline-primary" disabled={!controllable} onClick={() => command('inspect')}>
          Inspect UI tree
        </Button>
        <Button size="sm" variant="outline-primary" disabled={!controllable} onClick={() => command('screenshots')}>
          Screenshot
        </Button>
      </div>
      <Row className="g-2 mt-2 align-items-end">
        <Col md={4}>
          <Form.Label>AutomationId</Form.Label>
          <Form.Control value={automationId} onChange={(e) => setAutomationId(e.target.value)} />
        </Col>
        <Col md={3}>
          <Form.Label>Value / selection</Form.Label>
          <Form.Control value={value} onChange={(e) => setValue(e.target.value)} />
        </Col>
        <Col md={5} className="d-flex gap-2">
          <Button size="sm" disabled={!controllable || !automationId} onClick={() => command('actions', { automationId })}>
            Invoke
          </Button>
          <Button
            size="sm"
            disabled={!controllable || !automationId}
            onClick={() => command('actions', { action: 'set_value', automationId, value })}
          >
            Set
          </Button>
          <Button
            size="sm"
            disabled={!controllable || !automationId}
            onClick={() => command('actions', { action: 'select', automationId, value })}
          >
            Select
          </Button>
          <Button size="sm" variant="outline-danger" disabled={!controllable} onClick={() => setConfirmClose(true)}>
            Close app
          </Button>
          <Button size="sm" variant="outline-danger" disabled={!controllable} onClick={() => command('end')}>
            End session
          </Button>
        </Col>
      </Row>
      <Modal show={confirmClose} onHide={() => setConfirmClose(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Close application?</Modal.Title>
        </Modal.Header>
        <Modal.Body>This requests a graceful close of the attached application. Unsaved work may be lost.</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirmClose(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmClose(false);
              command('actions', { action: 'close' });
            }}
          >
            Close application
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};

export default SessionPanel;
