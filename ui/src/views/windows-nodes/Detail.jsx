import React, { useCallback, useEffect, useState } from 'react';
import { Card, Col, Row, Spinner } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import {
  createWindowsSession,
  getWindowsEvidence,
  getWindowsNode,
  getWindowsNodeCapabilities,
  getWindowsSession,
  listWindowsProfiles,
  sendWindowsCommand,
  waitForWindowsCommandTerminal
} from 'utils/windowsApi';
import SessionPanel from './SessionPanel';
import UiTreePanel from './UiTreePanel';
import { asArray, commandLifecycleLabel, formatValue, mapError } from './windowsNodesLogic';

const Detail = () => {
  const { id } = useParams();
  const [node, setNode] = useState(null);
  const [capabilities, setCapabilities] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [session, setSession] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [tree, setTree] = useState([]);
  const [error, setError] = useState(null);
  const [commandStatus, setCommandStatus] = useState(null);
  const load = useCallback(async () => {
    try {
      const [nodeResult, capabilityResult, profileResult] = await Promise.all([
        getWindowsNode(id),
        getWindowsNodeCapabilities(id),
        listWindowsProfiles()
      ]);
      setNode(nodeResult.data);
      setCapabilities(asArray(capabilityResult.data));
      setProfiles(asArray(profileResult.data));
      setError(null);
    } catch (requestError) {
      setError(mapError(requestError));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!session?.interactive_session_id) return undefined;
    const timer = setInterval(async () => {
      try {
        const result = await getWindowsSession(session.interactive_session_id);
        setSession(result.data);
        const items = await getWindowsEvidence(session.interactive_session_id);
        setEvidence(asArray(items.data));
      } catch (pollError) {
        // Polling failures are non-fatal; surface on next user action.
        console.debug('windows session poll failed', pollError?.message || pollError);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [session?.interactive_session_id]);
  const start = async (payload) => {
    try {
      const result = await createWindowsSession(id, payload);
      setSession(result.data);
      setError(null);
    } catch (requestError) {
      setError(mapError(requestError));
      throw requestError;
    }
  };
  const command = async (action, payload) => {
    if (!session?.interactive_session_id) return;
    try {
      setCommandStatus('Evidence pending');
      const result = await sendWindowsCommand(session.interactive_session_id, action, payload);
      const resultData = result.data;
      const commandId = resultData?.execution_command_id || resultData?.command?.execution_command_id;
      if (commandId) {
        const terminal = await waitForWindowsCommandTerminal(commandId);
        setCommandStatus(commandLifecycleLabel(terminal));
        if (terminal.command?.status === 'EVIDENCE_FAILED') {
          throw Object.assign(new Error(terminal.manifest?.failure_reason || 'Mandatory evidence failed'), {
            code: 'EVIDENCE_FAILED',
            response: { data: { code: 'EVIDENCE_FAILED', message: terminal.manifest?.failure_reason || 'Mandatory evidence failed' } }
          });
        }
        if (action === 'inspect' && (resultData?.tree || terminal.command)) {
          setTree(resultData.tree || []);
        }
      } else if (action === 'inspect' && resultData?.tree) {
        setTree(resultData.tree);
        setCommandStatus('Completed');
      } else {
        setCommandStatus(null);
      }
      const items = await getWindowsEvidence(session.interactive_session_id);
      setEvidence(asArray(items.data));
      setError(null);
    } catch (requestError) {
      setCommandStatus(null);
      setError(mapError(requestError));
      throw requestError;
    }
  };
  if (!node) return <Spinner animation="border" />;
  const audit = node.audit || node.audit_events || [];
  return (
    <div>
      <h5 className="fw-bold mb-3">Windows Node: {formatValue(node.name)}</h5>
      <Row className="g-3 mb-3">
        <Col md={4}>
          <Card body>
            <h6>Health</h6>
            <p className="mb-0">
              {formatValue(node.status)} · heartbeat {formatValue(node.last_seen_at)}
            </p>
          </Card>
        </Col>
        <Col md={4}>
          <Card body>
            <h6>Identity</h6>
            <p className="mb-0">
              {formatValue(node.agent_id)}
              <br />
              {formatValue(node.os || node.metadata?.os)} / {formatValue(node.architecture || node.metadata?.architecture)}
            </p>
          </Card>
        </Col>
        <Col md={4}>
          <Card body>
            <h6>Capabilities</h6>
            <p className="mb-0">
              {capabilities.map((capability) => capability.capability || capability.command_type || capability).join(', ') || '—'}
            </p>
          </Card>
        </Col>
      </Row>
      <Card body className="mb-3">
        <SessionPanel
          node={node}
          profiles={profiles}
          session={session}
          onStart={start}
          onCommand={command}
          error={error}
          commandStatus={commandStatus}
        />
      </Card>
      <Card body className="mb-3">
        <UiTreePanel tree={tree} />
      </Card>
      <Row className="g-3">
        <Col md={6}>
          <Card body>
            <h6>Evidence</h6>
            {evidence.length ? (
              evidence.map((item) => (
                <div key={item.execution_evidence_id}>
                  {formatValue(item.filename)} · SHA-256 {formatValue(item.content_hash)}
                </div>
              ))
            ) : (
              <span className="text-muted">No evidence recorded.</span>
            )}
          </Card>
        </Col>
        <Col md={6}>
          <Card body>
            <h6>Recent commands and audit</h6>
            {audit.length ? (
              audit.map((item, index) => (
                <div key={item.windows_audit_event_id || index}>
                  {formatValue(item.event_type)} · {formatValue(item.created_date)}
                </div>
              ))
            ) : (
              <span className="text-muted">Audit details are not available from this endpoint.</span>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default Detail;
