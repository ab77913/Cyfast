import React, { useState, useEffect } from 'react';
import { Row, Col } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
import ProjectActionLinks from './ProjectActionLinks';
import { getStatusBadge } from 'data/listData';
import { getProjectById, deleteProject } from 'utils/apiServices';

import SuccessModal from 'views/shared-modals/SuccessModal';
import ProjectConfigModal from './modals/ProjectConfigModal';
import ProjectFormModal from './modals/ProjectFormModal';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';

import { useSelectedProject } from 'contexts/ProjectContext';

const ProjectHeader = ({ project, breadcrumbs }) => {
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [isProjectConfigOpen, setIsProjectConfigOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successIconColor, setSuccessIconColor] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  const { selectedProjectInContext, setSelectedProjectInContext } = useSelectedProject();

  const showProjectFormModal = () => setIsProjectFormOpen(true);
  const hideProjectFormModal = () => setIsProjectFormOpen(false);

  const showProjectConfigModal = () => {
    setIsProjectConfigOpen(true);
  };
  const hideProjectConfigModal = () => {
    setIsProjectConfigOpen(false);
  };

  const showConfirmDeleteModal = () => {
    setIsConfirmDeleteOpen(true);
  };
  const hideConfirmDeleteModal = () => {
    setSelectedProject({});
    setIsConfirmDeleteOpen(false);
  };

  const handleSubmitDelete = async () => {
    try {
      const response = await deleteProject(project?.project_id);
      if (response.status === 200 && response.data === true) {
        hideConfirmDeleteModal();
        setSuccessMessage(`Entire ${project?.name} has been deleted successfully`);
        setSuccessIconColor('#FF5C5C');
        setShowSuccessModal(true);

        setTimeout(() => {
          setShowSuccessModal(false);
          setSelectedProject({});
        }, 2000);
        navigate('/projects');
      }
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setShowConfirmDeleteModal(false);
    }
  };

  const afterConfigUpdate = () => {
    hideProjectConfigModal();
    setSuccessMessage(`Project ${project.name} configuration has been updated successfully.`);
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  const afterProjectEntry = async () => {
    hideProjectFormModal();
    try {
      const updatedProject = await getProjectById(selectedProject.project_id);
      setSuccessMessage(`Project ${updatedProject.data.name} updated successfully.`);
      setSelectedProjectInContext(updatedProject.data);
      setSuccessIconColor('#2EDAB6');
    } catch (err) {
      console.error('Failed to update project after edit:', err);
    } finally {
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    }
  };

  return (
    <>
      <div className="sticky-Header">
        <h4 className="mb-0 page-title page-breadcrumbs">
          <span className="text-primary">Projects</span>
          <span className="text-muted">
            {' '}
            / <FormattedMessage id={breadcrumbs} />
          </span>
        </h4>
      </div>

      {/* Project Info Row */}
      <Row className="align-items-center mt-3 mb-3">
        {/* Left Side: Project Name and Status */}
        <Col className="d-flex align-items-center">
          <h5 className="fw-semibold mb-0 project-title">{project?.name?.toUpperCase()}</h5>
          <div className="spacer"></div>
          {getStatusBadge(project?.status)}
        </Col>

        {/* Right Side: Action Links */}
        <Col>
          <ProjectActionLinks
            project={project}
            setSelectedProject={setSelectedProject}
            showProjectFormModal={showProjectFormModal}
            showProjectConfigModal={showProjectConfigModal}
            showConfirmDeleteModal={showConfirmDeleteModal}
          />
        </Col>
      </Row>

      {/* Project Type */}
      {/* <div className="mb-3">
      <div className="fw-bold small project-type">{project?.type}</div>
    </div> */}

      <ProjectFormModal show={isProjectFormOpen} onHide={hideProjectFormModal} project={selectedProject} afterSuccess={afterProjectEntry} />
      <ConfirmDeleteModal
        show={isConfirmDeleteOpen}
        onHide={hideConfirmDeleteModal}
        onSubmit={handleSubmitDelete}
        toDelete={selectedProject?.name}
      />
      <ProjectConfigModal show={isProjectConfigOpen} onHide={hideProjectConfigModal} project={project} afterSuccess={afterConfigUpdate} />
      {/* show SuccessModal for all cases*/}
      <SuccessModal
        show={showSuccessModal}
        onHide={() => setShowSuccessModal(false)}
        message={successMessage}
        iconColor={successIconColor}
      />
    </>
  );
};

export default ProjectHeader;
