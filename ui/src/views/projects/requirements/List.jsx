import React, { useCallback, useState, useEffect, useLayoutEffect } from 'react';
import { Row, Col, Form, Button, Table, Tabs, Tab } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { getStatusBadge } from 'data/listData';
import { FormattedMessage } from 'react-intl';
import ProjectHeader from '../ProjectHeader';
import { useSelectedProject } from 'contexts/ProjectContext';
import { getRequirements } from 'utils/apiServices';
import ListPagination from 'views/shared/ListPagination';

import RequirementGenerationTab from './RequirementGenerationTab';
import PendingGeneratedRequirementsTab from './PendingGeneratedRequirementsTab';

const DEFAULT_PAGE_SIZE = 25;

const Requirements = () => {
  const [requirements, setRequirements] = useState([]);
  const [listPagination, setListPagination] = useState(null);
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [mainTab, setMainTab] = useState('active');
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const { selectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;

  const fetchRequirements = useCallback(async () => {
    if (!project?.project_id) return;
    try {
      const response = await getRequirements(
        { project_id: project.project_id },
        { page: listPage, size: pageSize }
      );
      const fetchedRequirements = response.data?.data || [];
      setRequirements(fetchedRequirements);
      setListPagination(response.data?.pagination || null);
    } catch (error) {
      console.error('Failed to fetch requirements:', error);
    }
  }, [project?.project_id, listPage, pageSize]);

  useLayoutEffect(() => {
    setListPage(1);
  }, [project?.project_id]);

  useEffect(() => {
    if (!project?.project_id) return;
    fetchRequirements();

    const intervalId = setInterval(() => {
      fetchRequirements();
    }, 15000);

    return () => clearInterval(intervalId);
  }, [fetchRequirements, project?.project_id]);

  const filteredRequirements = requirements.filter((req) => {
    const term = searchTerm.toLowerCase();
    const no = String(req.requirement_no || '').toLowerCase();
    const desc = String(req.description || '').toLowerCase();
    const title = String(req.title || '').toLowerCase();
    return no.includes(term) || desc.includes(term) || title.includes(term);
  });

  const activeTabContent = (
    <>
      <Row className="align-items-center mb-3">
        <Col md={4} className="d-flex align-items-center">
          <div className="input-group">
            <Form.Control
              type="search"
              placeholder="Search Requirements"
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
          <Button variant="outline-primary" className="me-3" onClick={() => fetchRequirements()}>
            Refresh
          </Button>

          <Button variant="primary" disabled>
            Import
          </Button>
        </Col>
      </Row>

      <div className="scroll-container">
        <Table responsive hover className="align-middle mb-0">
          <thead className="thead-light">
            <tr>
              <th>REQ NO</th>
              <th>TITLE</th>
              <th>REQUIREMENT DESCRIPTION</th>
              <th>STATUS</th>
              <th className="text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequirements.map((fr) => (
              <tr key={fr.requirement_id}>
                <td className="fw-semibold">{fr.requirement_no}</td>
                <td>{fr.title}</td>
                <td>{fr.description}</td>
                <td>{fr.status ? getStatusBadge(fr.status) : ''}</td>
                <td className="text-center">
                  <Link to="#" className="text-primary mx-1" title="Edit" onClick={(e) => e.preventDefault()}>
                    <i className="feather icon-action edit icon-edit" />
                  </Link>
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
      <ProjectHeader project={project} breadcrumbs="requirements" />

      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="section-title mb-3">
          <FormattedMessage id="requirements" />
        </div>

        <Tabs activeKey={mainTab} onSelect={(k) => setMainTab(k || 'active')} className="mb-3">
          <Tab eventKey="active" title={<FormattedMessage id="requirements-tab-active" defaultMessage="Active" />}>
            {activeTabContent}
          </Tab>
          <Tab
            eventKey="generate"
            title={<FormattedMessage id="requirements-tab-generate" defaultMessage="Generate from documents" />}
          >
            <RequirementGenerationTab
              project={project}
              onGenerated={() => {
                setPendingRefreshKey((x) => x + 1);
                setMainTab('pending');
              }}
            />
          </Tab>
          <Tab eventKey="pending" title={<FormattedMessage id="requirements-tab-pending" defaultMessage="Pending approval" />}>
            <PendingGeneratedRequirementsTab
              key={pendingRefreshKey}
              project={project}
              onApproved={() => fetchRequirements()}
            />
          </Tab>
        </Tabs>
      </div>
    </div>
  );
};

export default Requirements;
