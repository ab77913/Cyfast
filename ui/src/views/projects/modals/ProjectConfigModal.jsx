import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Col, Row, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import { getProjectConfiguration, updateProjectConfiguration } from 'utils/apiServices';

const ProjectConfigModal = ({ show, onHide, project, afterSuccess }) => {
  const [projectConfiguration, setProjectConfiguration] = useState({});
  const [errors, setErrors] = useState({});

  // clear on modal close
  useEffect(() => {
    if (!show) {
      setProjectConfiguration({});
      setErrors({});
    }
  }, [show]);

  // Fetch configuration while modal is opening...
  useEffect(() => {
    if (!show) return;

    const fetchConfiguration = async () => {
      try {
        const response = await getProjectConfiguration(project?.project_id);
        if (response?.data) {
          setProjectConfiguration(() => ({
            ...response.data,
            execution_base: response.data.execution_base || 'testScript'
          }));
        }
      } catch (err) {
        console.error('Error fetching configurations:', err);
      }
    };

    fetchConfiguration();
  }, [show, project]);

  const validate = () => {
    const newErrors = {};
    if (
      projectConfiguration.enable_email_notifications &&
      (!projectConfiguration.emails_to_notify || !projectConfiguration.emails_to_notify.trim())
    ) {
      newErrors.emails_to_notify = 'Emails are required to send notifications';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setProjectConfiguration((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validate()) {
      try {
        const response = await updateProjectConfiguration(project?.project_id, projectConfiguration);
        if (response.status === 200) {
          afterSuccess();
        } else {
          console.log('Error occurred!');
        }
      } catch (err) {
        console.error('Error saving configuration:', err);
      } finally {
        onHide();
      }
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Form onSubmit={handleSubmit}>
        <Modal.Header>
          <Modal.Title>{project?.name}&rsquo;s Configurations</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="align-items-left mb-3" controlId="emailAndNotify">
            <Form.Label className="mt-2">
              Email IDs to notify (Use comma for multiple emails) <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={projectConfiguration.emails_to_notify}
              onChange={(e) => handleChange('emails_to_notify', e.target.value)}
              isInvalid={!!errors.emails_to_notify}
              placeholder="Enter email(s)"
            />
            <Form.Control.Feedback type="invalid">{errors.emails_to_notify}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group as={Row} className="mb-3 align-items-center">
            <Form.Label column sm={3} className="orche-modal-label">
              Execution Base
            </Form.Label>
            <Col sm={9}>
              <ToggleButtonGroup
                type="radio"
                name="executionBase"
                value={projectConfiguration.execution_base || 'testScript'}
                onChange={(val) => handleChange('execution_base', val)}
              >
                <ToggleButton
                  id="executionBase-testCase"
                  value="testCase"
                  variant={projectConfiguration.execution_base === 'testCase' ? 'secondary' : 'outline-secondary'}
                >
                  Test Case
                </ToggleButton>
                <ToggleButton
                  id="executionBase-testScript"
                  value="testScript"
                  variant={projectConfiguration.execution_base === 'testScript' ? 'secondary' : 'outline-secondary'}
                >
                  Test Script
                </ToggleButton>
              </ToggleButtonGroup>
            </Col>
          </Form.Group>

          <hr />

          <Form.Group controlId="enableLogging" className="mb-2">
            <Form.Check
              type="checkbox"
              id="enableEmailNotifications"
              label="Enable Email Notifications"
              checked={projectConfiguration.enable_email_notifications || false}
              onChange={(e) => handleChange('enable_email_notifications', e.target.checked)}
              className="custom-checkbox-dark mb-3"
            />
            <Form.Check
              type="checkbox"
              label="Enable Logging"
              checked={projectConfiguration.enable_logging}
              onChange={(e) => handleChange('enable_logging', e.target.checked)}
              className="custom-checkbox-dark"
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button onClick={onHide} variant="outline-secondary">
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

export default ProjectConfigModal;
