import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { getTestAgents } from 'utils/apiServices';

const ProjectTestAgentSelectionModal = ({ show, onHide, onExecuteButton, multiSelect = false }) => {
  const [agents, setAgents] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      setSelectedAgents([]);
      setAgents([]);
      fetchTestAgents();
    }
  }, [show]);

  const fetchTestAgents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getTestAgents({ status: 'READY' });
      const agentsList = response.data?.data || [];
      if (agentsList.length === 0) {
        setError('No test agents are available.');
      } else {
        setAgents(agentsList);
      }
    } catch (err) {
      setError('Failed to fetch test agents.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgentSelection = (e, agent) => {
    const isChecked = e.target.checked;
    const selectedAgentNames = selectedAgents;

    if (isChecked) {
      selectedAgentNames.push(agent.name);
    } else {
      const index = selectedAgentNames.indexOf(agent.name);
      if (index > -1) {
        selectedAgentNames.splice(index, 1);
      }
    }
    console.log(selectedAgentNames);
    setSelectedAgents(selectedAgentNames);
  };

  const handleExecuteButton = async () => {
    console.log('Agents', selectedAgents);
    onExecuteButton(selectedAgents);
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header>
        <Modal.Title>Available Test Agents</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <div className="alert alert-danger">{error}</div>}
        {isLoading ? (
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : (
          <Form>
            {agents.map((agent) => {
              return (
                <Form.Check
                  key={agent?.test_agent_id}
                  type="checkbox"
                  id={`agent-checkbox-${agent?.test_agent_id}`}
                  label={<span className="mapping-check-box-label">{agent?.name}</span>}
                  onChange={(e) => handleAgentSelection(e, agent)}
                  className="mb-2 custom-checkbox-lg custom-checkbox-dark d-flex gap-2"
                />
              );
            })}
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleExecuteButton}>
          Execute
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ProjectTestAgentSelectionModal;
