import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import SuccessModal from 'views/shared-modals/SuccessModal';
import DownloadReportModal from './modals/DownloadReportModal';
import PreviewReportModal from './modals/PreviewReportModal';
import ReportSectionFormModal from './modals/ReportSectionFormModal';
import {
  updateReportTemplate,
  getDesignTemplates,
  addDesignTemplate,
  deleteDesignTemplate,
  getReportTemplateSections,
  deleteReportSection,
  addDefaultReportSections
} from 'utils/apiServices';

const ReportTemplateBuilder = ({ reportTemplate, onBack }) => {
  const [designTemplates, setDesignTemplates] = useState([]);
  const [selectedDesignTemplate, setSelectedDesignTemplate] = useState({});
  const [selectedDesignToDelete, setSelectedDesignToDelete] = useState(null);

  const [reportSections, setReportSections] = useState([]);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [activeReportSection, setActiveReportSection] = useState({});
  const [selectedReportSections, setSelectedReportSections] = useState([]);

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState({
    show: false,
    message: '',
    type: null // for template(file) or section
  });
  const [showSuccessModal, setShowSuccessModal] = useState({
    show: false,
    message: '',
    iconColor: '#2EDAB6'
  });

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFormData, setDownloadFormData] = useState({
    project: null,
    orchestration: null,
    execution: null
  });
  const [downloadErrors, setDownloadErrors] = useState({});

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewFormData, setPreviewFormData] = useState({
    project: null,
    orchestration: null,
    execution: null
  });
  const [filePreview, setFilePreview] = useState(null);

  const fetchDesignTemplates = async (reportType) => {
    try {
      const response = await getDesignTemplates({ report_type: reportType });
      if (response.status === 200 && response.data) {
        setDesignTemplates(response.data.data);
        setSelectedDesignTemplate(response.data.data.find((template) => template.id === reportTemplate.design_template.id) || {});
      } else {
        console.error('Failed to fetch design templates');
        setDesignTemplates([]);
      }
    } catch (error) {
      console.error('Error fetching design templates:', error);
      setDesignTemplates([]);
    }
  };

  const fetchReportSections = async (reportTemplate) => {
    try {
      const response = await getReportTemplateSections(reportTemplate.id);
      if (response.status === 200 && response.data) {
        setReportSections(response.data.data);
        setSelectedReportSections(response.data.data.filter((section) => reportTemplate.report_sections.includes(section.id)));
      } else {
        console.error('Failed to fetch report sections');
        setReportSections([]);
      }
    } catch (error) {
      console.error('Error fetching report sections:', error);
      setReportSections([]);
    }
  };

  useEffect(() => {
    fetchDesignTemplates(reportTemplate.report_type);
    // mark the design template as selected as per design template logic
    if (designTemplates.length > 0) {
      const defaultTemplate = designTemplates.find((template) => template.id === reportTemplate.design_template.id);
      if (defaultTemplate) {
        setSelectedDesignTemplate(defaultTemplate);
      }
    }
    fetchReportSections(reportTemplate);
  }, [reportTemplate]);

  const addNewDesignTemplate = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('organization_id', 1); // Assuming organization_id is 1 for simplicity
      formData.append('report_type', reportTemplate.report_type);
      const response = await addDesignTemplate(formData);
      if ((response.status === 201 || response.status === 200) && response.data) {
        setShowSuccessModal({
          show: true,
          message: 'Design template added successfully',
          iconColor: '#2EDAB6'
        });
        setTimeout(() => {
          setShowSuccessModal((prev) => ({ ...prev, show: false }));
          fetchDesignTemplates(reportTemplate.report_type);
        }, 2000);
      } else {
        console.error('Failed to add design template');
        setShowSuccessModal({
          show: true,
          message: 'Failed to add design template',
          iconColor: '#FF5C5C'
        });
        setTimeout(() => {
          setShowSuccessModal((prev) => ({ ...prev, show: false }));
        }, 2000);
      }
    } catch (error) {
      console.error('Error adding design template:', error);
      setShowSuccessModal({
        show: true,
        message: 'Error adding design template - ' + error.message,
        iconColor: '#FF5C5C'
      });
      setTimeout(() => {
        setShowSuccessModal((prev) => ({ ...prev, show: false }));
      }, 2000);
    }
  };

  const handleUploadDesignTemplate = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      addNewDesignTemplate(files[0]);
      e.target.value = ''; // Reset file input
    }
  };

  const handleDeleteDesignTemplate = (template) => {
    setSelectedDesignToDelete(template);
    setShowDeleteConfirmModal({ show: true, message: 'Are you sure you want to delete this Template?', type: 'template' });
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirmModal({ show: false, message: '', type: null });
  };

  const handleSubmitDelete = async () => {
    const { type } = showDeleteConfirmModal;

    let response;
    if (type === 'template') {
      const templateId = selectedDesignToDelete.id;

      response = await deleteDesignTemplate(templateId);
      if (response.status === 200) {
        setShowSuccessModal({ show: true, message: 'Template deleted successfully', iconColor: '#2EDAB6' });
        setTimeout(() => {
          setShowSuccessModal((prev) => ({ ...prev, show: false }));
          fetchDesignTemplates(reportTemplate.report_type);
        }, 2000);
      } else {
        setShowSuccessModal({ show: true, message: 'Failed to delete template', iconColor: '#FF5C5C' });
        setTimeout(() => {
          setShowSuccessModal((prev) => ({ ...prev, show: false }));
        }, 2000);
      }
      setSelectedDesignToDelete(null);
    } else if (type === 'section') {
      response = await deleteReportSection(activeReportSection.id);
      if (response.status === 200) {
        setShowSuccessModal({ show: true, message: 'Section deleted successfully', iconColor: '#2EDAB6' });
        setTimeout(() => {
          setShowSuccessModal((prev) => ({ ...prev, show: false }));
          fetchReportSections(reportTemplate);
        }, 2000);
        setActiveReportSection({});
        setSelectedReportSections(selectedReportSections.filter((s) => s.id !== activeReportSection.id));
      } else {
        setShowSuccessModal({ show: true, message: 'Failed to delete section', iconColor: '#FF5C5C' });
        setTimeout(() => {
          setShowSuccessModal((prev) => ({ ...prev, show: false }));
        }, 2000);
      }
    }

    setShowDeleteConfirmModal({ show: false, message: '', type: null });
  };

  //Report Sections
  const toggleSelectedSection = (e, section) => {
    const isChecked = e.target.checked;
    if (isChecked) {
      setSelectedReportSections((prev) => [...prev, section]);
    } else {
      setSelectedReportSections((prev) => prev.filter((s) => s.id !== section.id));
    }
  };

  const toggleSelectAllSections = (e) => {
    const isChecked = e.target.checked;
    if (isChecked) {
      setSelectedReportSections(reportSections);
    } else {
      setSelectedReportSections([]);
    }
  };

  const handleAfterSectionSubmit = () => {
    setShowAddSectionModal(false);
    setShowSuccessModal({ show: true, message: 'Report section has been added successfully', iconColor: '#2EDAB6' });
    setTimeout(() => {
      setShowSuccessModal((prev) => ({ ...prev, show: false }));
      fetchReportSections(reportTemplate);
    }, 2000);
  };

  const handleAddRecommendedSections = async () => {
    if (!reportTemplate.id || !reportTemplate.report_type) {
      setShowSuccessModal({ show: true, message: 'Report template ID and type are required', iconColor: '#FF5C5C' });
      return;
    }
    const response = addDefaultReportSections(reportTemplate.id, reportTemplate.report_type);
    if (response.status !== 200) {
      setShowSuccessModal({ show: true, message: 'Failed to add default sections', iconColor: '#FF5C5C' });
      return;
    }

    setShowSuccessModal({ show: true, message: 'Default sections added successfully', iconColor: '#2EDAB6' });
    setTimeout(() => {
      setShowSuccessModal((prev) => ({ ...prev, show: false }));
      fetchReportSections(reportTemplate);
    }, 2000);
  };

  const handleDeleteReportSection = async () => {
    if (!activeReportSection.id) {
      setShowSuccessModal({ show: true, message: 'No section selected to delete', iconColor: '#FF5C5C' });
      return;
    }
    setShowDeleteConfirmModal({ show: true, message: 'Are you sure you want to delete this Section?', type: 'section' });
  };

  // Save Report Template
  const handleSaveReportTemplate = async () => {
    const updatedTemplate = {
      ...reportTemplate,
      design_template: {
        id: selectedDesignTemplate.id,
        filepath: selectedDesignTemplate.filepath
      },
      report_sections: selectedReportSections.map((section) => section.id)
    };
    const response = await updateReportTemplate(reportTemplate.id, updatedTemplate);
    if (response.status === 200) {
      setShowSuccessModal({ show: true, message: reportTemplate.name + ' updated successfully', iconColor: '#2EDAB6' });
      setTimeout(() => {
        setShowSuccessModal((prev) => ({ ...prev, show: false }));
      }, 2000);
    } else {
      setShowSuccessModal({ show: true, message: 'Failed to save reports', iconColor: '#FF5C5C' });
      setTimeout(() => {
        setShowSuccessModal((prev) => ({ ...prev, show: false }));
      }, 2000);
    }
  };

  const resetDownloadState = () => {
    // Reset dropdowns
    setDownloadFormData({
      project: null,
      orchestration: null,
      execution: null
    });

    setDownloadErrors({});
  };

  const handleCloseDownloadModal = () => {
    setShowDownloadModal(false);
    resetDownloadState();
  };

  const handleDownloadSubmit = () => {
    const errors = {};

    if (!downloadFormData.project) errors.project = 'Project is required';
    if (!downloadFormData.orchestration) errors.orchestration = 'Orchestration is required';
    if (!downloadFormData.execution) errors.execution = 'Execution ID is required';

    if (Object.keys(errors).length > 0) {
      setDownloadErrors(errors);
      return;
    }

    console.log('Downloading with:', downloadFormData);
    setShowDownloadModal(false);
    // Reset file state
    resetDownloadState();
    setShowSuccessModal({
      show: true,
      message: 'Report has been downloaded successfully',
      iconColor: '#2EDAB6'
    });

    setTimeout(() => {
      setShowSuccessModal((prev) => ({ ...prev, show: false }));
    }, 2000);
  };

  const handlePreview = () => {
    const errors = {};
    if (!previewFormData.project) errors.project = 'Project is required';
    if (!previewFormData.orchestration) errors.orchestration = 'Orchestration is required';
    if (!previewFormData.execution) errors.execution = 'Execution ID is required';

    if (Object.keys(errors).length > 0) {
      setPreviewErrors(errors);
      return;
    }

    setPreviewErrors({});

    setFilePreview(
      <div className="report-table-bgcolor">
        <h6>Sample Report Content Preview</h6>
      </div>
    );
  };

  return (
    <div className="report-customization-wrapper">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold">Customize Report</h5>
        <Button variant="secondary" onClick={onBack}>
          <i className="feather icon-arrow-left me-2" />
          Back to List
        </Button>
      </div>

      <Card className="shadow-sm p-4">
        <p className="mb-3" style={{ opacity: 0.8 }}>
          Template - <strong>{reportTemplate.name}</strong>
        </p>
        <Row>
          {/* LEFT: Upload */}
          <Col md={3}>
            <Card className="upload-section">
              <Card className="upload-box">
                <i className="feather icon-upload text-muted mb-2 icon-lg" />
                <h6 className="text-muted mb-1">Choose a file or Drag and drop it here</h6>
                <p className="text-muted small">.html, .pdf, .docx formats, up to 50 MB</p>
                <div className="d-flex justify-content-center mt-2">
                  <Form.Label htmlFor="file-upload" className="btn btn-outline-primary mb-0">
                    Browse File
                  </Form.Label>
                  <Form.Control
                    id="file-upload"
                    type="file"
                    accept=".html,.pdf,.doc,.docx"
                    onChange={handleUploadDesignTemplate}
                    hidden
                    multiple
                  />
                </div>
              </Card>

              {designTemplates.length > 0 && (
                <div className="file-preview-container">
                  {designTemplates.map((designTemplate, index) => (
                    <Card
                      key={index}
                      onClick={() => {
                        setSelectedDesignTemplate(designTemplate); // update toggle based on whether clicked file is default or not
                      }}
                      className={`file-preview p-2 d-flex mb-2 position-relative ${designTemplate.id === selectedDesignTemplate.id ? 'selected-file' : ''}`}
                    >
                      <div className="d-flex align-items-center w-100 justify-content-between">
                        <div className="d-flex align-items-center">
                          <i className="feather icon-file-text me-2 icon-action" />
                          <div className="d-flex flex-column">
                            <span className="file-name">{designTemplate.originalname}</span>
                            <small>{designTemplate.mimetype}</small>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="link"
                        className="position-absolute end-0 top-0 p-0 mt-3 d-flex align-items-center delete-btn"
                        title="Delete"
                        disabled={designTemplates.length <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDesignTemplate(designTemplate);
                        }}
                      >
                        <i className="feather icon-trash-2 me-3 icon-action delete" />
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </Col>

          {/* RIGHT: Reports Sections */}
          <Col md={9}>
            <Card className="reports-section-card">
              <div className="section-header">
                <h6 className="mb-0 section-title text-primary">Reports Sections</h6>
                <div>
                  <Button
                    size="sm"
                    className="me-2"
                    onClick={() => {
                      setActiveReportSection({ report_template_id: reportTemplate.id, report_type: reportTemplate.report_type });
                      setShowAddSectionModal(true);
                    }}
                  >
                    + Add New
                  </Button>
                  <Button size="sm" variant="outline-secondary" onClick={handleAddRecommendedSections}>
                    + Add Recommended
                  </Button>
                </div>
              </div>

              <Row className="m-0">
                <Col md={3} className="checkbox-panel">
                  <div className="checkbox-row">
                    <Form.Check
                      type="checkbox"
                      label="Select All"
                      className="custom-checkbox-dark"
                      checked={reportSections.length > 0 && selectedReportSections.length === reportSections.length}
                      onChange={toggleSelectAllSections}
                    />
                  </div>

                  {reportSections.map((section, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActiveReportSection(section)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setActiveReportSection(section);
                        }
                      }}
                      className={`checkbox-row cursor-pointer ${activeReportSection.id == section.id ? 'active' : ''}`}
                    >
                      <Form.Check
                        type="checkbox"
                        label={section.name}
                        className="custom-checkbox-dark"
                        checked={selectedReportSections.some((s) => s.id == section.id)}
                        onChange={(e) => toggleSelectedSection(e, section)}
                      />
                    </div>
                  ))}
                </Col>

                {/* Table Display */}
                <Col md={9} className="p-3">
                  {activeReportSection && activeReportSection.id ? (
                    <>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="text-primary mb-0">{activeReportSection.name}</h6>
                        <div>
                          <Link
                            to="#"
                            className="text-primary mx-1"
                            title="Edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAddSectionModal(true);
                            }}
                          >
                            <i className="feather icon-action edit icon-edit" />
                          </Link>
                          <Link
                            to="#"
                            className="text-danger mx-2"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteReportSection();
                            }}
                          >
                            <i className="feather icon-action delete icon-trash-2" />
                          </Link>
                        </div>
                      </div>
                      <Row className="g-0 border p-3">
                        <div dangerouslySetInnerHTML={{ __html: activeReportSection.details }}></div>
                      </Row>
                    </>
                  ) : (
                    <p className="text-muted pt-3">No section selected.</p>
                  )}
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* FOOTER ACTIONS */}
        <div className="footer-action-bar">
          <Form.Check
            type="switch"
            id="defaultSwitch"
            label="Set as Default"
            checked={reportTemplate.is_default}
            onChange={(e) => handleDefaultToggle(e.target.checked)}
            className="mb-0 custom-switch-size"
            disabled={designTemplates.length <= 1 || reportTemplate.is_default}
          />

          <div>
            <Button variant="outline-primary" className="me-2" size="sm" onClick={handleSaveReportTemplate}>
              Save
            </Button>
            <Button variant="outline-secondary" className="me-2" size="sm" onClick={() => setShowPreviewModal(true)}>
              Preview
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowDownloadModal(true)}>
              Download
            </Button>
          </div>
        </div>
      </Card>
      {/* all Modals */}
      <ReportSectionFormModal
        show={showAddSectionModal}
        onHide={() => {
          setShowAddSectionModal(false);
        }}
        reportSection={activeReportSection}
        afterSubmit={handleAfterSectionSubmit}
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
      <DownloadReportModal show={showDownloadModal} onHide={handleCloseDownloadModal} reportTemplate={reportTemplate} />
      <PreviewReportModal
        show={showPreviewModal}
        onHide={() => {
          setShowPreviewModal(false);
        }}
        reportTemplate={reportTemplate}
        designTemplate={selectedDesignTemplate}
        reportSections={selectedReportSections}
      />
    </div>
  );
};

export default ReportTemplateBuilder;
