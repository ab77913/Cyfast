import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Form } from 'react-bootstrap';
import PropTypes from 'prop-types';
import Select from 'react-select';
import { getProjects, getOrchestrations, getOrchestrationExecutions, previewReport } from 'utils/apiServices';

const PreviewReportModal = ({ show, onHide, reportTemplate, designTemplate, reportSections }) => {
  const [projectList, setProjectList] = useState([]);
  const [orchestrationList, setOrchestrationList] = useState([]);
  const [executionList, setExecutionList] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedOrchestration, setSelectedOrchestration] = useState(null);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [errors, setErrors] = useState({});
  const [previewContent, setPreviewContent] = useState('');

  const fetchProjects = async () => {
    try {
      const response = await getProjects();
      if (response.status === 200 && response.data) {
        setProjectList(
          response.data.data.map((project) => ({
            project_id: project.project_id,
            name: project.name
          }))
        );
      } else {
        console.error('Failed to fetch projects');
        setProjectList([]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchOrchestrations = async () => {
    try {
      if (!selectedProject) {
        setOrchestrationList([]);
        setExecutionList([]);
        return;
      }
      const response = await getOrchestrations(selectedProject.project_id);
      if (response.status === 200 && response.data) {
        setOrchestrationList(
          response.data.data.map((orch) => ({
            orchestration_id: orch.orchestration_id,
            name: orch.name
          }))
        );
      } else {
        console.error('Failed to fetch orchestrations');
        setOrchestrationList([]);
      }
    } catch (error) {
      console.error('Error fetching orchestrations:', error);
      setOrchestrationList([]);
    }
  };

  const fetchExecutions = async () => {
    try {
      if (!selectedOrchestration) {
        setExecutionList([]);
        return;
      }
      const response = await getOrchestrationExecutions(selectedOrchestration.orchestration_id);
      if (response.status === 200 && response.data) {
        setExecutionList(
          response.data.data.map((exec) => ({
            execution_id: exec.orchestration_execution_id,
            name: exec.orchestration_execution_id
          }))
        );
      } else {
        console.error('Failed to fetch executions');
        setExecutionList([]);
      }
    } catch (error) {
      console.error('Error fetching executions:', error);
      setExecutionList([]);
    }
  };

  useEffect(() => {
    fetchProjects();
    handlePreview();
  }, []);

  const handleChange = (field, value) => {
    if (field === 'project') {
      setSelectedProject(projectList.find((p) => p.project_id === value.value));
      fetchOrchestrations();
      setSelectedOrchestration(null);
      setSelectedExecution(null);
      setExecutionList([]);
    } else if (field === 'orchestration') {
      setSelectedOrchestration(orchestrationList.find((o) => o.orchestration_id === value.value));
      fetchExecutions();
      setSelectedExecution(null);
    } else if (field === 'execution') {
      setSelectedExecution(executionList.find((e) => e.execution_id === value.value));
    }

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handlePreview = async () => {
    // const newErrors = {};
    // if (!selectedProject) newErrors.project = 'Project is required';
    // if (!selectedOrchestration) newErrors.orchestration = 'Orchestration is required';
    // if (!selectedExecution) newErrors.execution = 'Execution ID is required';
    // if (Object.keys(newErrors).length > 0) {
    //   setErrors(newErrors);
    //   return;
    // }
    // setErrors({});
    try {
      const response = await previewReport({
        report_template_id: reportTemplate.id,
        design_template: { id: designTemplate.id, filepath: designTemplate.filepath },
        report_sections: reportSections.map((section) => section.id)
      });
      console.log(response);
      if (response.status === 200) {
        setPreviewContent(response.data);
      } else {
        setErrors({ message: 'Failed to preview report' });
        setPreviewContent('');
      }
    } catch (error) {
      setErrors({ message: 'Error previewing report: ' + error.message });
      setPreviewContent('');
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="xl" dialogClassName="custom-modal-size">
      <Modal.Header closeButton>
        <Modal.Title>Preview - {reportTemplate.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* <Row className="align-items-end g-3">
          <Col>
            <Form.Label className="fw-semibold">Projects</Form.Label>
            <Select
              options={projectList.map((project) => ({ value: project.project_id, label: project.name }))}
              value={{ value: selectedProject?.project_id, label: selectedProject?.name } || null}
              onChange={(option) => handleChange('project', option)}
              placeholder="Please Select"
              classNamePrefix="select"
              isInvalid={!!errors.project}
            />
            {errors.project && <div className="text-danger small mt-1">{errors.project}</div>}
          </Col>
          <Col>
            <Form.Label className="fw-semibold">Orchestrations</Form.Label>
            <Select
              options={orchestrationList.map((orch) => ({ value: orch.orchestration_id, label: orch.name }))}
              value={{ value: selectedOrchestration?.orchestration_id, label: selectedOrchestration?.name } || null}
              onChange={(option) => handleChange('orchestration', option)}
              classNamePrefix="select"
              isInvalid={!!errors.orchestration}
              placeholder="Please Select"
            />
            {errors.orchestration && <div className="text-danger small mt-1">{errors.orchestration}</div>}
          </Col>
          <Col>
            <Form.Label className="fw-semibold">Execution ID</Form.Label>
            <Select
              options={executionList.map((exec) => ({ value: exec.orchestration_execution_id, label: exec.name }))}
              value={{ value: selectedExecution?.execution_id, label: selectedExecution?.name } || null}
              onChange={(option) => handleChange('execution', option)}
              classNamePrefix="select"
              isInvalid={!!errors.execution}
              placeholder="Please Select"
            />
            {errors.execution && <div className="text-danger small mt-1">{errors.execution}</div>}
          </Col>
          <Col xs="auto">
            <Button variant="primary" onClick={handlePreview}>
              Preview
            </Button>
          </Col>
        </Row>

        <hr /> */}

        {/* to Preview Display */}
        {previewContent ? (
          <iframe srcDoc={previewContent} width="1080" height="480" />
        ) : (
          <div className="text-center text-muted mt-5">No Preview available</div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default PreviewReportModal;
