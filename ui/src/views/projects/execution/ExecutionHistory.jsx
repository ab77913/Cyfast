import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Button, DropdownButton, Dropdown, ButtonGroup } from 'react-bootstrap';
import Select from 'react-select';
import { getStatusBadge, sortOptions } from 'data/listData';
import { FormattedMessage } from 'react-intl';
import ProjectHeader from '../ProjectHeader';
import { useSelectedProject } from 'contexts/ProjectContext';
import { getProjectExecutionHistory, generateReport } from 'utils/apiServices';

const ExecutionHistory = () => {
  const [execHistory, setExecHistory] = useState([]);
  const [isHoveringRefresh, setIsHoveringRefresh] = useState(false);
  const [sortBy, setSortBy] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { selectedProjectInContext, setSelectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;

  const fetchExecutionHistory = async (projectId) => {
    try {
      const response = await getProjectExecutionHistory(projectId);
      if (response && response.status === 200) {
        setExecHistory(response.data);
      } else {
        console.error('Failed to fetch execution history');
      }
    } catch (error) {
      console.error('Error fetching execution history:', error);
    }
  };

  useEffect(() => {
    if (!project || !project.project_id) return;

    fetchExecutionHistory(project.project_id);
  }, [project]);

  const filteredHistory = execHistory.filter((item) => {
    const matchesStatus = !sortBy || !sortBy.value || item.status.toUpperCase() === sortBy.value;
    const matchesSearch =
      item.orchestration_execution_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.orchestration_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const downloadReport = async (reportType, projectId, orchestrationId, executionId) => {
    let filters = {};
    if (projectId) filters.project_id = projectId;
    if (orchestrationId) filters.orchestration_id = orchestrationId;
    if (executionId) filters.execution_id = executionId;

    const response = await generateReport(null, reportType, filters);
    if (response.status === 200 && response.data) {
      let fileName = reportType;
      if (executionId) fileName += `_${executionId}`;
      else if (orchestrationId) fileName += `_${orchestrationId}`;
      else if (projectId) fileName += `_${projectId}`;
      fileName += `_${Date.now()}.pdf`;

      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      console.error('Failed to download report - ' + reportTemplate.name);
    }
  };

  // Helper function to convert seconds to HH:MM:SS
  const formatSecondsToHHMMSS = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '';
    const h = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="container-fluid p-1 container-root">
      {/* Header */}
      <ProjectHeader project={project} breadcrumbs="history" />

      {/* Table Card */}
      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="section-title">Execution History</div>

        <Row className="align-items-center mb-3">
          {/* Filter */}
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

          {/* Search Field */}
          <Col md={4} className="d-flex align-items-center ms-4">
            <div className="input-group">
              <Form.Control
                type="search"
                placeholder="Search Orchestration"
                value={searchTerm}
                className="search-input"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="input-group-text bg-white">
                <i className="feather icon-search light-icon" />
              </span>
            </div>
          </Col>

          {/* Buttons */}
          <Col className="text-end d-flex justify-content-end align-items-center">
            <Button
              variant="outline-primary"
              className="me-3"
              onMouseEnter={() => setIsHoveringRefresh(true)}
              onMouseLeave={() => setIsHoveringRefresh(false)}
              onClick={() => downloadReport('TEST_SUMMARY', project.project_id)}
            >
              <i className="feather icon-download me-1" /> Test Summary Report
            </Button>
          </Col>
        </Row>

        {/* row header */}
        <div className="d-none d-md-grid py-2 px-3 history-header">
          <div className="flexCenter">
            EXECUTION <br /> INSTANCE ID
          </div>
          <div className="flexCenter">
            {' '}
            ORCHESTRATION <br /> NAME
          </div>
          <div className="flexCenter">
            {' '}
            START DATE <br /> AND TIME
          </div>
          <div className="flexCenter">
            {' '}
            EXECUTION DURATION
            <br />
            (HH:MM:SS)
          </div>
          <div className="flexCenter">STATUS</div>
          <div className="flexCenter justify-center">ACTIONS</div>
        </div>

        {/* rows */}
        {filteredHistory.map((item, index) => (
          <div key={index} className="history-row">
            <div className="exec-instance-id">{item.orchestration_execution_id}</div>
            <div>{item.orchestration_name}</div>
            <div>{item.start_time}</div>
            <div>{formatSecondsToHHMMSS(item.elapsed_time)}</div>
            <div>{getStatusBadge(item.status)}</div>
            <div className="text-end">
              <DropdownButton
                as={ButtonGroup}
                title={
                  <>
                    <i className="feather icon-download me-1" /> Downloads
                  </>
                }
                variant="outline-primary"
                size="sm"
                id="dropdown-custom-download"
                className="text-capitalize custom-outline-button"
              >
                <Dropdown.Item eventKey="1">
                  <div
                    onClick={() =>
                      downloadReport(
                        'ORCHESTRATION_TEST_SUMMARY',
                        project.project_id,
                        item.orchestration_id,
                        item.orchestration_execution_id
                      )
                    }
                  >
                    Orchestration Summary
                  </div>
                </Dropdown.Item>
                <Dropdown.Item eventKey="2">
                  <div
                    onClick={() =>
                      downloadReport(
                        'ORCHESTRATION_EXECUTION_LOG',
                        project.project_id,
                        item.orchestration_id,
                        item.orchestration_execution_id
                      )
                    }
                  >
                    Execution Log
                  </div>
                </Dropdown.Item>
                <Dropdown.Item eventKey="3">
                  <div
                    onClick={() =>
                      downloadReport('CONSOLE_LOG', project.project_id, item.orchestration_id, item.orchestration_execution_id)
                    }
                  >
                    Console Log
                  </div>
                </Dropdown.Item>
              </DropdownButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExecutionHistory;
