import React, { useState, useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import Spinner from 'react-bootstrap/Spinner';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Tab, Tabs } from 'react-bootstrap';
import { getStatusBadge } from 'data/listData';
import { useSelectedProject } from 'contexts/ProjectContext';
import Info from './Info';
import ConsoleLogs from './ConsoleLogs';
import ExecutionLogs from './ExecutionLogs';
import ExecutionTrend from './ExecutionTrend';
import OrchestrationFormModal from '../modals/OrchestrationFormModal';
import SuccessModal from 'views/shared-modals/SuccessModal';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import ProjectTestAgentSelectionModal from '../modals/ProjectTestAgentSelectionModal';
import OrchestrationActions from './OrchestrationActions';
import {
  getOrchestration,
  updateOrchestration,
  deleteOrchestration,
  startOrchestrationExecution,
  pauseOrchestrationExecution,
  stopOrchestrationExecution,
  getOrchestrationExecution,
  getLatestOrchestrationExecution
} from 'utils/apiServices';

const Details = () => {
  const navigate = useNavigate();
  const { orchestrationId } = useParams();

  const [orchestration, setOrchestration] = useState(null);
  const [latestExecution, setLatestExecution] = useState({});
  const { selectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;

  const [showAddNewOrchModal, setShowAddNewOrchModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successIconColor, setSuccessIconColor] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [orchestrationModalTitle, setOrchestrationModalTitle] = useState('');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  //get orchestration execution details
  const fetchLatestExecution = async (latestExecutionId) => {
    if (!orchestrationId) return;

    try {
      const response = await getLatestOrchestrationExecution(orchestrationId);
      if (response.status === 200) {
        setLatestExecution(response.data);
      }
    } catch (err) {
      console.error('Error while fetching orchestration details :', err);
    } finally {
    }
  };

  //get Orchestration details with orchestration id
  const fetchOrchestration = async () => {
    if (!orchestrationId) return;

    try {
      const response = await getOrchestration(orchestrationId);
      if (response.status === 200) {
        setOrchestration(response.data);
        fetchLatestExecution(response.data?.last_execution_id);
      }
    } catch (err) {
      console.error('Error while fetching orchestration details :', err);
    } finally {
    }
  };

  useEffect(() => {
    fetchOrchestration();
    const intervalId = setInterval(() => {
      fetchOrchestration();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [orchestrationId]);

  //to handle delete Orchestration (functional, UI, ...)
  const handleDeleteOrchestration = () => {
    setShowDeleteConfirmModal(true);
  };

  const handleAddOrchestration = () => {
    setOrchestrationModalTitle('Update Orchestration');
    setShowAddNewOrchModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddNewOrchModal(false);
  };

  // handling Orchestration edit case
  const handleSubmitOrchestration = async (data, selectedCases, suite) => {
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
      const response = await updateOrchestration(orchestrationId, payload);

      if (response.status === 200) {
        //show success message;
        setShowSuccessModal(true);
        const message = 'Orchestration has been updated successfully.';
        setSuccessMessage(message);
        setSuccessIconColor('#2EDAB6');
        await fetchOrchestration(); // to fetch the updated Orchestration details
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

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirmModal(false);
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

  // handling Orchestration delete
  const handleToDeleteOrchestration = async () => {
    try {
      const response = await deleteOrchestration(orchestration?.orchestration_id);

      if (response.status === 200) {
        handleSuccess(`Orchestration "${orchestration?.name}" has been deleted successfully`, '#FF5C5C');
        setShowDeleteConfirmModal(false);
        //navigate back to Orchestration List page
        navigate('/projects/orchestrations');
      } else {
        handleError('orchestration', new Error('Unexpected response status'));
      }
    } catch (error) {
      handleError('orchestration', error);
    }
  };

  //to pause execution
  const handlePauseExecution = async () => {
    try {
      const response = await pauseOrchestrationExecution(orchestration?.orchestration_id, {});
      if (response.status === 200) {
        handleSuccess('Execution of this Orchestration is paused.');
        await fetchOrchestration();
      } else {
        handleSuccess('Operation failed, Please try again later.', '#FF5C5C');
      }
    } catch (error) {
      console.error('Failed to pause orchestration:', error);
    }
  };

  //to stop execution
  const handleStopExecution = async () => {
    try {
      const response = await stopOrchestrationExecution(orchestration?.orchestration_id, {});
      if (response.status === 200) {
        handleSuccess('Execution of this Orchestration is stopped.');
        await fetchOrchestration();
      } else {
        handleSuccess('Operation failed, Please try again later.', '#FF5C5C');
      }
    } catch (error) {
      console.error('Failed to stop orchestration:', error);
    }
  };

  const togglePlayState = () => {
    setShowAgentModal(true); // show modal only if not already a playing state
  };

  //to execute play
  const handleSelectAgentExecution = async (selectedAgents = []) => {
    try {
      setIsLoading(true);
      const payload = {
        test_agents: selectedAgents
      };

      const response = await startOrchestrationExecution(orchestration?.orchestration_id, payload);

      if (response.status === 200) {
        handleSuccess('Execution of Orchestration started successfully.');
        setShowAgentModal(false);
        await fetchOrchestration();
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

  return (
    <div className="container-fluid p-1 container-root">
      {isLoading && (
        <div className="spinner-overlay">
          <Spinner animation="border" variant="primary" role="status" />
        </div>
      )}

      <div className="mb-4">
        <div className="sticky-Header">
          <h4 className="mb-0 page-title">
            <span className="text-primary">Projects</span>
            <span className="text-muted">
              {' '}
              / <FormattedMessage id="orchestrations" />
            </span>
          </h4>
        </div>

        {/* Orchestration Name and status */}
        <Row className="align-items-center mt-3">
          <Col className="d-flex align-items-center">
            <h5 className="fw-semibold mb-0 me-1 project-title">{orchestration?.name}</h5>
            <div className="spacer" />
            {getStatusBadge(orchestration?.status)}
          </Col>

          <Col>
            {/** to show play, edit delete icons*/}
            <OrchestrationActions
              status={orchestration?.status}
              orchestrationId={orchestration?.orchestration_id}
              onPlay={togglePlayState}
              onPause={handlePauseExecution}
              onStop={handleStopExecution}
              onEdit={handleAddOrchestration}
              onDelete={handleDeleteOrchestration}
            />
          </Col>
        </Row>
      </div>

      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <Tabs variant="tabs" defaultActiveKey="details" className="mb-4">
          <Tab eventKey="details" title="Details">
            <Info orchestrationDetails={orchestration} />
          </Tab>
          <Tab eventKey="consoleLogs" title="Console Logs">
            <ConsoleLogs orchestrationExecution={latestExecution} />
          </Tab>
          <Tab eventKey="executionLogs" title="Execution Reports">
            <ExecutionLogs orchestrationExecution={latestExecution} />
          </Tab>
          <Tab eventKey="analysis" title="Execution Trend">
            <ExecutionTrend orchestrationDetails={orchestration} />
          </Tab>
        </Tabs>
      </div>

      <OrchestrationFormModal
        show={showAddNewOrchModal}
        onClose={handleCloseAddModal}
        onSubmit={handleSubmitOrchestration}
        modalTitle={orchestrationModalTitle}
        editOrchestrationId={orchestrationId}
      />
      <SuccessModal
        show={showSuccessModal}
        onHide={() => setShowSuccessModal(false)}
        message={successMessage}
        iconColor={successIconColor}
      />
      <ConfirmDeleteModal
        show={showDeleteConfirmModal}
        onHide={handleCloseDeleteModal}
        onSubmit={handleToDeleteOrchestration}
        toDelete={orchestration?.name}
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

export default Details;
