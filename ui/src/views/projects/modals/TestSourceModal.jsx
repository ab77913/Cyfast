import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Button, Modal } from 'react-bootstrap';
import Select from 'react-select';
import { useSelectedProject } from 'contexts/ProjectContext';

const sourceOptions = [
  { value: 'REPOSITORY', label: 'Repository' },
  { value: 'SHARED_DIRECTORY', label: 'Shared Directory' }
];

const repoOptions = [
  { value: 'GIT', label: 'GIT' },
  { value: 'SVN', label: 'SVN' }
];

const frameworkOptions = [
  { value: 'SPECFLOW', label: 'SpecFlow' },
  { value: 'PYTEST', label: 'PyTest' },
  { value: 'ROBOT', label: 'Robot' }
];

const TestSourceModal = ({ show, onClose, onSubmit, testSource }) => {
  const { selectedProjectInContext } = useSelectedProject();
  const [selectedSource, setSelectedSource] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const project = selectedProjectInContext;

  const handleChange = (field, value) => {
    setSelectedSource((prev) => ({ ...prev, [field]: value }));
    //if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // Load existing data when modal opens
  useEffect(() => {
    if (!project || !show) return;
    setSelectedSource(testSource || { project_id: project.project_id, source_type: 'REPOSITORY' });
    setIsEditing(!!testSource);
  }, [show, project, testSource]);

  const handleSubmitForm = (e) => {
    e.preventDefault();

    onSubmit(selectedSource, selectedSource.test_source_id ? selectedSource.test_source_id : null);
    setSelectedSource({});
    onClose();
  };

  return (
    <Modal size="lg" centered show={show} onHide={onClose}>
      <Form onSubmit={handleSubmitForm}>
        <Modal.Header>
          <Modal.Title as="h5">{project?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row className="align-items-center mb-3">
              <Col xs={6}>
                <Form.Label className="fw-semibold">Source Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Source name"
                  value={selectedSource.source_name}
                  onChange={(e) => handleChange('source_name', e.target.value)}
                  required
                />
              </Col>
              <Col xs={12} md={6}>
                <Form.Label className="fw-semibold">Source Type</Form.Label>
                <Select
                  options={sourceOptions}
                  placeholder="Select source type"
                  className="react-select-container"
                  classNamePrefix="react-select"
                  styles={{ container: (base) => ({ ...base, width: '100%' }) }}
                  value={sourceOptions.find((o) => o.value === selectedSource.source_type)}
                  onChange={(o) => handleChange('source_type', o.value)}
                />
              </Col>

              {/* <Col xs={12} md={4} className="d-flex align-items-center" style={{ marginTop: '32px' }}>
              <Form.Check
                type="checkbox"
                id="parse-test-cases"
                label="Parse Test Cases"
                style={{ transform: 'scale(1.1)', transformOrigin: 'left center' }}
              />
            </Col> */}
            </Row>

            <div style={selectedSource.source_type === 'REPOSITORY' ? {} : { display: 'none' }}>
              <Row className="mb-3">
                <Col xs={12} md={6}>
                  <Form.Label className="fw-semibold">Repository Type</Form.Label>
                  <Select
                    options={repoOptions}
                    placeholder="Select repository"
                    className="react-select-container"
                    classNamePrefix="react-select"
                    styles={{ container: (base) => ({ ...base, width: '100%' }) }}
                    value={repoOptions.find((o) => o.value === selectedSource.repository_type)}
                    onChange={(o) => handleChange('repository_type', o ? o.value : '')}
                    isClearable
                    required
                  />
                </Col>
              </Row>
              <Row className="mb-3">
                <Col xs={6}>
                  <Form.Label className="fw-semibold">Repository Server URL</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Server URL"
                    value={selectedSource.repository_server_url}
                    onChange={(e) => handleChange('repository_server_url', e.target.value)}
                  />
                </Col>
                <Col xs={6}>
                  <Form.Label className="fw-semibold">Repository GIT Branch Name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="GIT Branch Name"
                    value={selectedSource.repository_branch_name}
                    onChange={(e) => handleChange('repository_branch_name', e.target.value)}
                  />
                </Col>
              </Row>
            </div>

            <div style={selectedSource.source_type === 'SHARED_DIRECTORY' ? {} : { display: 'none' }}>
              <Row className="mb-3">
                <Col xs={12}>
                  <Form.Label className="fw-semibold">Directory Path</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Directory Path"
                    value={selectedSource.source_path}
                    onChange={(e) => handleChange('source_path', e.target.value)}
                  />
                </Col>
              </Row>
            </div>
            <Row className="mb-3">
              <Col xs={6}>
                <Form.Label className="fw-semibold">Suite Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Suite name"
                  value={selectedSource.suite_name}
                  onChange={(e) => handleChange('suite_name', e.target.value)}
                />
              </Col>
              <Col xs={6} className="mt-3 mt-md-0">
                <Form.Label className="fw-semibold">Test Framework</Form.Label>
                <Select
                  options={frameworkOptions}
                  placeholder="Select framework"
                  className="react-select-container"
                  classNamePrefix="react-select"
                  styles={{ container: (base) => ({ ...base, width: '100%' }) }}
                  value={frameworkOptions.find((o) => o.value === selectedSource.test_framework)}
                  onChange={(o) => handleChange('test_framework', o ? o.value : '')}
                />
              </Col>
            </Row>
            <hr />
            <Row className="mb-3">
              <Col xs={6}>
                <Form.Label className="fw-semibold">Username</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="GIT User Name"
                  value={selectedSource.access_username}
                  onChange={(e) => handleChange('access_username', e.target.value)}
                />
              </Col>
              <Col xs={6}>
                <Form.Label className="fw-semibold">Password</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Access Password"
                  value={selectedSource.access_password}
                  onChange={(e) => handleChange('access_password', e.target.value)}
                />
              </Col>
            </Row>

            <Row className="mb-3">
              <Col xs={12}>
                <Form.Label className="fw-semibold">Access Token</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Access Token"
                  value={selectedSource.access_token}
                  onChange={(e) => handleChange('access_token', e.target.value)}
                />
              </Col>
            </Row>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button onClick={onClose} variant="outline-secondary">
            Cancel
          </Button>

          <Button type="submit" variant="primary">
            Submit
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default TestSourceModal;
