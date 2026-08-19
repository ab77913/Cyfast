import React from 'react';
import { Link } from 'react-router-dom';

const ProjectActionLinks = ({ project, setSelectedProject, showProjectFormModal, showProjectConfigModal, showConfirmDeleteModal }) => {
  const handleEditAction = (project) => {
    setSelectedProject(project);
    showProjectFormModal(true);
  };

  const handleSettingsAction = (project) => {
    setSelectedProject(project);
    showProjectConfigModal(true);
  };

  const handleDeleteAction = (project) => {
    setSelectedProject(project);
    showConfirmDeleteModal(true);
  };

  return (
    <>
      <div className="text-end">
        <Link
          to="#"
          className="text-primary mx-1"
          title="Edit"
          onClick={(e) => {
            e.stopPropagation();
            handleEditAction(project);
          }}
        >
          <i className="feather icon-edit icon-action edit" />
        </Link>

        <Link
          to="#"
          className="text-danger mx-1"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteAction(project);
          }}
        >
          <i className="feather icon-trash-2 icon-action delete" />
        </Link>

        <Link
          to="#"
          className="text-secondary mx-1"
          title="Settings"
          onClick={(e) => {
            e.stopPropagation();
            handleSettingsAction(project);
          }}
        >
          <i className="feather icon-settings icon-action settings" />
        </Link>
      </div>
    </>
  );
};

export default ProjectActionLinks;
