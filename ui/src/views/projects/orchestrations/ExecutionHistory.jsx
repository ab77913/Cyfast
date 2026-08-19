import React, { useState } from 'react';
import { Row, Col, Form, Button, DropdownButton, Dropdown, ButtonGroup } from 'react-bootstrap';
import Select from 'react-select';
import { getStatusBadge, sortOptions } from 'data/listData';
import { FormattedMessage } from 'react-intl';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import SuccessModal from 'views/shared-modals/SuccessModal';
import ProjectHeader from '../ProjectHeader';
import { useSelectedProject } from 'contexts/ProjectContext';
import ProjectFormModal from '../modals/ProjectFormModal';
import { getProjectById, deleteProject } from 'utils/apiServices';
import ProjectConfigModal from '../modals/ProjectConfigModal';
import TestSourceModal from '../modals/TestSourceModal';

const ExecutionHistory = () => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isHoveringRefresh, setIsHoveringRefresh] = useState(false);
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
  const [searchTerm, setSearchTerm] = useState('');
  const { selectedProjectInContext, setSelectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;

  const historyList = [
    {
      execInstanceId: '10002-202305160-71322241000-9843',
      name: 'Admit_Patient.robot',
      description: 'Login fails with valid credentials',
      status: 'PASSED'
    },
    {
      execInstanceId: '10002-202305160-71322241000-1234',
      name: 'UI Misalignment',
      description: 'Text not aligned on dashboard',
      status: 'INPROGRESS'
    },
    {
      execInstanceId: '10002-202305160-71322241000-5678',
      name: 'Crash on Save',
      description: 'App crashes when saving a draft',
      status: 'FAILED'
    },
    { execInstanceId: '10002-202305160-71322241000-5874', name: 'Timeout Error', description: 'API timeout under load', status: 'ERROR' },
    {
      execInstanceId: '10002-202305160-71322241000-9899',
      name: 'Validation Issue',
      description: 'Invalid input allowed on form',
      status: 'PAUSED'
    }
  ];

  const downloadDropdown = (
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
      <Dropdown.Item eventKey="1">Download PDF</Dropdown.Item>
      <Dropdown.Item eventKey="2">Download CSV</Dropdown.Item>
      <Dropdown.Item eventKey="3">Download Excel</Dropdown.Item>
    </DropdownButton>
  );

  const filteredHistory = historyList.filter((item) => {
    const matchesStatus = !sortBy || !sortBy.value || item.status.toUpperCase() === sortBy.value;
    const matchesSearch =
      item.execInstanceId.toLowerCase().includes(searchTerm.toLowerCase()) || item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

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

  // to handle delete entire prj from history
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

        setSelectedProject({});
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
      <ProjectHeader project={project} breadcrumbs="history" />

      {/* Table Card */}
      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="section-title">
          <FormattedMessage id="history" />
        </div>

        <Row className="align-items-center mb-3">
          {/* Filter */}
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

          {/* Buttons */}
          <Col className="text-end d-flex justify-content-end align-items-center">
            <Button
              variant="outline-primary"
              className="me-3"
              onMouseEnter={() => setIsHoveringRefresh(true)}
              onMouseLeave={() => setIsHoveringRefresh(false)}
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

        {/* row header */}
        <div className="d-none d-md-grid py-2 px-3 history-header">
          <div className="flexCenter">
            EXECUTION <br /> INSTANCE ID
          </div>
          <div className="flexCenter">
            {' '}
            ORCHESTRATION <br /> NAME
          </div>
          <div className="flexCenter">
            {' '}
            START DATE <br /> AND TIME
          </div>
          <div className="flexCenter">
            {' '}
            EXECUTION DURATION
            <br />
            (HH:MM:SS)
          </div>
          <div className="flexCenter">STATUS</div>
          <div className="flexCenter justify-center">ACTIONS</div>
        </div>

        {/* rows */}
        {filteredHistory.map((item, index) => (
          <div key={index} className="history-row">
            <div className="exec-instance-id">{item.execInstanceId}</div>
            <div>{item.name}</div>
            <div>{item.startDate || '2024-05-01 10:00 AM'}</div>
            <div>{item.executionDuration || '00:15:23'}</div>
            <div>{getStatusBadge(item.status)}</div>
            <div className="text-end">{downloadDropdown}</div>
          </div>
        ))}
      </div>
      <TestSourceModal
        show={showDefectsImportModal}
        onClose={handleCloseImportModal}
        onSubmit={handleSubmitOnImport}
        importLabelId="history"
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
      <ProjectFormModal show={isProjectFormOpen} onHide={hideProjectFormModal} project={selectedProject} afterSuccess={afterProjectEntry} />
    </div>
  );
};

export default ExecutionHistory;
