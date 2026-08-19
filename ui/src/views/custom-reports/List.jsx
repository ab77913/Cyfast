import React, { useState, useMemo, useEffect } from 'react';
import { Row, Col, Table, Form, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Pagination } from 'react-bootstrap';
import ReportTemplateBuilder from './TemplateBuilder';
import Select from 'react-select';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import SuccessModal from 'views/shared-modals/SuccessModal';
import CreateReportTemplateModal from './modals/CreateReportTemplateModal';
import { getReportTemplates, deleteReportTemplate } from 'utils/apiServices';

const List = () => {
  const [reportTemplates, setReportTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState({ value: '', label: 'By Type' });
  const [showTemplateFormModal, setShowTemplateFormModal] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState({
    show: false,
    message: '',
    iconColor: '#2EDAB6'
  });
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState({
    show: false,
    message: ''
  });

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'builder'

  const fetchReportTemplates = async () => {
    try {
      const response = await getReportTemplates();
      console.log('Fetched Report Templates:', response.data);
      if (response.status === 200 && response.data) {
        setReportTemplates(response.data.data);
      } else {
        console.error('Failed to fetch report templates');
        setReportTemplates([]);
      }
    } catch (error) {
      console.error('Error fetching report templates:', error);
    }
  };

  // get Report templates Api call
  useEffect(() => {
    fetchReportTemplates();
  }, []);

  // Filter reports based on search term and report type
  const filteredReports = useMemo(() => {
    let filtered = reportTemplates.filter(
      (report) =>
        report.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (reportTypeFilter.value ? report.type === reportTypeFilter.value : true)
    );
    return filtered;
  }, [reportTemplates, searchTerm, reportTypeFilter]);

  const handleToggle = (id) => {
    console.log(`Toggled default status for report ID: ${id}`);
    setReportList((prevList) => prevList.map((report) => (report.id === id ? { ...report, isDefault: !report.isDefault } : report)));
  };

  if (viewMode === 'builder' && selectedTemplate) {
    return <ReportTemplateBuilder reportTemplate={selectedTemplate} onBack={() => setViewMode('list')} />;
  }

  const selectStyles = {
    control: (base) => ({
      ...base,
      minHeight: 38,
      height: 38,
      fontSize: '0.875rem'
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999
    })
  };

  const handleModalCancel = () => {
    setShowTemplateFormModal(false);
    setErrors({});
  };

  const handleEditAction = (report) => {
    setSelectedTemplate(report);
    setViewMode('builder');
  };

  const afterTemplateSubmitSuccess = (report) => {
    setShowTemplateFormModal(false);
    setSelectedTemplate(report);
    setViewMode('builder');
  };

  // Delete report action
  const handleDeleteReportAction = (report) => {
    setSelectedTemplate(report);
    setShowDeleteConfirmModal({ show: true, message: 'Are you sure you want to delete this Template?' });
  };

  const handleSubmitDelete = async () => {
    if (!selectedTemplate) return;
    const response = await deleteReportTemplate(selectedTemplate.id);
    if (response.status === 200) {
      setShowDeleteConfirmModal(false);
      setShowSuccessModal({ show: true, message: 'Template deleted successfully', iconColor: '#2EDAB6' });
      setTimeout(() => {
        setShowSuccessModal((prev) => ({ ...prev, show: false }));
        setSelectedTemplate({});
        fetchReportTemplates();
      }, 2000);
    } else {
      setShowSuccessModal({ show: true, message: 'Failed to delete template', iconColor: '#FF5C5C' });
      setTimeout(() => {
        setShowSuccessModal((prev) => ({ ...prev, show: false }));
      }, 2000);
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirmModal(false);
    setSelectedTemplate({});
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold">Reports</h5>
        <Button variant="primary" onClick={() => setShowTemplateFormModal(true)}>
          <i className="feather icon-plus me-2" />
          Create New Report
        </Button>
      </div>

      {/* Table */}
      <div>
        {/* Search & Filter */}
        <Row className="mb-3">
          <Col md={3}>
            <div className="input-group">
              <Form.Control
                type="search"
                placeholder="Search by Report Name"
                value={searchTerm}
                className="search-input"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="input-group-text bg-white">
                <i className="feather icon-search light-icon" />
              </span>
            </div>
          </Col>
          <Col md={2}>
            <Select
              classNamePrefix="select"
              name="status"
              options={[
                { value: '', label: 'By Type' },
                { value: 'TEST_SUMMARY', label: 'Test Summary' },
                { value: 'ORCHESTRATION_EXECUTION_LOG', label: 'Orchestration Execution Log' },
                { value: 'ORCHESTRATION_TEST_SUMMARY', label: 'Orchestration Test Summary' },
                { value: 'CONSOLE_LOG', label: 'Console Log' }
              ]}
              onChange={(selected) => setReportTypeFilter(selected)}
              className="bg-white"
              placeholder="By Type"
              menuPortalTarget={document.body}
              styles={selectStyles}
            />
          </Col>
        </Row>

        {/* Table */}
        <div className="table-responsive">
          <Table hover className="custom-cyfast-table">
            <thead className="table-light">
              <tr>
                <th className="col-sno">S.No.</th>
                <th>Report Name</th>
                <th>Report Type</th>
                <th>Created Date</th>
                <th className="set-default-header">Set As Default</th>

                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report, index) => (
                <tr key={report.id}>
                  <td className="align-middle col-sno">{index + 1}</td>
                  <td className="text-start align-middle">{report.name}</td>
                  <td className="text-start align-middle">{report.report_type}</td>
                  <td className="text-start align-middle">{report.createdDate}</td>
                  <td className="text-center align-middle">
                    <Form.Check
                      type="switch"
                      id={`default-switch-${report.report_template_id}`}
                      checked={report.is_default}
                      onChange={() => handleToggle(report.report_template_id)}
                      className="custom-switch-lg"
                    />
                  </td>

                  <td className="text-center">
                    <Link
                      to="#"
                      className="text-primary mx-1"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAction(report);
                      }}
                    >
                      <i className="feather icon-edit icon-action edit" />
                    </Link>
                    <Link
                      to="#"
                      className="text-danger mx-1"
                      title="Delete"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteReportAction(report);
                      }}
                    >
                      <i className="feather icon-trash-2 icon-action delete" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="d-flex justify-content-center mt-3">
          <Pagination>
            <Pagination.First />
            <Pagination.Prev />
            <Pagination.Item active>{1}</Pagination.Item>
            <Pagination.Item>{2}</Pagination.Item>
            <Pagination.Next />
            <Pagination.Last />
          </Pagination>
        </div>
      </div>

      {/* Modals */}
      <CreateReportTemplateModal
        show={showTemplateFormModal}
        onHide={handleModalCancel}
        template={selectedTemplate}
        afterSuccess={afterTemplateSubmitSuccess}
      />
      <ConfirmDeleteModal
        show={showDeleteConfirmModal.show}
        onHide={handleCloseDeleteModal}
        onSubmit={handleSubmitDelete}
        message={showDeleteConfirmModal.message}
      />
      <SuccessModal
        show={showSuccessModal.show}
        onHide={() => setShowSuccessModal((prev) => ({ ...prev, show: false }))}
        message={showSuccessModal.message}
        iconColor={showSuccessModal.iconColor}
      />
    </div>
  );
};

export default List;
