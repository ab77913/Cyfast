import React, { useEffect, useState } from 'react';
import { Modal, Form, Row, Col, Button } from 'react-bootstrap';
import Select from 'react-select';
import SuccessModal from 'views/shared-modals/SuccessModal';
import { exportTraceability } from 'utils/apiServices';

const ExportTraceability = ({ show, onHide, project, afterSubmit }) => {
  const [traceabilityType, setTraceabilityType] = useState({ value: 'REQUIREMENT_TEST', label: 'Requirements Traceability' });
  const [exportFormat, setExportFormat] = useState({ value: 'EXCEL', label: 'Excel' });

  const traceabilityTypeOptions = [
    { value: 'REQUIREMENT_TEST', label: 'Requirements-Test Traceability' },
    { value: 'RISK_REQUIREMENT', label: 'Risk-Requirement Traceability' },
    { value: 'RISK_REQUIREMENT_TEST', label: 'End-to-End Traceability' }
  ];

  const exportFormatOptions = [
    { value: 'xlsx', label: 'Excel' },
    { value: 'csv', label: 'CSV' }
  ];

  const handleDownload = async () => {
    try {
      const response = await exportTraceability(project.project_id, traceabilityType.value, exportFormat.value);
      if (response.status === 200) {
        // Handle file download with same name sent by backend
        const blob = new Blob([response.data], { type: response.headers['content-type'] });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        const contentDisposition = response.headers['content-disposition'];
        link.download = contentDisposition ? contentDisposition.split('filename=')[1].replaceAll('"', '') : 'traceability_export';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error exporting traceability:', error);
    }
  };

  return (
    <>
      <Modal show={show} onHide={onHide} centered>
        <Modal.Header closeButton>
          <Modal.Title>Export Traceability</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label fw-normal">Export From</label>
            <Select
              options={traceabilityTypeOptions}
              value={traceabilityType}
              onChange={(selected) => setTraceabilityType(selected)}
              placeholder="Select Export From"
              classNamePrefix="select"
            />
          </div>

          <div className="mb-3">
            <label className="form-label fw-normal">Export Format</label>
            <Select
              options={exportFormatOptions}
              value={exportFormat}
              onChange={(selected) => setExportFormat(selected)}
              placeholder="Select Export Format"
              classNamePrefix="select"
            />
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="primary" onClick={handleDownload}>
            Download
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ExportTraceability;
