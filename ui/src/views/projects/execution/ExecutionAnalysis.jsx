import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Tabs, Tab, Table } from 'react-bootstrap';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import ExecutionResultDoughnut from '../analytics/ExecutionResultDoughnut';
import ProjectHeader from '../ProjectHeader';
import Spinner from 'react-bootstrap/Spinner';
import { getProjectById, getProjectExecutionStats, getProjectMostFailedTestCases } from 'utils/apiServices';

import { useSelectedProject } from 'contexts/ProjectContext';

ChartJS.register(ArcElement, Tooltip, Legend);

const ProjectDetails = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState({});
  const [executionStats, setExecutionStats] = useState({});
  const [formattedStats, setFormattedStats] = useState({});
  const [mostFailed, setMostFailed] = useState({});

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

  const fetchMostFailed = async () => {
    if (!project) return;
    try {
      const response = await getProjectMostFailedTestCases(project.project_id);
      if (response.status === 200 && response.data) {
        setMostFailed(response.data);
      } else {
        console.error('Failed to fetch most failed test cases');
        setMostFailed({});
      }
    } catch (error) {
      console.error('Error fetching most failed test cases:', error);
      setMostFailed({});
    }
  };

  const fetchExecutionStats = async () => {
    if (!project) return;
    const response = await getProjectExecutionStats(project?.project_id);
    if (response.status === 200 && response.data) {
      setExecutionStats(response.data);
      // Format the stats for display
      setFormattedStats({});
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
      setFormattedStats(testSummary);
    } else {
      console.error('Failed to fetch Summary');
      setFormattedStats({});
    }
  };

  // getProjectById api call
  useEffect(() => {
    if (!project) return;

    fetchProjectDetails();
    fetchExecutionStats();
    fetchMostFailed();
  }, [project]);

  return (
    <div className="container-fluid p-1 container-root">
      {isLoading && (
        <div className="spinner-overlay">
          <Spinner animation="border" variant="primary" role="status"></Spinner>
        </div>
      )}

      <ProjectHeader project={project} breadcrumbs="details" />

      <div className="pt-2">
        <Row>
          <Col xl={3} md={6}>
            <Card>
              <Card.Body>
                <Row className="align-items-center m-l-0">
                  <Col sm="auto">
                    <i className="fas fa-play-circle f-36 text-c-blue" />
                  </Col>
                  <Col sm="auto">
                    <h6 className="text-muted m-b-10">Tests Executed</h6>
                    <h2 className="m-b-0">
                      {executionStats.test_case
                        ? parseInt(executionStats.test_case[0].passed_count) +
                          parseInt(executionStats.test_case[0].failed_count) +
                          parseInt(executionStats.test_case[0].error_count)
                        : 0}
                    </h2>
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
                    <i className="fas fa-check f-36 text-c-green" />
                  </Col>
                  <Col sm="auto">
                    <h6 className="text-muted m-b-10">Pass Percentage</h6>
                    <h2 className="m-b-0">
                      {executionStats.test_case
                        ? Math.round(
                            (parseInt(executionStats.test_case[0].passed_count) * 100) / parseInt(executionStats.test_case[0].total_count)
                          )
                        : 'NA'}
                    </h2>
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
                    <i className="fas fa-times f-36 text-c-red" />
                  </Col>
                  <Col sm="auto">
                    <h6 className="text-muted m-b-10">Tests Failed</h6>
                    <h2 className="m-b-0">{executionStats.test_case ? parseInt(executionStats.test_case[0].failed_count) : 0}</h2>
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
                    <i className="fas fa-clock f-36 text-c-yellow" />
                  </Col>
                  <Col sm="auto">
                    <h6 className="text-muted m-b-10">Avg. Execution Time</h6>
                    <h2 className="m-b-0">10</h2>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      <div>
        <Row>
          <Col md={3}>
            <Card className="mb-4">
              <Card.Body>
                <div className="section-title">Test Case Execution</div>
                <div className="chart-container mb-3">
                  <ExecutionResultDoughnut executionData={formattedStats} type="test_case" />
                </div>
                <Row>
                  {formattedStats.test_case?.map((testStat, tidx) => (
                    <Col xs={6}>
                      <div className="mb-3" key={tidx}>
                        <div className="fw-semibold small text-secondary">{testStat.label.toUpperCase()}</div>
                        <div className={'fw-semibold ' + testStat.color}>{testStat.count}</div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="mb-4">
              <Card.Body>
                <div className="section-title">Requirement Execution</div>
                <div className="chart-container mb-3">
                  <ExecutionResultDoughnut executionData={formattedStats} type="requirement" />
                </div>
                <Row>
                  {formattedStats.requirement?.map((testStat, tidx) => (
                    <Col xs={6}>
                      <div className="mb-3" key={tidx}>
                        <div className="fw-semibold small text-secondary">{testStat.label.toUpperCase()}</div>
                        <div className={'fw-semibold ' + testStat.color}>{testStat.count}</div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="table-card">
              <Card.Body>
                <div className="section-title p-4 pb-0">Most Failed</div>
                <Tabs defaultActiveKey="my-task" className="p-20">
                  <Tab eventKey="my-task" title="Test Cases">
                    <Table responsive hover>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Title</th>
                          <th>Failures</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mostFailed.test_case?.map((testCase, index) => (
                          <tr key={index}>
                            <td>{testCase.test_case_no}</td>
                            <td>
                              <p className="mb-1">{testCase.name}</p>
                            </td>
                            <td>
                              {testCase.failed_count}/{testCase.total_count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Tab>
                  <Tab eventKey="completed-task" title="Requirements">
                    <Table responsive hover>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Title</th>
                          <th>Failures</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mostFailed.requirement?.map((requirement, index) => (
                          <tr key={index}>
                            <td>{requirement.requirement_no}</td>
                            <td>
                              <p className="mb-1">{requirement.description}</p>
                            </td>
                            <td>
                              {requirement.failed_count}/{requirement.total_count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Tab>
                </Tabs>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default ProjectDetails;
