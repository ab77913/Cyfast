// components/modals/AddProjectModal.js
import React, { useState, useEffect } from 'react';
import { Modal, Form, Row, Col, Button } from 'react-bootstrap';
import Select from 'react-select';
import { addProject, updateProject } from 'utils/apiServices';
import { projectTypeOptions } from 'data/listData';

const ProjectFormModal = ({ show, onHide, project, afterSuccess }) => {
  const [errors, setErrors] = useState({});
  const [selectedProject, setSelectedProject] = useState({});

  useEffect(() => {
    setSelectedProject(project);

    if (!show) {
      setErrors({});
    }
  }, [show, project]);

  const validate = () => {
    console.log(selectedProject);
    const newErrors = {};
    if (!selectedProject?.name?.trim()) {
      newErrors.title = 'Project Title is required.';
    }
    if (!selectedProject?.type) {
      newErrors.type = 'Project Type is required.';
    }
    if (!selectedProject?.description?.trim()) {
      newErrors.description = 'Project Description is required.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      const projectData = {
        organization_id: 1,
        ...selectedProject
        // phase: selectedProject.phase
      };

      try {
        let response = null;
        if (project?.project_id) {
          response = await updateProject(project.project_id, projectData);
        } else {
          response = await addProject(projectData);
        }
        if (response.status === 200) {
          afterSuccess();
        } else {
          setErrors((prev) => ({ ...prev, errorMessage: 'Something went wrong. Please try again.' }));
        }
      } catch (err) {
        const message = err?.response?.data?.message || 'Something went wrong. Please try again.';
        setErrors((prev) => ({ ...prev, errorMessage: message }));
      }
    } else {
      console.log(Object.values(errors));
    }
  };

  const handleCancel = () => {
    onHide(false);
    setSelectedProject({});
  };

  const ErrorMessage = ({ message, onClose }) => {
    useEffect(() => {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);

      return () => clearTimeout(timer);
    }, [message, onClose]);

    return (
      <div className="alert alert-danger text-center my-3" role="alert">
        {message}
      </div>
    );
  };

  return (
    <Modal size="lg" centered show={show}>
      <Modal.Header>
        <Modal.Title as="h5">{selectedProject && selectedProject?.name ? selectedProject?.name : 'Add New Project'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {errors.errorMessage && (
          <ErrorMessage message={errors.errorMessage} onClose={() => setErrors((prev) => ({ ...prev, errorMessage: null }))} />
        )}

        <Form>
          {/* Project Title */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              Project Title <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Please Enter Title"
              value={selectedProject?.name}
              onChange={(e) => {
                setSelectedProject({ ...selectedProject, name: e.target.value });
                if (errors.title) setErrors((prev) => ({ ...prev, title: null }));
              }}
              isInvalid={!!errors.title}
            />
            <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
          </Form.Group>

          {/* Project Type */}
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-semibold">
                  Project Type <span className="text-danger">*</span>
                </Form.Label>
                <Select
                  options={projectTypeOptions}
                  value={projectTypeOptions.find((option) => option.value === selectedProject?.type) || null}
                  onChange={(selectedOption) => {
                    setSelectedProject({ ...selectedProject, type: selectedOption ? selectedOption.value : '' });
                    if (errors.type) setErrors((prev) => ({ ...prev, type: null }));
                  }}
                  classNamePrefix="react-select"
                  placeholder="Please Select"
                  styles={{
                    control: (provided) => ({
                      ...provided,
                      borderColor: errors.type ? '#dc3545' : provided.borderColor,
                      '&:hover': {
                        borderColor: errors.type ? '#dc3545' : provided.borderColor
                      }
                    })
                  }}
                />
                {errors.type && (
                  <div className="text-danger mt-1" style={{ fontSize: '0.875em' }}>
                    {errors.type}
                  </div>
                )}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-semibold">Project Phase</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Please Enter Phase"
                  value={selectedProject?.phase || ''}
                  onChange={(e) => setSelectedProject({ ...selectedProject, phase: e.target.value })}
                />
              </Form.Group>
            </Col>
          </Row>

          {/* Project Description */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              Project Description <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Type Description"
              value={selectedProject?.description}
              onChange={(e) => {
                setSelectedProject({ ...selectedProject, description: e.target.value });
                if (errors.description) setErrors((prev) => ({ ...prev, description: null }));
              }}
              isInvalid={!!errors.description}
            />
            <Form.Control.Feedback type="invalid">{errors.description}</Form.Control.Feedback>
          </Form.Group>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={handleCancel} variant="outline-secondary">
          Cancel
        </Button>
        <Button onClick={handleSubmit} type="button" className="btn-fast-submit">
          Submit
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ProjectFormModal;
