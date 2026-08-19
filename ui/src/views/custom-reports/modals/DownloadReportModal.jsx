import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import { getProjects, getOrchestrations, getOrchestrationExecutions, previewReport, generateReport } from 'utils/apiServices';

const DownloadReportModal = ({ show, onHide, reportTemplate }) => {
  const [projectList, setProjectList] = useState([]);
  const [orchestrationList, setOrchestrationList] = useState([]);
  const [executionList, setExecutionList] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedOrchestration, setSelectedOrchestration] = useState(null);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [errors, setErrors] = useState({});

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

  const fetchOrchestrations = async (projectId) => {
    try {
      const response = await getOrchestrations(projectId);
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

  const fetchExecutions = async (orchestrationId) => {
    try {
      if (!selectedOrchestration) {
        setExecutionList([]);
        return;
      }
      const response = await getOrchestrationExecutions(orchestrationId);
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
  }, []);

  const handleChange = (field, value) => {
    console.log(field, value);
    if (field === 'project') {
      setSelectedProject({ project_id: value.value, name: value.label });
      fetchOrchestrations(value.value);
      setSelectedOrchestration(null);
      setSelectedExecution(null);
      setExecutionList([]);
    } else if (field === 'orchestration') {
      setSelectedOrchestration({ orchestration_id_id: value.value, name: value.label });
      fetchExecutions(value.value);
      setSelectedExecution(null);
    } else if (field === 'execution') {
      setSelectedExecution({ orchestration_execution_id: value.value, name: value.label });
    }

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleDownload = async () => {
    const newErrors = {};
    if (!selectedProject) newErrors.project = 'Project is required';
    if (!selectedOrchestration && reportTemplate.report_type == 'ORCHESTRATION_TEST_SUMMARY')
      newErrors.orchestration = 'Orchestration is required';
    if (!selectedExecution && (reportTemplate.report_type == 'CONSOLE_LOG' || reportTemplate.report_type == 'ORCHESTRATION_TEST_SUMMARY'))
      newErrors.execution = 'Execution ID is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    let filters = {};
    switch (reportTemplate.report_type) {
      case 'TEST_SUMMARY':
        filters = { project_id: selectedProject.project_id };
        break;
      case 'ORCHESTRATION_TEST_SUMMARY':
        filters = { orchestration_id: selectedOrchestration.orchestration_id };
        break;
      case 'CONSOLE_LOG':
      case 'ORCHESTRATION_EXECUTION_LOG':
        filters = {
          orchestration_id: selectedOrchestration.orchestration_id,
          orchestration_execution_id: selectedExecution?.orchestration_execution_id
        };
        break;
      default:
        break;
    }
    const response = await generateReport(reportTemplate.id, filters);
    if (response.status === 200 && response.data) {
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = reportTemplate.report_type + '_' + Date.now() + '.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      console.error('Failed to download report - ' + reportTemplate.name);
    }
  };

  return (
    <Modal size="md" centered show={show} onHide={onHide}>
      <Modal.Header>
        <Modal.Title as="h5">{reportTemplate.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
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
          </Form.Group>
          <Form.Group className="mb-3">
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
          </Form.Group>
          <Form.Group className="mb-3">
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
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onHide} variant="outline-secondary">
          Cancel
        </Button>
        <Button onClick={handleDownload} className="primary">
          Download
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DownloadReportModal;
