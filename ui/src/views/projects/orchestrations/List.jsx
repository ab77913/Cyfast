import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col, Form, Button, ProgressBar, Dropdown, DropdownButton, ButtonGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { getStatusBadge, sortOptions } from 'data/listData';
import { FormattedMessage } from 'react-intl';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import SuccessModal from 'views/shared-modals/SuccessModal';
import ProjectHeader from '../ProjectHeader';
import { useSelectedProject } from 'contexts/ProjectContext';
import Spinner from 'react-bootstrap/Spinner';
import {
  getOrchestrations,
  createOrchestration,
  updateOrchestration,
  deleteOrchestration,
  getProjectById,
  startOrchestrationExecution,
  pauseOrchestrationExecution,
  stopOrchestrationExecution,
  generateReport
} from 'utils/apiServices';
import OrchestrationModalWizard from '../modals/OrchestrationFormModal';
import ProjectTestAgentSelectionModal from '../modals/ProjectTestAgentSelectionModal';
import OrchestrationActions from './OrchestrationActions';

const Orchestrations = () => {
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState(null); // Item name or type
  const [deleteContext, setDeleteContext] = useState(''); // 'entire project' or 'orchestration'
  //const [playStates, setPlayStates] = useState({});
  const [orchestrationStates, setOrchestrationStates] = useState({});
  const [showAddNewOrchModal, setShowAddNewOrchModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successIconColor, setSuccessIconColor] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [orchestrationModalTitle, setOrchestrationModalTitle] = useState('Add New Orchestration');
  const [editingOrchestrationId, setEditingOrchestrationId] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [orchestrations, setOrchestrations] = useState([]);
  const [selectedProject, setSelectedProject] = useState({});
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [currentOrchestrationId, setCurrentOrchestrationId] = useState(null);

  const [sortBy, setSortBy] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { selectedProjectInContext, setSelectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;
  const navigate = useNavigate();

  // getOrchestrations api call
  const fetchOrchestrationsList = async () => {
    try {
      setIsLoading(true);
      const response = await getOrchestrations(project.project_id);
      if (response.status === 200) {
        setOrchestrations(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching Orchestrations list :', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrchestrationsList();
  }, []);

  const InfoMessage = ({ message }) => <div className="alert alert-info text-center my-3">{message}</div>;

  // to Filter the orchestrations list
  const filteredOrchestrations = useMemo(() => {
    return orchestrations.filter((item) => {
      const status = item?.status?.trim().toUpperCase() || '';
      const selected = sortBy?.value?.trim().toUpperCase() || '';
      const matchesStatus = !selected || status === selected;
      const matchesSearch = item?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [orchestrations, sortBy, searchTerm]);

  const togglePlayState = (orchestration_id) => {
    setCurrentOrchestrationId(orchestration_id);
    setShowAgentModal(true); // show modal only if not already a playing state
  };

  //to handle delete a Orchestration (functional, UI, ...)
  const handleDeleteOrchestrationsTestAction = (item) => {
    setSelectedItemType({ name: item.name, id: item.orchestration_id });
    setDeleteContext('orchestration');
    setShowDeleteConfirmModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirmModal(false);
    setSelectedItemType(null);
    setDeleteContext('');
  };

  const handleError = (context, error) => {
    console.error(`Error deleting ${context}:`, error);
  };

  const handleSuccess = (message, iconColor = '#2EDAB6') => {
    setSuccessMessage(message);
    setSuccessIconColor(iconColor);
    setShowSuccessModal(true);

    setTimeout(() => {
      setShowSuccessModal(false);
    }, 2000);
  };

  const handleToDeleteAOrchestration = async () => {
    const orchestrationId = selectedItemType?.id;
    const orchestrationName = selectedItemType?.name;

    try {
      const response = await deleteOrchestration(orchestrationId);

      if (response.status === 200) {
        handleSuccess(`Orchestration "${orchestrationName}" has been deleted successfully`, '#FF5C5C');

        setSelectedItemType(null);
        setDeleteContext('');
        setShowDeleteConfirmModal(false);

        await fetchOrchestrationsList(); // Refresh orchestration list
      } else {
        handleError('orchestration', new Error('Unexpected response status'));
      }
    } catch (error) {
      handleError('orchestration', error);
    }
  };

  const handleSubmitDelete = async () => {
    if (deleteContext === 'orchestration') {
      await handleToDeleteAOrchestration();
    } else {
      console.warn('Delete context is not set or invalid.');
    }
  };

  const handleAddOrchestration = (mode, orchestrationId = null) => {
    setSuccessMessage('');
    setSuccessIconColor('');
    setOrchestrationModalTitle(mode === 'add' ? 'Add New Orchestration' : 'Update Orchestration');
    if (mode === 'edit' && orchestrationId) {
      setEditingOrchestrationId(orchestrationId);
    } else {
      setEditingOrchestrationId(null);
    }
    setShowAddNewOrchModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddNewOrchModal(false);
    setEditingOrchestrationId(null);
  };

  const handleSubmitAddOrchestration = async (data, selectedCases, suite) => {
    setIsLoading(true);
    const payload = {
      name: data.orchestrationName,
      version: '1.0.1',
      project_id: String(project?.project_id),
      organization_id: 1,
      configuration: {
        execution_base: data.executionBase === 'testCase' ? 'TEST_CASE' : 'TEST_SCRIPT',
        continue_on_error: data.onError === 'continue' ? 1 : 0,
        run_order: data.runType.toUpperCase().replace(/SEQUENTIALDEPENDENCY/, 'SEQUENTIAL_DEPENDENCY'),
        trigger_criteria: data.triggerCriteria
          .toUpperCase()
          .replace(/ONDEMAND/, 'ON_DEMAND')
          .replace(/ONEVENT/, 'ON_EVENT'),
        scheduled_start_time: '',
        scheduled_run_time: '',
        repeat_interval_unit: '',
        repeat_interval_value: ''
      },
      //selected test cases array
      test_cases: selectedCases.map((tc, idx) => ({
        test_script_id: tc.scriptId,
        test_case_id: tc.test_case_id,
        execution_order: idx + 1
      })),
      ...(suite ? { suite } : {}) //selected test suite
    };
    try {
      const response = editingOrchestrationId
        ? await updateOrchestration(editingOrchestrationId, payload)
        : await createOrchestration(payload); //api call

      if (response.status === 200) {
        //show success message;
        setShowSuccessModal(true);
        const message = editingOrchestrationId
          ? 'Orchestration has been updated successfully.'
          : 'Orchestration has been added successfully.';
        setSuccessMessage(message);
        setSuccessIconColor('#2EDAB6');
        await fetchOrchestrationsList(); // to get the updated Orchestration lsit
        setEditingOrchestrationId(null);
      } else {
        setShowSuccessModal(true);
        setSuccessMessage('Failed to create Orchestration.');
        setSuccessIconColor('#DC3545');
      }
    } catch (err) {
      console.error('Error creating orchestration:', err);
    } finally {
      setIsLoading(false);
      setShowAddNewOrchModal(false);
      setTimeout(() => setShowSuccessModal(false), 2000);
    }
  };

  //date format
  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDateWithSeparator = (isoString) => {
    if (!isoString) return '';
    const [date, time] = isoString.split('T');
    return `${date} | T${time}`;
  };

  //to execute play
  const handleSelectAgentExecution = async (selectedAgents = []) => {
    try {
      setIsLoading(true);
      const payload = {
        test_agents: selectedAgents
      };

      const response = await startOrchestrationExecution(currentOrchestrationId, payload);

      if (response.status === 200) {
        handleSuccess('Execution of Orchestration started successfully.');
        setOrchestrationStates((prev) => ({
          ...prev,
          [currentOrchestrationId]: 'Queued' // mving  orchestration to "queued" state
        }));
        setShowAgentModal(false);
        await fetchOrchestrationsList();
      } else {
        handleSuccess('Failed to start orchestration.', '#FF5C5C');
      }
    } catch (error) {
      console.error('Execution error:', error);
      handleSuccess('Execution failed, Please try again later.', '#FF5C5C');
    } finally {
      setIsLoading(false);
    }
  };

  //to pause execution
  const handlePauseExecution = async (orchestration_id) => {
    try {
      const response = await pauseOrchestrationExecution(orchestration_id, {});
      if (response.status === 200) {
        handleSuccess('Execution of this Orchestration is paused.');
        await fetchOrchestrationsList();
      } else {
        handleSuccess('Operation failed, Please try again later.', '#FF5C5C');
      }
    } catch (error) {
      console.error('Failed to pause orchestration:', error);
    }
  };

  //to stop execution
  const handleStopExecution = async (orchestration_id) => {
    try {
      const response = await stopOrchestrationExecution(orchestration_id, {});
      if (response.status === 200) {
        handleSuccess('Execution of this Orchestration is stopped.');
        await fetchOrchestrationsList();
      } else {
        handleSuccess('Operation failed, Please try again later.', '#FF5C5C');
      }
    } catch (error) {
      console.error('Failed to stop orchestration:', error);
    }
  };

  const downloadReport = async (reportType, projectId, orchestrationId, executionId) => {
    let filters = {};
    if (projectId) filters.project_id = projectId;
    if (orchestrationId) filters.orchestration_id = orchestrationId;
    if (executionId) filters.execution_id = executionId;

    const response = await generateReport(null, reportType, filters);
    if (response.status === 200 && response.data) {
      let fileName = reportType;
      if (executionId) fileName += `_${executionId}`;
      else if (orchestrationId) fileName += `_${orchestrationId}`;
      else if (projectId) fileName += `_${projectId}`;
      fileName += `_${Date.now()}.pdf`;

      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      console.error('Failed to download report - ' + reportTemplate.name);
    }
  };

  return (
    <div className="container-fluid p-1 container-root">
      {isLoading && (
        <div className="spinner-overlay">
          <Spinner animation="border" variant="primary" role="status"></Spinner>
        </div>
      )}

      <ProjectHeader project={project} breadcrumbs="orchestrations" />

      {/* Container Row with white background */}
      <div className="bg-white p-4 rounded shadow-sm mb-4">
        {/* Title */}
        <div className="section-title">
          {' '}
          <FormattedMessage id="orchestrations" />
        </div>

        <Row className="align-items-center mb-3">
          <Col md="auto" className="d-flex align-items-center">
            <label className="form-label fw-semibold mb-0 me-2 status">Status</label>
            <div className="select-wrapper">
              <Select
                classNamePrefix="select"
                name="sort"
                options={sortOptions}
                value={sortBy}
                onChange={(selectedOption) => setSortBy(selectedOption)}
                placeholder="All"
                menuPortalTarget={document.body}
              />
            </div>
          </Col>

          {/* Search Field */}
          <Col md={4} className="d-flex align-items-center ms-4">
            <div className="input-group">
              <Form.Control
                type="search"
                placeholder="Search Orchestration"
                value={searchTerm}
                className="search-input"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="input-group-text bg-white">
                <i className="feather icon-search light-icon" />
              </span>
            </div>
          </Col>

          {/* Add Button */}
          <Col className="text-end d-flex justify-content-end align-items-center">
            <Button variant="primary" onClick={() => handleAddOrchestration('add')}>
              <i className="feather icon-plus" /> Add Orchestration
            </Button>
          </Col>
        </Row>

        {/* Orchestration list */}
        <div className="scroll-container">
          {!isLoading && orchestrations.length === 0 && <InfoMessage message="No Orchestrations found for the selected project." />}

          {filteredOrchestrations.map((item, index) => (
            <div key={index} className="orchestration-card">
              {/* Header Section */}
              <div className="card-header">
                <Row className="align-items-center">
                  <Col md={3}>
                    <h6 className="fw-bold mb-0">
                      <span
                        className="clickable-orchestration-name"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/projects/orchestrations/details/${item.orchestration_id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            navigate(`/projects/orchestrations/details/${item.orchestration_id}`);
                          }
                        }}
                      >
                        {item.name}
                      </span>
                    </h6>
                  </Col>

                  <Col md={2}>
                    <div className="text-muted medium fw-semibold">{formatDateTime(item.created_date)}</div>
                  </Col>

                  <Col md={2}>{getStatusBadge(item.status)}</Col>

                  <Col md={2} className="d-flex justify-content-center align-items-center">
                    <div className="progress-wrapper">
                      <ProgressBar
                        now={item.completion_percentage ?? ''}
                        label={`${item.completion_percentage ?? ''}%`}
                        className="custom-progress-bar"
                      />
                    </div>
                  </Col>

                  {/**displaying play, pause, stop, edit and delete icons */}
                  <Col md={3} className="text-end">
                    <OrchestrationActions
                      status={item.status}
                      orchestrationId={item.orchestration_id}
                      onPlay={() => togglePlayState(item.orchestration_id)}
                      onPause={() => handlePauseExecution(item.orchestration_id)}
                      onStop={() => handleStopExecution(item.orchestration_id)}
                      onEdit={() => handleAddOrchestration('edit', item.orchestration_id)}
                      onDelete={() => handleDeleteOrchestrationsTestAction(item)}
                    />
                  </Col>
                </Row>
              </div>

              {/* Detail Section */}
              <div className="card-body">
                <Row className="align-items-center">
                  <Col md={3} className="text-start">
                    <div>
                      <div className="text-label">START DATE</div>
                      <div className="text-value">{formatDateWithSeparator(item.created_date)}</div>
                    </div>
                    <div className="mt-2">
                      <div className="text-label">END DATE</div>
                      <div className="text-value">{formatDateWithSeparator(item.created_date)}</div>
                    </div>
                  </Col>

                  <Col md={3} className="text-start">
                    <div>
                      <div className="text-label">LAST RUN</div>
                      <div className="text-value">{formatDateWithSeparator(item.modified_date)}</div>
                    </div>
                    <div className="mt-2">
                      <div className="text-label">EXECUTION TIME(HH:MM:SS)</div>
                      <div className="text-value">{item.modified_date}</div>
                    </div>
                  </Col>

                  <Col md={3} className="text-start">
                    <div>
                      <div className="text-label">TESTS</div>
                      {/* <div className="text-value">{renderTestsValues(item.tests)}</div> */}
                    </div>
                    <div className="mt-2">
                      <div className="text-label">SCHEDULED AT</div>
                      <div className="text-value">{formatDateWithSeparator(item.modified_date)}</div>
                    </div>
                  </Col>

                  <Col md={3} className="text-end">
                    <div>
                      <DropdownButton
                        as={ButtonGroup}
                        title={
                          <>
                            <i className="feather icon-download me-1" /> Downloads
                          </>
                        }
                        variant="outline-primary"
                        size="sm"
                        id="dropdown-custom-download"
                        className="text-capitalize custom-outline-button"
                      >
                        <Dropdown.Item eventKey="1">
                          <div
                            onClick={() => downloadReport('ORCHESTRATION_TEST_SUMMARY', project.project_id, item.orchestration_id, null)}
                          >
                            Orchestration Summary
                          </div>
                        </Dropdown.Item>
                        <Dropdown.Item eventKey="2">
                          <div
                            onClick={() => downloadReport('ORCHESTRATION_EXECUTION_LOG', project.project_id, item.orchestration_id, null)}
                          >
                            Execution Log
                          </div>
                        </Dropdown.Item>
                        <Dropdown.Item eventKey="3">
                          <div onClick={() => downloadReport('CONSOLE_LOG', project.project_id, item.orchestration_id, null)}>
                            Console Log
                          </div>
                        </Dropdown.Item>
                      </DropdownButton>
                    </div>
                  </Col>
                </Row>
              </div>
            </div>
          ))}
        </div>
        <ConfirmDeleteModal
          show={showDeleteConfirmModal}
          onHide={handleCloseDeleteModal}
          onSubmit={handleSubmitDelete}
          toDelete={selectedItemType?.name}
        />
        {/* showSuccessModal -for all cases */}
        <SuccessModal
          show={showSuccessModal}
          onHide={() => setShowSuccessModal(false)}
          message={successMessage}
          iconColor={successIconColor}
        />
      </div>
      <OrchestrationModalWizard
        show={showAddNewOrchModal}
        onClose={handleCloseAddModal}
        onSubmit={handleSubmitAddOrchestration}
        modalTitle={orchestrationModalTitle}
        editOrchestrationId={editingOrchestrationId}
      />

      <ProjectTestAgentSelectionModal
        show={showAgentModal}
        onHide={() => setShowAgentModal(false)}
        onExecuteButton={handleSelectAgentExecution}
        multiSelect={true}
      />
    </div>
  );
};

export default Orchestrations;
