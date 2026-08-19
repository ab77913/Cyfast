import React, { useState, useEffect } from 'react';

import { Row, Col, Button } from 'react-bootstrap';
import Select from 'react-select';
import { sortOptions } from 'data/listData';
import { FormattedMessage } from 'react-intl';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { TestCaseEffectiveness, DefectDensity, DailyExeChartData, FailureData, FailureOptions } from 'data/chartConfigs';
import TestScriptExecution from './TestScriptExecution';
import TestCaseExecution from './TestCaseExecution';
import TestCaseEffectivenessBlock from './TestCaseEffectivenessBlock';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import ProjectHeader from '../ProjectHeader';
import { useSelectedProject } from 'contexts/ProjectContext';
import SuccessModal from 'views/shared-modals/SuccessModal';
import ProjectFormModal from '../modals/ProjectFormModal';
import { getProjectById, deleteProject } from 'utils/apiServices';
import ProjectConfigModal from '../modals/ProjectConfigModal';
import TestSourceModal from '../modals/TestSourceModal';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const componentMap = {
  testScriptExecution: TestScriptExecution,
  testCaseExecution: TestCaseExecution,
  testEffectiveness: TestCaseEffectivenessBlock
};

const ExecutionAnalytics = () => {
  const [analyticsList, setAnalyticsList] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  //const [isHoveringRefresh, setIsHoveringRefresh] = useState(false);
  const [showDefectsImportModal, setDefectsImportModal] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState(null); // for entire prj from history
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const showProjectFormModal = () => setIsProjectFormOpen(true);
  const hideProjectFormModal = () => setIsProjectFormOpen(false);
  const [selectedProject, setSelectedProject] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [successIconColor, setSuccessIconColor] = useState('');

  const [sortBy, setSortBy] = useState(null);
  const { selectedProjectInContext, setSelectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;

  useEffect(() => {
    if (!project) return;
    const fetchData = async () => {
      const analyticsList = [
        //test data
        {
          id: 'script-execution1',
          type: 'testScriptExecution',
          title: 'Test Script Execution A',
          planned: 50,
          executed: 44,
          dailyTrend: DailyExeChartData,
          defectDensity: DefectDensity
        },
        {
          id: 'case-execution',
          type: 'testCaseExecution',
          title: 'Test Case Execution A',
          planned: 42,
          executed: 18,
          dailyTrend: DailyExeChartData,
          defectDensity: DefectDensity
        },
        {
          id: 'script-execution2',
          type: 'testScriptExecution',
          title: 'Test Script Execution B',
          planned: 30,
          executed: 24,
          dailyTrend: DailyExeChartData,
          defectDensity: DefectDensity
        },
        {
          id: 'effectiveness-block',
          type: 'testEffectiveness',
          functionalTests: [
            { title: 'Functional Test A', coverage: 75, effectiveness: TestCaseEffectiveness },
            { title: 'Functional Test B', coverage: 82, effectiveness: TestCaseEffectiveness }
          ],
          uiTests: [{ title: 'UI Test A', coverage: 88, effectiveness: TestCaseEffectiveness }],
          failureDataProps: {
            failureData: FailureData,
            failureOptions: FailureOptions
          }
        }
      ];
      setAnalyticsList(analyticsList);
    };
    fetchData();
  }, []);

  const handleConfigurationAction = () => {
    setShowConfigModal(true);
  };

  const handleCloseConfigModal = () => {
    setShowConfigModal(false);
  };

  const handleImportDefectModal = () => {
    setDefectsImportModal(true);
  };
  const handleCloseImportModal = () => {
    setDefectsImportModal(false);
  };
  const handleSubmitOnImport = () => {
    handleCloseImportModal();
  };

  // to handle delete project
  const handleDeleteAction = () => {
    setSelectedItemType(project?.name);
    setShowDeleteConfirmModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirmModal(false);
    setSelectedItemType(null);
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

  const handleSubmitDelete = async () => {
    try {
      const response = await deleteProject(project?.project_id);

      if (response.status === 200 && response.data === true) {
        handleSuccess(`Entire ${project?.name} has been deleted successfully`, '#FF5C5C');

        setShowDeleteConfirmModal(false);
        navigate('/projects');
      } else {
        handleError('project', new Error('Unexpected response'));
      }
    } catch (error) {
      handleError('project', error);
    }
  };

  const afterProjectEntry = async () => {
    hideProjectFormModal();
    try {
      const updatedProject = await getProjectById(selectedProject?.project_id);
      setSelectedProjectInContext(updatedProject.data);
      setSuccessMessage(`Project ${updatedProject.data.name} updated successfully.`);
      setSuccessIconColor('#2EDAB6');
    } catch (err) {
      console.error('Failed to update project after edit:', err);
    } finally {
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    }
  };

  const afterConfigUpdate = () => {
    handleCloseConfigModal();
    setSuccessMessage(`Project ${project?.name} configuration has been updated successfully.`);
    setSuccessIconColor('#2EDAB6');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  return (
    <div className="container-fluid p-1 container-root">
      {/* Header */}
      <ProjectHeader project={project} breadcrumbs="analytics" />

      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="section-title">
          <FormattedMessage id="analytics" />
        </div>

        <Row className="align-items-center mb-3">
          <Col md="auto" className="d-flex align-items-center">
            <div className="select-wrapper">
              <Select
                classNamePrefix="select"
                name="sort"
                options={sortOptions}
                value={sortBy}
                onChange={(selectedOption) => setSortBy(selectedOption)}
                placeholder="This Month"
                menuPortalTarget={document.body}
              />
            </div>
          </Col>

          <Col className="text-end d-flex justify-content-end align-items-center">
            <Button
              variant="outline-primary"
              className="me-3"
              //onMouseEnter={() => setIsHoveringRefresh(true)}
              //onMouseLeave={() => setIsHoveringRefresh(false)}
              onClick={() => console.log('Refresh clicked')}
            >
              Refresh
            </Button>

            <Button
              variant="primary"
              onClick={(e) => {
                e.stopPropagation();
                handleImportDefectModal();
              }}
            >
              Import
            </Button>
          </Col>
        </Row>

        <div className="analytics-rows">
          {/* analytics list of rows */}
          <div className="d-flex flex-column gap-3">
            {analyticsList.map((item) => {
              const Component = componentMap[item.type];
              return Component ? <Component key={item.id} {...item} /> : null;
            })}
          </div>
        </div>

        <TestSourceModal
          show={showDefectsImportModal}
          onClose={handleCloseImportModal}
          onSubmit={handleSubmitOnImport}
          importLabelId="analytics"
        />
        <ConfirmDeleteModal
          show={showDeleteConfirmModal}
          onHide={handleCloseDeleteModal}
          onSubmit={handleSubmitDelete}
          toDelete={selectedItemType}
        />

        {/* showSuccessModal */}
        <SuccessModal
          show={showSuccessModal}
          onHide={() => setShowSuccessModal(false)}
          message={successMessage}
          iconColor={successIconColor}
        />

        <ProjectConfigModal show={showConfigModal} onHide={handleCloseConfigModal} project={project} afterSuccess={afterConfigUpdate} />
        <ProjectFormModal
          show={isProjectFormOpen}
          onHide={hideProjectFormModal}
          project={selectedProject}
          afterSuccess={afterProjectEntry}
        />
      </div>
    </div>
  );
};

export default ExecutionAnalytics;
