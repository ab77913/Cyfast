import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Table } from 'react-bootstrap';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { FormattedMessage } from 'react-intl';
import ProjectHeader from './ProjectHeader';
import Spinner from 'react-bootstrap/Spinner';
import { getProjectById, getProjectSummary, getProjectExecutionStats } from 'utils/apiServices';

import { useSelectedProject } from 'contexts/ProjectContext';

ChartJS.register(ArcElement, Tooltip, Legend);

const ProjectDetails = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState({});
  const [projectSummary, setProjectSummary] = useState({});
  const [executionStats, setExecutionStats] = useState({});

  const { selectedProjectInContext, setSelectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;
  const navigate = useNavigate();

  const fetchProjectDetails = async () => {
    try {
      setIsLoading(true);
      const response = await getProjectById(project.project_id);
      if (response.status == 200) {
        setSelectedProject(response.data);
      } else {
        console.error('Error occured while fetching project details');
      }
    } catch (err) {
      console.error('Error fetching project details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjectSummary = async () => {
    if (!project) return;

    const response = await getProjectSummary(project.project_id);
    if (response.status === 200 && response.data) {
      setProjectSummary(response.data);
    } else {
      console.error('Failed to fetch project summary');
      setProjectSummary({});
    }
  };

  const fetchExecutionStats = async () => {
    if (!project) return;
    const response = await getProjectExecutionStats(project?.project_id);
    if (response.status === 200 && response.data) {
      setExecutionStats({});
      let testSummary = {};
      if (response.data) {
        for (let statType in response.data) {
          let stats = [];
          let testStats = response.data[statType][0];
          if (testStats['total_count'] != 0) {
            for (let statusCount in testStats) {
              if (statusCount == 'total_count') {
                stats.push({ label: 'Total', count: testStats[statusCount], color: 'text-secondary' });
              } else if (statusCount == 'passed_count') {
                stats.push({ label: 'Passed', count: testStats[statusCount], color: 'text-success' });
              } else if (statusCount == 'failed_count') {
                stats.push({ label: 'Failed', count: testStats[statusCount], color: 'text-warning' });
              } else if (statusCount == 'error_count') {
                stats.push({ label: 'Error', count: testStats[statusCount], color: 'text-danger' });
              } else if (statusCount == 'not_executed_count') {
                stats.push({ label: 'Not Executed', count: testStats[statusCount], color: 'text-muted' });
              } else if (statusCount == 'in_progress_count') {
                stats.push({ label: 'In Progress', count: testStats[statusCount], color: 'text-primary' });
              }
            }
          }
          testSummary[statType] = stats;
        }
      }
      setExecutionStats(testSummary);
    } else {
      console.error('Failed to fetch Summary');
      setExecutionStats({});
    }
  };

  // getProjectById api call
  useEffect(() => {
    if (!project) return;

    fetchProjectDetails();
    fetchProjectSummary();
    fetchExecutionStats();
  }, [project]);

  return (
    <div className="container-fluid p-1 container-root">
      {isLoading && (
        <div className="spinner-overlay">
          <Spinner animation="border" variant="primary" role="status"></Spinner>
        </div>
      )}

      <ProjectHeader project={project} breadcrumbs="details" />

      {/* Project Summary */}
      <div className="pt-2">
        <Row>
          <Col xl={3} md={6}>
            <Card>
              <Card.Body>
                <Row className="align-items-center m-l-0">
                  <Col sm="auto">
                    <i className="fas fa-object-group f-36 text-c-blue" />
                  </Col>
                  <Col sm="auto">
                    <h6 className="text-muted m-b-10">Orchestrations</h6>
                    <h2 className="m-b-0">{projectSummary?.orchestrations_count ? projectSummary?.orchestrations_count : 0}</h2>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card>
              <Card.Body>
                <Row className="align-items-center m-l-0">
                  <Col sm="auto">
                    <i className="fas fa-clipboard-check f-36 text-c-green" />
                  </Col>
                  <Col sm="auto">
                    <h6 className="text-muted m-b-10">Test Suites</h6>
                    <h2 className="m-b-0">{projectSummary?.test_suites_count ? projectSummary?.test_suites_count : 0}</h2>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card>
              <Card.Body>
                <Row className="align-items-center m-l-0">
                  <Col sm="auto">
                    <i className="fas fa-list-alt f-36 text-c-red" />
                  </Col>
                  <Col sm="auto">
                    <h6 className="text-muted m-b-10">Requirements</h6>
                    <h2 className="m-b-0">{projectSummary?.requirements_count ? projectSummary?.requirements_count : 0}</h2>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card>
              <Card.Body>
                <Row className="align-items-center m-l-0">
                  <Col sm="auto">
                    <i className="fas fa-exclamation-triangle f-36 text-c-yellow" />
                  </Col>
                  <Col sm="auto">
                    <h6 className="text-muted m-b-10">Risks</h6>
                    <h2 className="m-b-0">{projectSummary?.risks_count ? projectSummary?.risks_count : 0}</h2>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      <div>
        <Row>
          <Col md={8} className="mb-4">
            {/* Container Row with white background */}
            <div className="bg-white rounded shadow-sm mb-4">
              <Card>
                <Card.Body>
                  <div className="section-title pb-1">
                    <FormattedMessage id="details" />
                  </div>
                  <Row className="mb-4">
                    <Col md={6}>
                      <div className="mb-4">
                        <div className="fw-bold small label-title">Type</div>
                        <div className="text-muted">{project?.type}</div>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-4">
                        <div className="fw-bold small label-title">Phase</div>
                        <div className="text-muted">{project?.phase}</div>
                      </div>
                    </Col>
                  </Row>
                  {/* Created Date */}
                  <Row className="mb-4">
                    <Col md={6}>
                      <div className="fw-bold small label-title">Created at</div>
                      <div className="text-muted">
                        {(() => {
                          const dt = new Date(project?.created_date);
                          const datePart = dt.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });
                          const timePart = dt.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          });
                          return `${datePart}, ${timePart}`;
                        })()}
                      </div>
                    </Col>

                    {/* Owner Email */}
                    <Col md={6} className="mb-4">
                      <div className="fw-bold small label-title">Owner</div>
                      <div className="text-muted">{project?.created_by}</div>
                    </Col>
                  </Row>
                  {/* Description */}
                  <div>
                    <div className="fw-bold small label-title">Description</div>
                    <div className="text-muted justify-text">{project?.description}</div>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </Col>
          <Col md={4} className="mb-4">
            <div className="bg-white project-config rounded shadow-sm mb-4">
              <Card>
                <Card.Body>
                  <div className="section-title">
                    <FormattedMessage id="Configurations" />
                  </div>
                  <Table responsive size="sm" className="able-sm mb-0 mt-2">
                    <tbody>
                      <tr>
                        <th>Email Notifications</th>
                        <td>: {selectedProject.configuration?.enable_email_notifications ? 'Enabled' : 'Disabled'}</td>
                      </tr>
                      <tr>
                        <th>Emails to Notify</th>
                        <td>: {selectedProject.configuration?.emails_to_notify}</td>
                      </tr>
                      <tr>
                        <th>Enable Logging</th>
                        <td>: {selectedProject.configuration?.enable_logging ? 'Enabled' : 'Disabled'}</td>
                      </tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default ProjectDetails;
