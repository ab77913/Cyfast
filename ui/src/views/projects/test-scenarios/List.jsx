import React, { useCallback, useState, useEffect, useLayoutEffect } from 'react';
import { Row, Col, Form, Button, Table, Tabs, Tab } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';

import ProjectHeader from '../ProjectHeader';
import { useSelectedProject } from 'contexts/ProjectContext';
import { getTestScenarios } from 'utils/apiServices';
import ListPagination from 'views/shared/ListPagination';

import GenerateTab from './GenerateTab';
import PendingTab from './PendingTab';

const DEFAULT_PAGE_SIZE = 25;

const TestScenarios = () => {
  const [rows, setRows] = useState([]);
  const [listPagination, setListPagination] = useState(null);
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [mainTab, setMainTab] = useState('active');
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0);
  const [activeRefreshToken, setActiveRefreshToken] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const { selectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;

  const fetchScenarios = useCallback(async () => {
    if (!project?.project_id) return;
    try {
      const response = await getTestScenarios(
        { project_id: project.project_id },
        { page: listPage, size: pageSize }
      );
      setRows(response.data?.data || []);
      setListPagination(response.data?.pagination || null);
    } catch (error) {
      console.error('Failed to fetch test scenarios:', error);
      setRows([]);
      setListPagination(null);
    }
  }, [project?.project_id, listPage, pageSize, activeRefreshToken]);

  useLayoutEffect(() => {
    setListPage(1);
  }, [project?.project_id]);

  useEffect(() => {
    if (!project?.project_id) return;
    fetchScenarios();
  }, [fetchScenarios, project?.project_id]);

  const filteredRows = rows.filter((r) => {
    const term = searchTerm.toLowerCase();
    const no = String(r.scenario_no || '').toLowerCase();
    const title = String(r.title || '').toLowerCase();
    const typ = String(r.scenario_type || '').toLowerCase();
    const obj = String(r.objective || '').toLowerCase();
    const rn = String(r.requirement?.requirement_no || '').toLowerCase();
    return no.includes(term) || title.includes(term) || typ.includes(term) || obj.includes(term) || rn.includes(term);
  });

  const reqLabel = (r) => r.requirement?.requirement_no || r.requirement_id || '';

  const automationCell = (r) =>
    r.automation_possibility_score != null ? String(r.automation_possibility_score) : '—';

  const activeTabContent = (
    <>
      <Row className="align-items-center mb-3">
        <Col md={4} className="d-flex align-items-center">
          <div className="input-group">
            <Form.Control
              type="search"
              placeholder="Search scenarios"
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
          <Button variant="outline-primary" className="me-3" onClick={() => fetchScenarios()}>
            Refresh
          </Button>
        </Col>
      </Row>

      <div className="scroll-container">
        <Table responsive hover className="align-middle mb-0">
          <thead className="thead-light">
            <tr>
              <th>
                <FormattedMessage id="test-scenarios-col-no" defaultMessage="SCENARIO NO" />
              </th>
              <th>
                <FormattedMessage id="test-scenarios-col-type" defaultMessage="TYPE" />
              </th>
              <th>
                <FormattedMessage id="test-scenarios-col-req" defaultMessage="REQ NO" />
              </th>
              <th>
                <FormattedMessage id="test-scenarios-col-title" defaultMessage="TITLE" />
              </th>
              <th>
                <FormattedMessage id="test-scenarios-col-priority" defaultMessage="PRIORITY" />
              </th>
              <th className="text-center">
                <FormattedMessage id="test-scenarios-col-auto" defaultMessage="AUTO %" />
              </th>
              <th>
                <FormattedMessage id="test-scenarios-col-objective" defaultMessage="OBJECTIVE" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.test_scenario_id}>
                <td className="fw-semibold small">{r.scenario_no}</td>
                <td className="small">{r.scenario_type}</td>
                <td className="small">{reqLabel(r)}</td>
                <td>{r.title}</td>
                <td className="small">{r.priority}</td>
                <td className="small text-center">{automationCell(r)}</td>
                <td className="small text-muted" style={{ maxWidth: '360px', whiteSpace: 'pre-wrap' }}>
                  {(r.objective || '').slice(0, 400)}
                  {(r.objective || '').length > 400 ? '…' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <ListPagination
        pagination={listPagination}
        pageSize={pageSize}
        onPageChange={(p) => setListPage(p)}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setListPage(1);
        }}
      />
    </>
  );

  return (
    <div className="container-fluid p-1 container-root">
      <ProjectHeader project={project} breadcrumbs="test-scenarios" />

      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="section-title mb-3">
          <FormattedMessage id="test-scenarios" />
        </div>

        <Tabs activeKey={mainTab} onSelect={(k) => setMainTab(k || 'active')} className="mb-3">
          <Tab
            eventKey="active"
            title={<FormattedMessage id="test-scenarios-tab-active" defaultMessage="Active scenarios" />}
          >
            {activeTabContent}
          </Tab>
          <Tab
            eventKey="generate"
            title={<FormattedMessage id="test-scenarios-tab-generate" defaultMessage="Generate" />}
          >
            <GenerateTab
              project={project}
              onGenerated={() => {
                setPendingRefreshKey((x) => x + 1);
                setMainTab('pending');
              }}
            />
          </Tab>
          <Tab eventKey="pending" title={<FormattedMessage id="test-scenarios-tab-pending" defaultMessage="Pending" />}>
            <PendingTab
              key={pendingRefreshKey}
              project={project}
              onApproved={() => setActiveRefreshToken((x) => x + 1)}
            />
          </Tab>
        </Tabs>
      </div>
    </div>
  );
};

export default TestScenarios;
