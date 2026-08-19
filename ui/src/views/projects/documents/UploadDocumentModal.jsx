import React, { useEffect, useState } from 'react';
import { Modal, Form, Row, Col, Button, ProgressBar } from 'react-bootstrap';
import Select from 'react-select';
import PropTypes from 'prop-types';
import { getProjectDocumentTypes, uploadProjectDocument } from 'utils/apiServices';

// Fallback catalog if the API call fails; matches the backend allow-list.
const FALLBACK_DOC_TYPES = [
  { value: 'BRD', label: 'Business Requirement Document' },
  { value: 'SRS', label: 'Software Requirement Specification' },
  { value: 'FRS', label: 'Functional Specification' },
  { value: 'REGULATORY', label: 'Regulatory' },
  { value: 'SAFETY_REQUIREMENTS', label: 'Safety Requirements' },
  { value: 'EXPORTED_REQUIREMENTS', label: 'Exported Requirements' },
  { value: 'EXPORTED_TEST_CASES', label: 'Exported Test Cases' },
  { value: 'DESIGN', label: 'Design / Architecture Document' },
  { value: 'OTHER', label: 'Other' }
];

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.doc,.xlsx,.xls,.csv,.html,.htm,.md,.markdown,.txt';

/** Map API payloads to react-select `{ value, label }` pairs. */
const normalizeDocTypeOptions = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const normalized = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      if (typeof item.value === 'string' && item.label !== undefined && item.label !== null) {
        return { value: item.value, label: String(item.label) };
      }
      const code = item.code ?? item.id ?? item.type ?? item.doc_type ?? item.key ?? item.value;
      const label = item.label ?? item.name ?? item.description ?? String(code ?? '');
      if (code === undefined || code === null || code === '') return null;
      return { value: String(code).trim(), label: String(label || code).trim() };
    })
    .filter(Boolean);
  return normalized.length > 0 ? normalized : null;
};

const SELECT_MODAL_STYLES = {
  menuPortal: (base) => ({ ...base, zIndex: 20005 }),
  menu: (base) => ({ ...base, zIndex: 20005 })
};

const formatBytes = (bytes) => {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const UploadDocumentModal = ({ show, onHide, project, afterSuccess, defaultDocType = 'BRD' }) => {
  const [docTypes, setDocTypes] = useState(FALLBACK_DOC_TYPES);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [formError, setFormError] = useState({});
  const [errorMessage, setErrorMessage] = useState('');

  const [form, setForm] = useState({
    doc_type: defaultDocType,
    title: '',
    version: '',
    author: '',
    description: ''
  });

  const fetchDocTypes = async () => {
    try {
      const response = await getProjectDocumentTypes();
      if (response.status !== 200 || !response.data) return;

      let raw = response.data?.data ?? response.data;
      if (!Array.isArray(raw) && Array.isArray(raw?.data)) raw = raw.data;

      const next = normalizeDocTypeOptions(Array.isArray(raw) ? raw : null);
      if (next) setDocTypes(next);
    } catch (err) {
      // fallback already set
    }
  };

  useEffect(() => {
    if (show) {
      fetchDocTypes();
      setForm({
        doc_type: defaultDocType,
        title: '',
        version: '',
        author: '',
        description: ''
      });
      setSelectedFile(null);
      setProgress(0);
      setFormError({});
      setErrorMessage('');
    }
  }, [show, defaultDocType]);

  const handleFileSelected = (file) => {
    if (!file) return;
    setSelectedFile(file);
    setFormError((prev) => ({ ...prev, file: undefined }));
    if (!form.title) {
      setForm((prev) => ({ ...prev, title: file.name.replace(/\.[^.]+$/, '') }));
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const validate = () => {
    const errors = {};
    if (!selectedFile) errors.file = 'Please choose a file';
    if (!form.doc_type) errors.doc_type = 'Select a document type';
    if (!project?.project_id) errors.project = 'No project selected';
    setFormError(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setErrorMessage('');
    if (!validate()) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('project_id', project.project_id);
    if (project.organization_id) {
      formData.append('organization_id', project.organization_id);
    }
    formData.append('doc_type', form.doc_type);
    if (form.title) formData.append('title', form.title);
    if (form.version) formData.append('version', form.version);
    if (form.author) formData.append('author', form.author);
    if (form.description) formData.append('description', form.description);

    setUploading(true);
    setProgress(0);
    try {
      const response = await uploadProjectDocument(formData, (e) => {
        if (e.total) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      if (response.status === 200 || response.status === 201) {
        if (afterSuccess) afterSuccess(response.data?.data || response.data);
      } else {
        setErrorMessage(`Upload failed (HTTP ${response.status})`);
      }
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || 'Failed to upload document. Check that the backend is reachable.';
      setErrorMessage(msg);
    } finally {
      setUploading(false);
    }
  };

  const selectedDocType = docTypes.find((d) => d.value === form.doc_type) || null;

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      backdrop={uploading ? 'static' : true}
      enforceFocus={false}
    >
      <Modal.Header closeButton={!uploading}>
        <Modal.Title>Upload Project Document</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Label className="fw-normal">
                Document Type <span className="text-danger">*</span>
              </Form.Label>
              <Select
                inputId="upload-doc-type-select"
                classNamePrefix="react-select"
                options={docTypes}
                value={selectedDocType}
                onChange={(option) => setForm((prev) => ({ ...prev, doc_type: option?.value || '' }))}
                placeholder="Select document type"
                isDisabled={uploading}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                menuPosition="fixed"
                styles={SELECT_MODAL_STYLES}
                getOptionLabel={(opt) => (opt?.label != null ? String(opt.label) : '')}
                getOptionValue={(opt) => (opt?.value != null ? String(opt.value) : '')}
              />
              {formError.doc_type && <p className="text-danger small mb-0">{formError.doc_type}</p>}
            </Col>
            <Col md={6}>
              <Form.Label className="fw-normal">Version</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. 1.0"
                value={form.version}
                disabled={uploading}
                onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
              />
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={6}>
              <Form.Label className="fw-normal">Title</Form.Label>
              <Form.Control
                type="text"
                placeholder="Defaults to file name"
                value={form.title}
                disabled={uploading}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </Col>
            <Col md={6}>
              <Form.Label className="fw-normal">Author</Form.Label>
              <Form.Control
                type="text"
                placeholder="Document author"
                value={form.author}
                disabled={uploading}
                onChange={(e) => setForm((prev) => ({ ...prev, author: e.target.value }))}
              />
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={12}>
              <Form.Label className="fw-normal">Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Short summary or notes about this document"
                value={form.description}
                disabled={uploading}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </Col>
          </Row>

          <div
            className={`import-dropstyle ${isDragOver ? 'drag-over' : ''}`}
            onClick={() => !uploading && document.getElementById('documentFileInput').click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={uploading ? undefined : handleFileDrop}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
                document.getElementById('documentFileInput').click();
              }
            }}
            tabIndex={0}
            role="button"
          >
            <div>
              <i className="feather icon-upload icon-lg" />
            </div>
            <p className="mb-2">Choose a file or drag &amp; drop it here</p>
            <small className="text-muted d-block mb-2">Supported: PDF, DOCX, XLSX, CSV, HTML, MD, TXT</small>
            <Button variant="outline-primary" size="sm" disabled={uploading}>
              Browse File
            </Button>
            <input
              type="file"
              id="documentFileInput"
              className="d-none"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
              onClick={(e) => (e.target.value = null)}
            />

            {selectedFile && (
              <div className="mt-2 d-flex align-items-center justify-content-center">
                <span className="text-success me-2">
                  {selectedFile.name} <small className="text-muted">({formatBytes(selectedFile.size)})</small>
                </span>
                {!uploading && (
                  <i
                    className="feather icon-x text-danger"
                    style={{ cursor: 'pointer', fontSize: '1.1rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleRemoveFile();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title="Remove file"
                  />
                )}
              </div>
            )}

            {formError.file && <p className="text-danger small mb-0 mt-2">{formError.file}</p>}
          </div>

          {uploading && (
            <div className="mt-3">
              <ProgressBar now={progress} label={`${progress}%`} animated />
              <small className="text-muted">
                Uploading… parsing &amp; indexing will continue in the background after upload completes.
              </small>
            </div>
          )}

          {errorMessage && <div className="mt-3 alert alert-danger py-2 mb-0">{errorMessage}</div>}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={uploading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!selectedFile || uploading}>
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

UploadDocumentModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  project: PropTypes.object,
  afterSuccess: PropTypes.func,
  defaultDocType: PropTypes.string
};

export default UploadDocumentModal;
