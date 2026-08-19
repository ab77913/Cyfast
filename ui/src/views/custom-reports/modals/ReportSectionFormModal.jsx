import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Card } from 'react-bootstrap';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { createReportSection, updateReportSection } from 'utils/apiServices';

const AddNewReportModal = ({ show, onHide, reportSection, afterSubmit }) => {
  const [errors, setErrors] = useState({});
  const [selectedReportSection, setSelectedReportSection] = useState({});

  const handleChange = (field, value) => {
    setSelectedReportSection((prev) => ({ ...prev, [field]: value }));
  };

  const handleSectionSubmit = async () => {
    const newErrors = {};
    if (!selectedReportSection.name?.trim()) {
      newErrors.name = 'Section Name is required.';
    }
    if (!selectedReportSection.details?.trim()) {
      newErrors.details = 'Section Details are required.';
    }
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const sectionData = {
        ...selectedReportSection,
        report_template_id: reportSection.report_template_id // Assuming this is passed in the reportSection prop
      };

      let response;
      // If section ID is not present, create a new section; otherwise, update the existing
      if (!selectedReportSection.id) {
        // Create new section
        response = await createReportSection(sectionData);
      } else {
        // Update existing section
        response = await updateReportSection(selectedReportSection.id, sectionData);
      }
      if (response.status === 200 || response.status === 201) {
        afterSubmit(response.data);
        onHide();
      } else {
        setErrors({ api: 'Failed to save report section. Please try again.' });
      }
    } else {
      console.log(Object.values(newErrors));
    }
  };

  useEffect(() => {
    if (reportSection) {
      setSelectedReportSection(reportSection);
    }
    if (!show) {
      setErrors({});
    }
  }, [show, reportSection]);

  return (
    <Modal show={show} onHide={onHide} size="xl" centered backdrop="static" dialogClassName="custom-modal-size">
      <Modal.Header>
        <Modal.Title className="fw-bold">
          {selectedReportSection && selectedReportSection.name ? selectedReportSection.name : 'New Section'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {Object.keys(errors).length > 0 && (
          <Card className="mb-3">
            <Card.Body>
              {Object.values(errors).map((error, index) => (
                <li key={index} className="text-danger">
                  {error}
                </li>
              ))}
            </Card.Body>
          </Card>
        )}

        <Form.Group controlId="contentName" className="mb-3">
          <Form.Label className="fw-semibold">Name</Form.Label>
          <Form.Control
            type="text"
            placeholder="Enter content name"
            value={selectedReportSection.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
          />
        </Form.Group>

        <Form.Group controlId="contentDetails" className="mb-3">
          <Form.Label className="fw-semibold">Details</Form.Label>
          <CKEditor
            editor={ClassicEditor}
            data={selectedReportSection.details || ''}
            onChange={(event, editor) => {
              const data = editor.getData();
              handleChange('details', data);
            }}
          />
        </Form.Group>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSectionSubmit}>
          Submit
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddNewReportModal;
