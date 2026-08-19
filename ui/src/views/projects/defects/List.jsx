import React, { useState } from 'react';
import { Row, Col, Form, Button, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Select from 'react-select';
import { getStatusBadge, sortOptions } from 'data/listData';
import { FormattedMessage } from 'react-intl';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import ProjectHeader from '../ProjectHeader';
import { useSelectedProject } from 'contexts/ProjectContext';
import SuccessModal from 'views/shared-modals/SuccessModal';
import ProjectConfigModal from '../modals/ProjectConfigModal';
import ProjectFormModal from '../modals/ProjectFormModal';
import { getProjectById, deleteProject } from 'utils/apiServices';
import TestSourceModal from '../modals/TestSourceModal';

const Defects = () => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState(null); // for defects cases or type
  const [deleteContext, setDeleteContext] = useState(''); // 'entire project'
  const [isHoveringRefresh, setIsHoveringRefresh] = useState(false);
  const [showDefectsImportModal, setDefectsImportModal] = useState(false);
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

  const defectsList = [
    { defectNo: 'DEF-001', name: 'Login Failure', description: 'Login fails with valid credentials', status: 'PASSED' },
    { defectNo: 'DEF-002', name: 'UI Misalignment', description: 'Text not aligned on dashboard', status: 'INPROGRESS' },
    { defectNo: 'DEF-003', name: 'Crash on Save', description: 'App crashes when saving a draft', status: 'FAILED' },
    { defectNo: 'DEF-004', name: 'Timeout Error', description: 'API timeout under load', status: 'ERROR' },
    { defectNo: 'DEF-005', name: 'Validation Issue', description: 'Invalid input allowed on form', status: 'PAUSED' }
  ];

  const filteredDefects = defectsList.filter((defects) => {
    const matchesStatus = !sortBy || !sortBy.value || defects.status.toUpperCase() === sortBy.value;
    const matchesSearch =
      defects.defectNo.toLowerCase().includes(searchTerm.toLowerCase()) || defects.name.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  // to handle delete entire Defect
  const handleDeleteAction = () => {
    setSelectedItemType(project?.name);
    setDeleteContext('project');
    setShowDeleteConfirmModal(true);
  };

  const handleConfigurationAction = () => {
    setShowConfigModal(true);
  };

  const handleCloseConfigModal = () => {
    setShowConfigModal(false);
  };

  const handleDeleteDefectAction = (defect) => {
    setSelectedItemType(defect);
    setDeleteContext('defects');

    setShowDeleteConfirmModal(true);
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

  const handleToDeleteADefect = async () => {
    const defectId = selectedItemType?.id;
    const defectName = selectedItemType?.name;
    handleSuccess(`Defect "${defectName}" has been deleted successfully`, '#FF5C5C');
    setSelectedItemType(null);
    setDeleteContext('');
    setShowDeleteConfirmModal(false);
    // try {
    //   const response = await deleteADefect(defectId);
    //   if (response.status === 200) {
    //     handleSuccess(`Defect "${defectName}" has been deleted successfully`, '#FF5C5C');
    //     setSelectedItemType(null);
    //     setDeleteContext('');
    //     setShowDeleteConfirmModal(false);
    //     await fetchDefectsList(); // Refresh Defects list
    //   } else {
    //     handleError('defects', new Error('Unexpected response status'));
    //   }
    // } catch (error) {
    //   handleError('defects', error);
    // }
  };

  const handleToProjectDelete = async () => {
    try {
      const response = await deleteProject(project?.project_id);

      if (response.status === 200 && response.data === true) {
        handleSuccess(`Entire ${project?.name} has been deleted successfully`, '#FF5C5C');

        setSelectedProject({});
        setDeleteContext('');
        setShowDeleteConfirmModal(false);
        navigate('/projects');
      } else {
        handleError('project', new Error('Unexpected response'));
      }
    } catch (error) {
      handleError('project', error);
    }
  };

  const handleSubmitDelete = async () => {
    if (deleteContext === 'project') {
      await handleToProjectDelete();
    } else if (deleteContext === 'defects') {
      await handleToDeleteADefect();
    } else {
      console.warn('Delete context is not set or invalid.');
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirmModal(false);
    setSelectedItemType(null);
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
      <ProjectHeader project={project} breadcrumbs="defects" />
      {/* Table Card */}
      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="section-title">
          <FormattedMessage id="defects" />
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
                placeholder="Search Defects"
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
              <i className={`m-2 feather icon-refresh-cw text-primary`} />
              Sync
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

        {/* Table */}
        <div className="scroll-container">
          <Table responsive hover className="align-middle mb-0">
            <thead className="thead-light">
              <tr>
                <th>DEFECT NO</th>
                <th>DEFECT NAME</th>
                <th>DEFECT DESCRIPTION</th>
                <th>STATUS</th>
                <th className="text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDefects.map((defect, index) => (
                <tr key={index}>
                  <td className="fw-semibold">{defect.defectNo}</td>
                  <td>{defect.name}</td>
                  <td>{defect.description}</td>
                  <td>{getStatusBadge(defect.status)}</td>
                  <td className="text-center">
                    <Link to="#" className="text-primary mx-2" title="Edit">
                      <i className="feather icon-action edit icon-edit" />
                    </Link>
                    <Link
                      to="#"
                      className="text-danger mx-2"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDefectAction(defect);
                      }}
                    >
                      <i className="feather icon-action delete icon-trash-2" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <ConfirmDeleteModal
          show={showDeleteConfirmModal}
          onHide={handleCloseDeleteModal}
          onSubmit={handleSubmitDelete}
          toDelete={deleteContext === 'project' ? selectedItemType : selectedItemType?.name}
        />
        {/* show SuccessModal */}
        <SuccessModal
          show={showSuccessModal}
          onHide={() => setShowSuccessModal(false)}
          message={successMessage}
          iconColor={successIconColor}
        />
      </div>
      <TestSourceModal
        show={showDefectsImportModal}
        onClose={handleCloseImportModal}
        onSubmit={handleSubmitOnImport}
        importLabelId="defects"
      />
      <ProjectConfigModal show={showConfigModal} onHide={handleCloseConfigModal} project={project} afterSuccess={afterConfigUpdate} />
      <ProjectFormModal show={isProjectFormOpen} onHide={hideProjectFormModal} project={selectedProject} afterSuccess={afterProjectEntry} />
    </div>
  );
};

export default Defects;
