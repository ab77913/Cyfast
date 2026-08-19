import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Row, Col, Form, Button, Table, Badge } from 'react-bootstrap';
import Select from 'react-select';
import { FormattedMessage } from 'react-intl';
import ProjectHeader from '../ProjectHeader';
import { useSelectedProject } from 'contexts/ProjectContext';
import {
  getProjectDocuments,
  getProjectDocumentTypes,
  deleteProjectDocument,
  reparseProjectDocument,
  getProjectDocumentDownloadUrl
} from 'utils/apiServices';
import UploadDocumentModal from './UploadDocumentModal';
import SuccessModal from 'views/shared-modals/SuccessModal';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import ListPagination from 'views/shared/ListPagination';

const STATUS_BADGE_MAP = {
  UPLOADED: { variant: 'info', label: 'Uploaded' },
  PARSING: { variant: 'inprogress', label: 'Parsing' },
  PARSED: { variant: 'inprogress', label: 'Parsed' },
  INDEXED: { variant: 'passed', label: 'Indexed' },
  FAILED: { variant: 'error', label: 'Failed' },
  DELETED: { variant: 'secondary', label: 'Deleted' }
};

const formatBytes = (bytes) => {
  if (!bytes) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDateTime = (val) => {
  if (!val) return '-';
  try {
    const dt = new Date(val);
    return `${dt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })}, ${dt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })}`;
  } catch (e) {
    return val;
  }
};

const getStatusBadge = (status) => {
  const cfg = STATUS_BADGE_MAP[status] || { variant: 'secondary', label: status || '-' };
  return (
    <Badge bg={cfg.variant} className="status-badge">
      {cfg.label}
    </Badge>
  );
};

const DEFAULT_PAGE_SIZE = 25;

const Documents = () => {
  const { selectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;

  const documentsRef = useRef([]);

  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [docTypes, setDocTypes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDocType, setFilterDocType] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [successInfo, setSuccessInfo] = useState({ show: false, message: '', iconColor: '#2EDAB6' });

  const fetchDocTypes = async () => {
    try {
      const response = await getProjectDocumentTypes();
      if (response.status === 200 && Array.isArray(response.data?.data)) {
        setDocTypes(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch document types:', err);
    }
  };

  const fetchDocuments = useCallback(async (silent = false) => {
    if (!project?.project_id) return;
    if (!silent) setIsLoading(true);
    try {
      const filters = { project_id: project.project_id };
      if (filterDocType?.value) filters.doc_type = filterDocType.value;
      const response = await getProjectDocuments(filters, listPage, pageSize);
      setDocuments(response.data?.data || []);
      setPagination(response.data?.pagination || null);
    } catch (err) {
      console.error('Failed to fetch project documents:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [project?.project_id, filterDocType, listPage, pageSize]);

  documentsRef.current = documents;

  useLayoutEffect(() => {
    setListPage(1);
  }, [project?.project_id, filterDocType]);

  useEffect(() => {
    fetchDocTypes();
  }, []);

  useEffect(() => {
    if (!project?.project_id) return;
    fetchDocuments();
    const intervalId = setInterval(() => {
      const list = documentsRef.current;
      const hasPending = list.some((d) => d.status === 'UPLOADED' || d.status === 'PARSING');
      if (hasPending) fetchDocuments(true);
    }, 4000);
    return () => clearInterval(intervalId);
  }, [project?.project_id, filterDocType, listPage, pageSize, fetchDocuments]);

  const docTypeFilterOptions = useMemo(() => [{ value: '', label: 'All Types' }, ...docTypes], [docTypes]);

  const filteredDocs = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    return documents.filter((d) => {
      if (d.deleted_date) return false;
      if (!term) return true;
      return (
        (d.title || '').toLowerCase().includes(term) ||
        (d.original_filename || '').toLowerCase().includes(term) ||
        (d.author || '').toLowerCase().includes(term) ||
        (d.version || '').toLowerCase().includes(term) ||
        (d.doc_type || '').toLowerCase().includes(term)
      );
    });
  }, [documents, searchTerm]);

  const docTypeLabel = (value) => {
    const match = docTypes.find((d) => d.value === value);
    return match ? match.label : value;
  };

  const handleAfterUpload = (newDoc) => {
    setShowUploadModal(false);
    setSuccessInfo({
      show: true,
      message: `Document "${newDoc?.title || newDoc?.original_filename || ''}" uploaded successfully.`,
      iconColor: '#2EDAB6'
    });
    setTimeout(() => setSuccessInfo((p) => ({ ...p, show: false })), 2000);
    fetchDocuments(true);
  };

  const handleAskDelete = (doc) => {
    setDocToDelete(doc);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    try {
      await deleteProjectDocument(docToDelete.project_document_id);
      setShowDeleteModal(false);
      setSuccessInfo({
        show: true,
        message: `Document "${docToDelete.title || docToDelete.original_filename}" deleted.`,
        iconColor: '#FF5C5C'
      });
      setTimeout(() => setSuccessInfo((p) => ({ ...p, show: false })), 2000);
      setDocToDelete(null);
      fetchDocuments(true);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleReparse = async (doc) => {
    try {
      await reparseProjectDocument(doc.project_document_id);
      fetchDocuments(true);
    } catch (err) {
      console.error('Reparse failed:', err);
    }
  };

  return (
    <div className="container-fluid p-1 container-root">
      <ProjectHeader project={project} breadcrumbs="documents" />

      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="section-title">
          <FormattedMessage id="documents" />
        </div>

        <Row className="align-items-center mb-3">
          <Col md="auto" className="d-flex align-items-center">
            <label className="form-label fw-semibold mb-0 me-2 status">Type</label>
            <div className="select-wrapper" style={{ minWidth: 220 }}>
              <Select
                classNamePrefix="select"
                name="doc-type-filter"
                options={docTypeFilterOptions}
                value={filterDocType}
                onChange={(opt) => setFilterDocType(opt && opt.value ? opt : null)}
                placeholder="All Types"
                isClearable
                menuPortalTarget={document.body}
              />
            </div>
          </Col>

          <Col md={4} className="d-flex align-items-center">
            <div className="input-group">
              <Form.Control
                type="search"
                placeholder="Search by title, filename, author"
                value={searchTerm}
                className="search-input"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="input-group-text bg-white">
                <i className="feather icon-search light-icon" />
              </span>
            </div>
          </Col>

          <Col className="text-end d-flex justify-content-end align-items-center">
            <Button variant="outline-primary" className="me-3" onClick={() => fetchDocuments()} disabled={isLoading}>
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </Button>

            <Button variant="primary" disabled={!project?.project_id} onClick={() => setShowUploadModal(true)}>
              Upload Document
            </Button>
          </Col>
        </Row>

        <div className="scroll-container">
          <Table responsive hover className="align-middle mb-0">
            <thead className="thead-light">
              <tr>
                <th>TITLE</th>
                <th>TYPE</th>
                <th>VERSION</th>
                <th>FILE</th>
                <th>SIZE</th>
                <th>CHUNKS</th>
                <th>STATUS</th>
                <th>UPLOADED</th>
                <th className="text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-4">
                    No documents uploaded yet for this project.
                  </td>
                </tr>
              )}

              {filteredDocs.map((doc) => (
                <tr key={doc.project_document_id}>
                  <td className="fw-semibold">
                    {doc.title || doc.original_filename}
                    {doc.description && <div className="text-muted small">{doc.description}</div>}
                  </td>
                  <td>
                    <Badge bg="secondary" className="status-badge">
                      {docTypeLabel(doc.doc_type)}
                    </Badge>
                  </td>
                  <td>{doc.version || '-'}</td>
                  <td className="text-muted small">{doc.original_filename}</td>
                  <td className="text-muted small">{formatBytes(doc.file_size)}</td>
                  <td className="text-muted small">{doc.chunk_count ?? 0}</td>
                  <td>
                    {getStatusBadge(doc.status)}
                    {doc.status === 'FAILED' && doc.parse_status_detail && (
                      <div className="text-danger small mt-1" title={doc.parse_status_detail}>
                        {doc.parse_status_detail.slice(0, 60)}
                        {doc.parse_status_detail.length > 60 ? '…' : ''}
                      </div>
                    )}
                  </td>
                  <td className="text-muted small">
                    {formatDateTime(doc.created_date)}
                    {doc.created_by && <div className="text-muted small">by {doc.created_by}</div>}
                  </td>
                  <td className="text-center">
                    <a
                      className="text-primary mx-1"
                      title="Download"
                      href={getProjectDocumentDownloadUrl(doc.project_document_id)}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="feather icon-download icon-action" />
                    </a>
                    <a
                      className="text-secondary mx-1"
                      title="Reparse"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleReparse(doc);
                      }}
                    >
                      <i className="feather icon-refresh-cw icon-action" />
                    </a>
                    <a
                      className="text-danger mx-2"
                      title="Delete"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAskDelete(doc);
                      }}
                    >
                      <i className="feather icon-action delete icon-trash-2" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <ListPagination
          pagination={pagination}
          pageSize={pageSize}
          onPageChange={(p) => setListPage(p)}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setListPage(1);
          }}
        />
      </div>

      <UploadDocumentModal
        show={showUploadModal}
        onHide={() => setShowUploadModal(false)}
        project={project}
        afterSuccess={handleAfterUpload}
        defaultDocType={filterDocType?.value || 'BRD'}
      />

      <ConfirmDeleteModal
        show={showDeleteModal}
        onHide={() => {
          setShowDeleteModal(false);
          setDocToDelete(null);
        }}
        onSubmit={handleConfirmDelete}
        toDelete={docToDelete?.title || docToDelete?.original_filename}
      />

      <SuccessModal
        show={successInfo.show}
        onHide={() => setSuccessInfo((p) => ({ ...p, show: false }))}
        message={successInfo.message}
        iconColor={successInfo.iconColor}
      />
    </div>
  );
};

export default Documents;
