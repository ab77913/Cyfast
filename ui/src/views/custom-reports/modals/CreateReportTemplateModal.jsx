import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import PropTypes from 'prop-types';
import Select from 'react-select';
import { createReportTemplate, updateReportTemplate } from 'utils/apiServices';

const reportTypeOptions = [
  { value: '', label: 'Please Select type' },
  { value: 'TEST_SUMMARY', label: 'Test Summary' },
  { value: 'ORCHESTRATION_EXECUTION_LOG', label: 'Orchestration Execution Log' },
  { value: 'ORCHESTRATION_TEST_SUMMARY', label: 'Orchestration Test Summary' },
  { value: 'CONSOLE_LOG', label: 'Console Log' }
];

const CreateReportTemplateModal = ({ show, onHide, template, afterSuccess }) => {
  const [reportTemplate, setReportTemplate] = React.useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!show) {
      setReportTemplate({});
      setErrors({});
    } else {
      setReportTemplate(template);
    }
  }, [show, template]);

  const handleChange = (field, value) => {
    setReportTemplate((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSubmit = () => {
    const newErrors = {};
    if (!reportTemplate.report_type) {
      newErrors.report_type = 'Report Type is required';
    }
    if (!reportTemplate.name) {
      newErrors.name = 'Template Name is required';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    if (reportTemplate.id) {
      updateReportTemplate(reportTemplate.id, reportTemplate)
        .then((response) => {
          afterSuccess(response.data);
        })
        .catch((error) => {
          console.error('Error updating report template:', error);
        });
    } else {
      createReportTemplate(reportTemplate)
        .then((response) => {
          afterSuccess(response.data);
        })
        .catch((error) => {
          console.error('Error creating report template:', error);
        });
    }
    console.log('Report Template Submitted:', reportTemplate);
    onHide();
  };

  return (
    <Modal size="md" centered show={show} onHide={onHide}>
      <Modal.Header>
        <Modal.Title as="h5">{reportTemplate ? reportTemplate.name : 'New Report Template'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Report Type</Form.Label>
            <Select
              options={reportTypeOptions}
              value={reportTypeOptions.find((opt) => opt.value === reportTemplate.report_type)}
              onChange={(selected) => handleChange('report_type', selected.value)}
              classNamePrefix="select"
              className={errors.report_type ? 'is-invalid' : ''}
              placeholder="Please Select"
            />
            {errors.reportType && <div className="invalid-feedback d-block">{errors.reportType}</div>}
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="fw-semibold">Template Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Template Name"
              value={reportTemplate.name}
              onChange={(e) => handleChange('name', e.target.value)}
              isInvalid={!!errors.name}
              className="form-control"
            />
            <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onHide} variant="outline-secondary">
          Cancel
        </Button>
        <Button onClick={handleSubmit} className="primary">
          Submit
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateReportTemplateModal;
