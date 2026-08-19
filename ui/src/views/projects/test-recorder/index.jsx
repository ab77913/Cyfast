import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Form, Button, Table, Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import SuccessModal from 'views/shared-modals/SuccessModal';
import ProjectHeader from '../ProjectHeader';
import { useSelectedProject } from 'contexts/ProjectContext';
import {
  addTestSource,
  getTestSourcesForProject,
  updateTestSourcesForProject,
  importTestCasesByTestSourceIdAndTestAgentId,
  getTestCases
} from 'utils/apiServices';
import Spinner from 'react-bootstrap/Spinner';
import ProjectTestAgentSelectionModal from '../modals/ProjectTestAgentSelectionModal';
import TestSourceModal from '../modals/TestSourceModal';

const TestCases = () => {
  const [selectedItemType, setSelectedItemType] = useState(null); // for test cases or type
  const [deleteContext, setDeleteContext] = useState(''); // 'entire project'
  const [showTestCaseImportModal, setTestCaseImportModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testSource, setTestSource] = useState({});

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [successIconColor, setSuccessIconColor] = useState('');
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [testCases, setTestCases] = useState([]);
  const [infoMessage, setInfoMessage] = useState('');
  const editButtonRef = useRef(null);

  const { selectedProjectInContext, setSelectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;

  // Confirm whether the selected project already has a Test Source added
  const fetchSources = async () => {
    setIsLoading(true);
    try {
      const response = await getTestSourcesForProject(project.project_id);
      const sources = response.data?.data;
      if (sources?.length > 0) {
        const testSource = sources[0];
        setTestSource(testSource);
      } else {
        setTestSource({});
      }
    } catch (error) {
      console.error('Error fetching test sources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!project) return;

    if (project?.project_id) fetchSources();
  }, [project]);

  const fetchTestCases = async () => {
    if (!project?.project_id) return;
    setIsLoading(true);
    try {
      const response = await getTestCases({ project_id: project?.project_id });
      const fetchedTestCases = response.data?.data || [];
      setTestCases(fetchedTestCases);
    } catch (error) {
      console.error('Failed to fetch test cases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  //load Test cases
  useEffect(() => {
    if (!project?.project_id) return;
    fetchTestCases();

    const intervalId = setInterval(() => {
      fetchTestCases();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [project?.project_id]);

  const filteredTestCases = testCases.filter((tc) => {
    return (
      (tc.test_case_no?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (tc.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  });

  const showInfoMessage = (message) => {
    setInfoMessage(message);
    setTimeout(() => setInfoMessage(''), 3000);
  };

  const handleDeleteTestCaseAction = (testCase) => {
    setSelectedItemType(testCase);
    setDeleteContext('testcase');
    //setShowDeleteConfirmModal(true);
    showInfoMessage('Feature temporarily unavailable.');
  };

  const handleEditTestCaseAction = (testCase) => {
    setSelectedItemType(testCase);
    showInfoMessage('Feature temporarily unavailable.');
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

  const handleToDeleteATestCase = async () => {
    const testCaseId = selectedItemType?.id;
    const testCaseName = selectedItemType?.name;
    handleSuccess(`Test Case "${testCaseName}" has been deleted successfully`, '#FF5C5C');
    setSelectedItemType(null);
    setDeleteContext('');
    setShowDeleteConfirmModal(false);
    // try {
    //   const response = await deleteATestCase(testCaseId);
    //   if (response.status === 200) {
    //     handleSuccess(`Test Case "${testCaseName}" has been deleted successfully`, '#FF5C5C');
    //     setSelectedItemType(null);
    //     setDeleteContext('');
    //     setShowDeleteConfirmModal(false);
    //     await fetchTestCaseList(); // Refresh Test Case list
    //   } else {
    //     handleError('test case', new Error('Unexpected response status'));
    //   }
    // } catch (error) {
    //   handleError('test case', error);
    // }
  };

  const handleAddTestSourceModal = () => {
    setTestCaseImportModal(true);
  };
  const handleCloseImportModal = () => {
    setTestCaseImportModal(false);
  };

  const handleAddOrEditSource = async (payload, test_source_id) => {
    try {
      setIsLoading(true);
      setLastPayload(payload);
      let response;
      if (test_source_id) {
        // Edit/update source operation
        response = await updateTestSourcesForProject(test_source_id, payload);
      } else {
        // Add source operation
        response = await addTestSource(payload);
      }
      if (response.status === 200) {
        fetchSources();
      }
    } catch (error) {
      console.error('Error adding test source:', error);
    } finally {
      setIsLoading(false);
      handleCloseImportModal();
    }
  };

  const handleImportTestCases = async () => {
    setShowAgentModal(true);
  };

  const handleSelectAgentExecution = async (selected_test_agent) => {
    const testAgent = selected_test_agent[0];

    try {
      setIsLoading(true);
      const response = await importTestCasesByTestSourceIdAndTestAgentId(testSource?.test_source_id, testAgent?.test_agent_id);

      if (response?.data === true && response?.status === 200) {
        handleSuccess('Test cases were successfully imported and executed.');
        setShowAgentModal(false);
      } else {
        handleSuccess('Execution failed. Please try again.', '#FF5C5C');
      }
    } catch (error) {
      console.error('Error importing test cases ', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container-fluid p-1 container-root">
      {/* Header */}
      <ProjectHeader project={project} breadcrumbs="test-recorder" />

      {isLoading && (
        <div className="spinner-overlay">
          <Spinner animation="border" variant="primary" role="status"></Spinner>
        </div>
      )}

      {infoMessage && <div className="alert alert-warning toast-notification">{infoMessage}</div>}

      {/* Table Card */}
      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="section-title">
          <FormattedMessage id="test-recorder" />
        </div>

        <Row className="align-items-center mb-3">
          <Col className="d-flex align-items-center">
            <Dropdown className="me-2">
              <Dropdown.Toggle variant="outline-secondary" className="btn-sm">
                File
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => console.log('New clicked')}>New</Dropdown.Item>
                <Dropdown.Item onClick={() => console.log('Open clicked')}>Open</Dropdown.Item>
                <Dropdown.Item onClick={() => console.log('Save clicked')}>Save</Dropdown.Item>
                <Dropdown.Item onClick={() => console.log('Save As clicked')}>Save As</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Col>
          {/* Buttons */}
          <Col className="text-end d-flex justify-content-end align-items-center">
            <Button variant="outline-secondary" className="btn-sm me-3" onClick={() => console.log('Refresh clicked')}>
              Configure
            </Button>
            <Button variant="outline-danger" className="btn-sm me-3" onClick={() => console.log('Refresh clicked')}>
              Record
            </Button>
            <Button variant="primary" className="btn-sm me-2" disabled={!testSource}>
              Execute
            </Button>
          </Col>
        </Row>
        <hr />
        <div>
          <p className="p-5 text-center bg-light">Under Development - Coming Soon!</p>
        </div>

        {/* showSuccessModal */}
        <SuccessModal
          show={showSuccessModal}
          onHide={() => setShowSuccessModal(false)}
          message={successMessage}
          iconColor={successIconColor}
        />
      </div>
      <TestSourceModal
        show={showTestCaseImportModal}
        onClose={handleCloseImportModal}
        onSubmit={handleAddOrEditSource}
        testSource={testSource}
      />
      <ProjectTestAgentSelectionModal
        show={showAgentModal}
        onHide={() => setShowAgentModal(false)}
        onExecuteButton={handleSelectAgentExecution}
      />
    </div>
  );
};

export default TestCases;
