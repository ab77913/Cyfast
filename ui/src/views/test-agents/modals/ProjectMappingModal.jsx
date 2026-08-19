import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { getProjects, mapProjectsToAgent, bulkMapProjectsToAgents } from 'utils/apiServices';

const ProjectMappingModal = ({ show, onHide, agent, agents, afterSuccess }) => {
  const effectiveAgents = useMemo(() => {
    if (Array.isArray(agents) && agents.length > 0) return agents;
    if (agent && agent.test_agent_id) return [agent];
    return [];
  }, [agents, agent]);

  const [projects, setProjects] = useState([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mappingError, setMappingError] = useState('');
  const selectAllButtonRef = useRef(null);

  useEffect(() => {
    if (show && effectiveAgents.length > 0) {
      fetchProjects();
      const fromRows = [];
      for (const a of effectiveAgents) {
        const list = Array.isArray(a?.project_ids) ? a.project_ids : [];
        for (const entry of list) {
          const pid = typeof entry === 'object' && entry != null ? entry.project_id : entry;
          if (pid != null && Number.isFinite(Number(pid))) {
            fromRows.push(Number(pid));
          }
        }
      }
      setSelectedProjectIds([...new Set(fromRows)]);
    } else if (!show) {
      setProjects([]);
      setSelectedProjectIds([]);
    }
  }, [show, effectiveAgents]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await getProjects();
      setProjects(response.data.data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mappingError) {
      const timer = setTimeout(() => {
        setMappingError(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [mappingError]);

  const handleCheckboxChange = (projectId) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  };

  const handleSelectAll = () => {
    const allProjectIds = projects.map((project) => project.project_id);
    setSelectedProjectIds(allProjectIds);
  };

  const handleDeselectAll = () => {
    setSelectedProjectIds([]);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setMappingError('');
    try {
      const ids = effectiveAgents.map((a) => a.test_agent_id).filter(Boolean);

      let response;
      if (ids.length <= 1) {
        response = await mapProjectsToAgent(ids[0], selectedProjectIds);
        if (!(response.status === 200 && response.data === true)) {
          setMappingError('Failed to map projects. Please try again.');
          setIsSubmitting(false);
          return;
        }
      } else {
        response = await bulkMapProjectsToAgents(ids, selectedProjectIds);
        if (response.status !== 200 || !response.data) {
          setMappingError('Failed to map projects. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      await afterSuccess(response.data);
      onHide();
    } catch (err) {
      console.error('Error mapping projects:', err);
      setMappingError(err?.response?.data?.error || err?.response?.data?.message || 'An unexpected error occurred during mapping.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const InfoMessage = ({ message }) => (
    <div className="alert alert-danger text-center my-3 mx-3">{message}</div>
  );

  const title =
    effectiveAgents.length > 1
      ? `Map projects to ${effectiveAgents.length} agents`
      : `Map Projects to ${effectiveAgents[0]?.name || ''}`;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      {mappingError && <InfoMessage message={mappingError} />}

      <Modal.Body>
        {isLoading ? (
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : (
          <>
            <div className="d-flex justify-content-end mb-3 gap-2">
              <Button
                ref={selectAllButtonRef}
                variant="outline-primary custom-button"
                size="sm"
                onClick={() => {
                  handleSelectAll();
                  selectAllButtonRef.current?.blur();
                }}
              >
                Select All
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </div>
            <p className="small text-muted">
              Saves the checked projects for{' '}
              {effectiveAgents.length > 1
                ? 'each selected agent (same mapping)'
                : 'this agent'}
              .
              Uncheck all and submit to remove every project assignment.
            </p>
            <Form>
              {projects.map((project) => (
                <Form.Check
                  key={project?.project_id}
                  type="checkbox"
                  id={`project-${project?.project_id}`}
                  label={<span className="mapping-check-box-label">{project?.name}</span>}
                  checked={selectedProjectIds.includes(project?.project_id)}
                  onChange={() => handleCheckboxChange(project?.project_id)}
                  className="mb-3 custom-checkbox-lg custom-checkbox-dark d-flex gap-2"
                />
              ))}
            </Form>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Mapping…' : 'Submit'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ProjectMappingModal;
