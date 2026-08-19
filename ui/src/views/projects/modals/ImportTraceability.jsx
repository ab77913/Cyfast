import React, { useEffect, useState } from 'react';
import { Modal, Form, Row, Col, Button } from 'react-bootstrap';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import SuccessModal from 'views/shared-modals/SuccessModal';
import { getTraceabilityImports, importTraceability } from 'utils/apiServices';

const importOptions = [
  { value: 'REQUIREMENT_TEST', label: 'Requirement Test' },
  { value: 'RISK_REQUIREMENT', label: 'Risk Requirement' }
];

const importSource = [
  { value: 'excel', label: 'Excel File' }
  // { value: 'csv', label: 'CSV File' }
];

const ImportTraceability = ({ show, onHide, project, afterSubmit }) => {
  const [traceabilityType, setTraceabilityType] = useState('REQUIREMENT_TEST');
  const [selectedImport, setSelectedImport] = useState(null);
  const [previousImports, setPreviousImports] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [properties, setProperties] = useState({});
  const [formError, setFormError] = useState({});
  const [fileHeaders, setFileHeaders] = useState([]);
  const [selectedHeaders, setSelectedHeaders] = useState({});

  //response object
  const [resObj, setResObj] = useState({});
  const [importStatus, setImportStatus] = useState('');
  const [importResponse, setImportResponse] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState({
    show: false,
    message: '',
    iconColor: '#2EDAB6'
  });

  const reqTestColumnHeaders = ['requirement_no', 'requirement_desc', 'test_case_no', 'test_case_desc'];
  const riskReqColumnHeaders = ['risk_no', 'risk_desc', 'severity', 'occurence', 'detection', 'rpn_number', 'requirement_no'];

  const capitalize = (sentence) => {
    return sentence
      .split(' ')
      .map((word) => {
        if (word.length === 0) {
          return ''; // Handle empty strings if present
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  const fetchPreviousTraceabilityImports = async () => {
    if (!project) return;
    const response = await getTraceabilityImports(traceabilityType, project.project_id);
    if (response.status === 200) {
      console.log('Previous imports', response.data);
      setPreviousImports(response.data);
    } else {
      setShowSuccessModal({ show: true, message: 'Failed to load previous imports', iconColor: '#FF5C5C' });
      setTimeout(() => {
        setShowSuccessModal((prev) => ({ ...prev, show: false }));
      }, 2000);
    }
  };

  useEffect(() => {
    if (!project?.project_id) return;
    fetchPreviousTraceabilityImports();
  }, [traceabilityType, project]);

  const handleChangeImportType = (option) => {
    setSelectedHeaders({});
    setTraceabilityType(option.value);
  };

  const extractFileHeaders = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const coversheet = workbook.Sheets[workbook.SheetNames[0]];
      const tracesheet = workbook.Sheets[workbook.SheetNames[1]];
      const coverData = XLSX.utils.sheet_to_json(coversheet);
      const traceHeaders = XLSX.utils.sheet_to_json(tracesheet, { header: 1 })[0];
      setFileHeaders(traceHeaders);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);

      extractFileHeaders(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = function (e) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);

      extractFileHeaders(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleClose = () => {
    onHide();
  };

  const handleFormValidation = () => {
    let formV = true;
    if (traceabilityType == 'REQUIREMENT_TEST') {
      const requiredHeaderMappings = ['requirement_no', 'requirement_desc', 'test_case_no'];
      requiredHeaderMappings.map((requiredHeaderMapping) => {
        if (!selectedHeaders.hasOwnProperty(requiredHeaderMapping) || selectedHeaders[requiredHeaderMapping] === '') {
          formV = false;
          setFormError((prevState) => ({
            ...prevState,
            [requiredHeaderMapping]: `Select ${requiredHeaderMapping}`
          }));
        }
      });
    }
    if (traceabilityType == 'RISK_REQUIREMENT') {
      const requiredHeaderMappings = ['risk_no', 'risk_desc', 'rpn_number', 'requirement_no'];
      requiredHeaderMappings.map((requiredHeaderMapping) => {
        if (!selectedHeaders.hasOwnProperty(requiredHeaderMapping) || selectedHeaders[requiredHeaderMapping] === '') {
          formV = false;
          setFormError((prevState) => ({
            ...prevState,
            [requiredHeaderMapping]: `Select ${requiredHeaderMapping}`
          }));
        }
      });
    }
    return formV;
  };

  const handleSubmit = () => {
    if (handleFormValidation()) {
      const formData = new FormData();

      formData.append('file', selectedFile);
      formData.append('project_id', project.project_id);
      formData.append('organization_id', 1);
      formData.append('type', traceabilityType);
      for (let key in selectedHeaders) {
        formData.append('headers[' + key + ']', selectedHeaders[key]);
      }
      formData.append('file_type', 'xlsx');
      formData.append('import_type', 'FULL');

      const response = importTraceability(formData);

      if (response.status === 200) {
        afterSubmit();
      } else if (response.status === 428) {
        setImportStatus('Warning');
      } else if (response.status === 500) {
        setImportStatus('ServerError');
      } else {
        setImportStatus('Error');
      }
      setImportResponse(response.data);
    }
  };

  const handleDiscard = () => {
    fetch(importResponse.callback_url_discard, {
      method: 'POST'
    })
      .then((res) => {
        onHide;
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const handleResume = () => {
    fetch(importResponse.callback_url_resume, {
      method: 'POST',
      body: JSON.stringify({
        recordsToDelete: importResponse.report.missing_entries
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then((res) => {
        afterSubmit();
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const handleSelectPreviousImport = (option) => {
    console.log('Selected Previous Import', option);
  };

  return (
    <>
      <Modal show={show} onHide={onHide} centered size="lg">
        <Modal.Header>
          <Modal.Title>Import Traceability</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Label className="fw-normal">Traceability</Form.Label>
                <Select options={importOptions} onChange={handleChangeImportType} placeholder="Select" />
              </Col>
              <Col md={6}>
                <Form.Label className="fw-normal">Import From</Form.Label>
                <Select options={importSource} onChange={setPreviousImports} placeholder="Select" />
              </Col>
            </Row>

            <div
              className={`import-dropstyle ${isDragOver ? 'drag-over' : ''}`}
              onClick={() => document.getElementById('fileInput').click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  document.getElementById('fileInput').click();
                }
              }}
              tabIndex={0}
              role="button"
            >
              <div>
                <i className="feather icon-upload icon-lg" />
              </div>
              <p className="mb-2">Choose a file or Drag & drop it here</p>
              <Button variant="outline-primary" size="sm" className="custom-button">
                Browse File
              </Button>
              <input type="file" id="fileInput" className="d-none" onChange={handleFileChange} onClick={(e) => (e.target.value = null)} />

              {selectedFile && (
                <div className="mt-2 d-flex align-items-center justify-content-center">
                  <span className="text-success me-2">{selectedFile.name}</span>
                  <i
                    className="feather icon-x text-danger"
                    style={{ cursor: 'pointer', fontSize: '1.1rem' }}
                    onClick={handleRemoveFile}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleRemoveFile();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title="Remove file"
                  />
                </div>
              )}
            </div>

            <div className="previous-versions-container mt-4">
              <h6 className="fw-semibold pb-2">Map Headers</h6>
              {traceabilityType == 'REQUIREMENT_TEST' && (
                <Row className="mb-4">
                  {reqTestColumnHeaders.map((reqTestColumnHeader, rtIdx) => (
                    <Col md={6} key={rtIdx} className="mb-2">
                      <Form.Label className="fw-normal">{capitalize(reqTestColumnHeader.replaceAll('_', ' '))}</Form.Label>
                      <Select
                        options={fileHeaders.map((header) => ({ label: header, value: header }))}
                        value={selectedHeaders.reqTestColumnHeader}
                        onChange={(option) => setSelectedHeaders((prevState) => ({ ...prevState, [reqTestColumnHeader]: option.value }))}
                        placeholder="Select"
                      />
                      {formError[reqTestColumnHeader] === undefined ? null : (
                        <p style={{ color: 'red' }}>{formError[reqTestColumnHeader]}</p>
                      )}
                    </Col>
                  ))}
                </Row>
              )}
              {traceabilityType == 'RISK_REQUIREMENT' && (
                <Row className="mb-4">
                  {riskReqColumnHeaders.map((riskReqColumnHeader, rrIdx) => (
                    <Col md={6} key={rrIdx} className="mb-2">
                      <Form.Label className="fw-normal">{capitalize(riskReqColumnHeader.replaceAll('_', ' '))}</Form.Label>
                      <Select
                        options={fileHeaders.map((header) => ({ label: header, value: header }))}
                        value={selectedHeaders.riskReqColumnHeader}
                        onChange={(option) => setSelectedHeaders((prevState) => ({ ...prevState, [riskReqColumnHeader]: option.value }))}
                        placeholder="Select"
                      />
                      {formError[riskReqColumnHeader] === undefined ? null : (
                        <p style={{ color: 'red' }}>{formError[riskReqColumnHeader]}</p>
                      )}
                    </Col>
                  ))}
                </Row>
              )}
            </div>

            <hr />

            <div className="previous-versions-container mt-4">
              <h6 className="fw-semibold">Previous versions</h6>

              <Form.Group className="mb-3" controlId="selectVersion">
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Label>Select Version</Form.Label>
                    <Select
                      options={previousImports}
                      onChange={(option) => handleSelectPreviousImport(option)}
                      placeholder="Select"
                      isClearable
                    />
                  </Col>
                </Row>
              </Form.Group>

              <div className="version-section">
                <div className="version-column">
                  <div className="label">FILE NAME</div>
                  <div className="value">{selectedImport?.file_name}</div>
                </div>

                <div className="version-column d-flex">
                  <div className="vertical-separator" />
                  <div>
                    <div className="label">AUTHOR</div>
                    <div className="value">{selectedImport?.author}</div>
                  </div>
                </div>

                <div className="version-column d-flex">
                  <div className="vertical-separator" />
                  <div>
                    <div className="label">DOCUMENT NUMBER</div>
                    <div className="value">{selectedImport?.document_no}</div>
                  </div>
                </div>
              </div>

              <div className="version-section">
                <div className="version-column">
                  <div className="label">RECORDS IMPORTED</div>
                  <div className="value">{selectedImport?.records_imported}</div>
                </div>

                <div className="version-column d-flex">
                  <div className="vertical-separator" />
                  <div>
                    <div className="label">Import DATE</div>
                    <div className="value">{selectedImport?.created_date}</div>
                  </div>
                </div>

                <div className="version-column d-flex">
                  <div className="vertical-separator" />
                  <div>
                    <div className="label">TRACEABILITY TYPE</div>
                    <div className="value">{selectedImport?.import_type}</div>
                  </div>
                </div>
              </div>
            </div>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide}>
            Go Back
          </Button>
          {importStatus == 'Error' && (
            <Button className="btn-cancle" variant="secondary" onClick={handleClose}>
              Ok
            </Button>
          )}
          {importStatus == 'ServerError' && (
            <Button className="btn-cancle" variant="secondary" onClick={handleClose}>
              Ok
            </Button>
          )}
          {importStatus == 'Warning' && (
            <>
              <Button className="btn-cancle" variant="secondary" onClick={handleResume}>
                Continue
              </Button>
              <Button className="btn-cancle" variant="secondary" onClick={handleDiscard}>
                Discard
              </Button>
            </>
          )}
          {importStatus !== 'Error' && importStatus !== 'Warning' && importStatus !== 'ServerError' && (
            <Button variant="primary" onClick={handleSubmit} disabled={!selectedFile}>
              Import
            </Button>
          )}
        </Modal.Footer>
      </Modal>
      <SuccessModal
        show={showSuccessModal.show}
        onHide={() => setShowSuccessModal((prev) => ({ ...prev, show: false }))}
        message={showSuccessModal.message}
        iconColor={showSuccessModal.iconColor}
      />
    </>
  );
};

export default ImportTraceability;
