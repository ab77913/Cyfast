import React, { useState, useRef, useEffect } from 'react';
import { Row, Col, Form, Button, Table, Modal } from 'react-bootstrap';
import Select from 'react-select';
import { getStatusBadge, sortOptions } from 'data/listData';
import { FormattedMessage } from 'react-intl';
import { useSelectedProject } from 'contexts/ProjectContext';
import ProjectHeader from '../ProjectHeader';
import SuccessModal from 'views/shared-modals/SuccessModal';
import ImportTraceability from '../modals/ImportTraceability';
import ExportTraceability from '../modals/ExportTraceability';
import { getTraceability } from 'utils/apiServices';

const TestCaseTraceability = () => {
  const [selectedProject, setSelectedProject] = useState({});
  const [traceData, setTraceData] = useState([]);

  const [showImportTraceabilityModal, setShowImportTraceabilityModal] = useState(false);
  const [showExportTraceabilityModal, setShowExportTraceabilityModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successIconColor, setSuccessIconColor] = useState('');

  const [sortBy, setSortBy] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const exportButtonRef = useRef(null);

  const { selectedProjectInContext, setSelectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;

  const fetchTraceability = async (direction) => {
    try {
      const response = await getTraceability(project.project_id, direction);
      if (response.status === 200) {
        setTraceData(response.data);
      } else {
        console.log('Failed to fetch traceability info');
        setTraceData([]);
      }
    } catch (error) {
      console.error('Error fetching test sources:', error);
    }
  };

  useEffect(() => {
    if (!project) return;

    if (project?.project_id) fetchTraceability('FORWARD');
  }, [project]);

  const filteredTraceData = traceData.filter((trace) => {
    //const matchesStatus = !sortBy || !sortBy.value || trace.status.toUpperCase() === sortBy.value;
    const matchesSearch = trace.Requirement.requirement_no.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const afterImportSuccess = () => {};
  const handleImportTraceabilityModal = () => setShowImportTraceabilityModal(true);
  const handleCloseImportModal = () => setShowImportTraceabilityModal(false);

  const afterExportSuccess = () => {};
  const handleExportTraceabilityModal = () => setShowExportTraceabilityModal(true);
  const handleCloseExportModal = () => setShowExportTraceabilityModal(false);

  const handleDownload = () => {
    console.log('Exporting...', exportFrom, exportFormat);
    //cal api here for download...
    setShowExportModal(false);
  };

  return (
    <div className="container-fluid p-1 container-root">
      {/* Header */}
      <ProjectHeader project={project} breadcrumbs="traceability" />
      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="section-title">
          <FormattedMessage id="traceability" />
        </div>

        <Row className="align-items-center mb-3">
          <Col md="auto" className="d-flex align-items-center">
            <label className="form-label fw-semibold mb-0 me-2 status">Status</label>
            <div className="select-wrapper">
              <Select
                classNamePrefix="select"
                name="sort"
                options={sortOptions}
                value={sortBy}
                onChange={(selectedOption) => setSortBy(selectedOption)}
                placeholder="All"
                menuPortalTarget={document.body}
              />
            </div>
          </Col>

          <Col md={4} className="d-flex align-items-center ms-4">
            <div className="input-group">
              <Form.Control
                type="search"
                placeholder="Search Test Case"
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
            <Button
              ref={exportButtonRef}
              variant="outline-primary"
              className="me-3 custom-button"
              onClick={(e) => {
                e.stopPropagation();
                handleExportTraceabilityModal();
              }}
            >
              Export
            </Button>

            <Button
              variant="primary"
              onClick={(e) => {
                e.stopPropagation();
                handleImportTraceabilityModal();
              }}
            >
              Import
            </Button>
          </Col>
        </Row>

        <div className="scroll-container">
          <Table responsive hover className="align-middle mb-0 traceability-list">
            <thead className="thead-light">
              <tr>
                <th>REQUIREMENT</th>
                <th>TEST CASE</th>
                <th>RISK</th>
                <th>TEST STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredTraceData.map((trace, index) => (
                <tr key={index}>
                  <td className="fw-semibold col-2">
                    <p>{trace.Requirement.requirement_no}</p>
                    <p>{trace.Requirement.requirement_name}</p>
                  </td>
                  <td>
                    {trace.Test?.map((traceTest, tidx) => (
                      <div key={tidx}>
                        <p>{traceTest.test_case_no}</p>
                        <p style={{ whiteSpace: 'normal', wordWrap: 'break-word' }}>{traceTest.test_case_name}</p>
                      </div>
                    ))}
                  </td>
                  <td>
                    {trace.Risk?.map((traceRisk, tidx) => (
                      <div key={tidx}>
                        <p>{traceRisk.risk_no}</p>
                        <div style={{ whiteSpace: 'normal', wordWrap: 'break-word' }}>{traceRisk.risk_name}</div>
                      </div>
                    ))}
                  </td>
                  <td>
                    {trace.TestStatus?.map((traceTestStatus, tidx) => (
                      <div key={tidx}>
                        <p>{getStatusBadge(traceTestStatus.status)}</p>
                        <p>
                          <span className="me-3">{traceTestStatus.orchestration_name}</span>
                        </p>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      <SuccessModal
        show={showSuccessModal}
        onHide={() => setShowSuccessModal(false)}
        message={successMessage}
        iconColor={successIconColor}
      />
      <ImportTraceability
        show={showImportTraceabilityModal}
        onHide={handleCloseImportModal}
        project={project}
        afterSubmit={afterImportSuccess}
      />
      <ExportTraceability
        show={showExportTraceabilityModal}
        onHide={handleCloseExportModal}
        project={project}
        afterSubmit={afterExportSuccess}
      />
    </div>
  );
};

export default TestCaseTraceability;
