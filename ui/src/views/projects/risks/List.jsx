import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Row, Col, Form, Button, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { getStatusBadge } from 'data/listData';
import { FormattedMessage } from 'react-intl';
import ProjectHeader from '../ProjectHeader';
import { useSelectedProject } from 'contexts/ProjectContext';
import { getRisks } from 'utils/apiServices';
import ListPagination from 'views/shared/ListPagination';

const DEFAULT_PAGE_SIZE = 25;

const Risks = () => {
  const [risks, setRisks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState(null);
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { selectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;

  const fetchRisks = useCallback(async () => {
    if (!project?.project_id) return;
    try {
      const response = await getRisks(
        { project_id: project.project_id },
        { page: listPage, size: pageSize }
      );
      setRisks(response.data?.data || []);
      setPagination(response.data?.pagination || null);
    } catch (error) {
      console.error('Failed to fetch risks:', error);
    }
  }, [project?.project_id, listPage, pageSize]);

  useLayoutEffect(() => {
    setListPage(1);
  }, [project?.project_id]);

  useEffect(() => {
    if (!project?.project_id) return;
    fetchRisks();
    const intervalId = setInterval(() => fetchRisks(), 5000);
    return () => clearInterval(intervalId);
  }, [fetchRisks, project?.project_id]);

  const filteredRisks = risks.filter((req) => {
    const term = searchTerm.toLowerCase();
    return (
      (req.risk_no && String(req.risk_no).toLowerCase().includes(term)) ||
      (req.description && String(req.description).toLowerCase().includes(term))
    );
  });

  const handleDeleteRisksAction = (_risk) => {
    /* delete flow not wired */
  };

  return (
    <div className="container-fluid p-1 container-root">
      <ProjectHeader project={project} breadcrumbs="risks" />

      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="section-title">
          <FormattedMessage id="risks" />
        </div>

        <Row className="align-items-center mb-3">
          <Col md={4} className="d-flex align-items-center">
            <div className="input-group">
              <Form.Control
                type="search"
                placeholder="Search Risks"
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
            <Button variant="outline-primary" className="me-3" onClick={() => fetchRisks()}>
              Refresh
            </Button>
          </Col>
        </Row>

        <div className="scroll-container">
          <Table responsive hover className="align-middle mb-0">
            <thead className="thead-light">
              <tr>
                <th>RISK NO</th>
                <th>RISK DESCRIPTION</th>
                <th>STATUS</th>
                <th className="text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRisks.map((fr) => (
                <tr key={fr.risk_id ?? fr.risk_no}>
                  <td className="fw-semibold">{fr.risk_no}</td>
                  <td>{fr.description}</td>
                  <td>{fr.status ? getStatusBadge(fr.status) : ''}</td>
                  <td className="text-center">
                    <Link to="#" className="text-primary mx-1" title="Edit" onClick={(e) => e.preventDefault()}>
                      <i className="feather icon-action edit icon-edit" />
                    </Link>
                    <Link
                      to="#"
                      className="text-danger mx-2"
                      title="Delete"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteRisksAction(fr);
                      }}
                    >
                      <i className="feather icon-action delete icon-trash-2" />
                    </Link>
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
    </div>
  );
};

export default Risks;
