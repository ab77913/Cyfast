import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Row, Col, Form, Button, Table, Tabs, Tab } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import { getStatusBadge, sortOptions } from 'data/listData';
import SuccessModal from 'views/shared-modals/SuccessModal';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import ProjectHeader from '../ProjectHeader';
import { useSelectedProject } from 'contexts/ProjectContext';
import {
  addTestSource,
  getTestSourcesForProject,
  updateTestSourcesForProject,
  importTestCasesByTestSourceIdAndTestAgentId,
  getTestCases,
  startTestCaseExecution,
  stopTestCaseExecution,
  deleteTestCase
} from 'utils/apiServices';
import Spinner from 'react-bootstrap/Spinner';
import ProjectTestAgentSelectionModal from '../modals/ProjectTestAgentSelectionModal';
import TestCaseActions from './TestCaseActions';
import TestSourceModal from '../modals/TestSourceModal';
import ListPagination from 'views/shared/ListPagination';
import GenerateTab from './GenerateTab';
import PendingTab from './PendingTab';

const DEFAULT_PAGE_SIZE = 25;

const TestCases = () => {
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
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
  const [currentAgentAction, setCurrentAgentAction] = useState(''); // to identify whether the agent selection is for play or import action
  const [currentTestCaseId, setCurrentTestCaseId] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [testCaseStates, setTestCaseStates] = useState({});
  const [infoMessage, setInfoMessage] = useState('');
  const [mainTab, setMainTab] = useState('active');
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0);
  const [activeRefreshToken, setActiveRefreshToken] = useState(0);
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

  const fetchTestCases = useCallback(async (silent = false) => {
    if (!project?.project_id) return;
    if (!silent) setIsLoading(true);
    try {
      const response = await getTestCases(
        { project_id: project?.project_id },
        { page: listPage, size: pageSize }
      );
      const fetchedTestCases = response.data?.data || [];
      setTestCases(fetchedTestCases);
      setPagination(response.data?.pagination || null);
    } catch (error) {
      console.error('Failed to fetch test cases:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [project?.project_id, listPage, pageSize, activeRefreshToken]);

  useLayoutEffect(() => {
    setListPage(1);
  }, [project?.project_id]);

  useEffect(() => {
    if (!project?.project_id || mainTab !== 'active') return;
    fetchTestCases();

    const intervalId = setInterval(() => {
      fetchTestCases(true);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [project?.project_id, fetchTestCases, mainTab]);

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

  const togglePlayState = (test_case_id) => {
    setCurrentTestCaseId(test_case_id);
    setCurrentAgentAction('play');
    setShowAgentModal(true); // show modal only if not already a playing state
  };

  //to stop execution
  const handleStopExecution = async (test_case_id) => {
    try {
      const response = await stopTestCaseExecution(test_case_id);
      if (response.status === 200) {
        handleSuccess('Execution of this Test Case is stopped.');
        await fetchTestCases();
      } else {
        handleSuccess('Operation failed, Please try again later.', '#FF5C5C');
      }
    } catch (error) {
      console.error('Failed to stop test case execution:', error);
    }
  };

  const handleEditTestCase = (testCase) => {
    setSelectedItemType({ name: testCase.test_case_name, id: testCase.test_case_id });
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

    try {
      const response = await deleteTestCase(testCaseId);

      if (response.status === 200) {
        handleSuccess(`Test Case "${testCaseName}" has been deleted successfully`, '#FF5C5C');

        setSelectedItemType(null);
        setDeleteContext('');
        setShowDeleteConfirmModal(false);

        await fetchTestCases(); // Refresh test cases list
      } else {
        handleError('testcase', new Error('Unexpected response status'));
      }
    } catch (error) {
      handleError('testcase', error);
    }
  };

  const handleSubmitDelete = async () => {
    if (deleteContext === 'testcase') {
      await handleToDeleteATestCase();
    } else {
      console.warn('Delete context is not set or invalid.');
    }
  };

  const handleDeleteTestCase = (item) => {
    setSelectedItemType({ name: item.test_case_name, id: item.test_case_id });
    setDeleteContext('testcase');
    setShowDeleteConfirmModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirmModal(false);
    setSelectedItemType(null);
    setDeleteContext('');
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

      payload.project_id = project.project_id;
      let response;
      console.log('test_source_id', test_source_id);
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
    setCurrentAgentAction('import');
    setShowAgentModal(true);
  };

  const handleSelectAgentExecution = async (selected_test_agent) => {
    const testAgent = selected_test_agent[0];

    try {
      if (!testSource || !testAgent) {
        handleSuccess('Please select a Test Agent to proceed.', '#FF5C5C');
        return;
      }

      if (currentAgentAction === 'import') {
        setIsLoading(true);
        const response = await importTestCasesByTestSourceIdAndTestAgentId(testSource?.test_source_id, testAgent?.test_agent_id);

        if (response?.data === true && response?.status === 200) {
          handleSuccess('Test cases were successfully imported and executed.');
          setShowAgentModal(false);
        } else {
          handleSuccess('Import failed. Please try again.', '#FF5C5C');
        }
      } else if (currentAgentAction === 'play') {
        const response = await startTestCaseExecution(currentTestCaseId, testAgent);

        if (response.status === 200) {
          handleSuccess('Execution of Test Case started successfully.');
          setTestCaseStates((prev) => ({
            ...prev,
            [currentTestCaseId]: 'Queued' // moving test case to "queued" state
          }));
          setShowAgentModal(false);
          await fetchTestCases();
        } else {
          handleSuccess('Failed to start Test Case execution.', '#FF5C5C');
        }
      }
    } catch (error) {
      console.error('Error occured. ', error);
    } finally {
      setIsLoading(false);
    }
  };

  const activeTabContent = (
    <>
      <Row className="align-items-center mb-3">
        <Col md={4} className="d-flex align-items-center">
          <div className="input-group">
            <Form.Control
              type="search"
              placeholder="Search Test Case by No. or Name"
              value={searchTerm}
              className="search-input"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="input-group-text bg-white">
              <i className="feather icon-search light-icon" />
            </span>
          </div>
        </Col>
      </Row>
      <hr />
      <Row className="align-items-center mb-3">
        <Col className="d-flex align-items-center">
          {testSource && Object.keys(testSource).length > 0 && (
            <div className="d-flex align-items-center">
              <span className="fw-bold project-type">
                <b>Source :</b> {testSource.source_name} - &nbsp;
              </span>
              <span className="project-type text-primary">
                {testSource.source_type === 'REPOSITORY' ? testSource.repository_server_url : testSource.source_path}
              </span>
            </div>
          )}
        </Col>
        <Col className="text-end d-flex justify-content-end align-items-center">
          {testSource && Object.keys(testSource).length > 0 ? (
            <>
              <Button
                ref={editButtonRef}
                variant="outline-primary"
                className="btn-sm me-2 custom-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddTestSourceModal();
                  editButtonRef.current?.blur();
                }}
              >
                Edit
              </Button>

              <Button
                variant="primary"
                className="btn-sm me-2"
                disabled={!testSource}
                onClick={(e) => {
                  e.stopPropagation();
                  handleImportTestCases();
                }}
              >
                Import Test Cases
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              className="btn-sm me-3"
              onClick={(e) => {
                e.stopPropagation();
                handleAddTestSourceModal();
              }}
            >
              Add Test Source
            </Button>
          )}
        </Col>
      </Row>

      <div className="scroll-container">
        <Table responsive hover className="align-middle mb-0">
          <thead className="thead-light">
            <tr>
              <th>TC NO</th>
              <th>TEST CASE NAME</th>
              <th>TEST CASE DESCRIPTION</th>
              <th>TAGS</th>
              <th>STATUS</th>
              <th className="text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredTestCases.map((tc) => (
              <tr key={tc.test_case_id}>
                <td className="fw-semibold">{tc.test_case_no}</td>
                <td className="wrap-text">{tc.name}</td>
                <td className="wrap-text">{tc.description}</td>
                <td>
                  {
                    <div className="col-2">
                      <span className="badge border border-info text-dark">{tc.tags}</span>
                    </div>
                  }
                </td>
                <td className="text-center">{getStatusBadge(tc.status)}</td>
                <td className="text-center">
                  <TestCaseActions
                    status={tc.status}
                    testCaseId={tc.test_case_id}
                    onPlay={() => togglePlayState(tc.test_case_id)}
                    onStop={() => handleStopExecution(tc.test_case_id)}
                    onEdit={() => handleEditTestCase(tc)}
                    onDelete={() => handleDeleteTestCase(tc)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <ListPagination
        pagination={pagination}
        pageSize={pageSize}
        onPageChange={(p) => setListPage(p)}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setListPage(1);
        }}
      />
    </>
  );

  return (
    <div className="container-fluid p-1 container-root">
      {/* Header */}
      <ProjectHeader project={project} breadcrumbs="test-cases" />

      {isLoading && (
        <div className="spinner-overlay">
          <Spinner animation="border" variant="primary" role="status"></Spinner>
        </div>
      )}

      {infoMessage && <div className="alert alert-warning toast-notification">{infoMessage}</div>}

      {/* Table Card */}
      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="section-title mb-3">
          <FormattedMessage id="test-cases" />
        </div>

        <Tabs activeKey={mainTab} onSelect={(k) => setMainTab(k || 'active')} className="mb-3">
          <Tab
            eventKey="active"
            title={<FormattedMessage id="testcases-tab-active" defaultMessage="Active Test Cases" />}
          >
            {activeTabContent}
          </Tab>
          <Tab
            eventKey="generate"
            title={<FormattedMessage id="testcases-tab-generate" defaultMessage="Generate" />}
          >
            <GenerateTab
              project={project}
              onGenerated={() => {
                setPendingRefreshKey((x) => x + 1);
                setMainTab('pending');
              }}
            />
          </Tab>
          <Tab eventKey="pending" title={<FormattedMessage id="testcases-tab-pending" defaultMessage="Pending" />}>
            <PendingTab
              key={pendingRefreshKey}
              project={project}
              onApproved={() => setActiveRefreshToken((x) => x + 1)}
            />
          </Tab>
        </Tabs>

        <ConfirmDeleteModal
          show={showDeleteConfirmModal}
          onHide={handleCloseDeleteModal}
          onSubmit={handleSubmitDelete}
          toDelete={selectedItemType?.name}
        />
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
