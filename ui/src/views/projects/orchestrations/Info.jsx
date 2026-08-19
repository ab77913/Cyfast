import React, { useEffect, useState } from 'react';
import { Row, Col, Card } from 'react-bootstrap';
import { getOrchestrationTests, getOrchestrationExecutionStats } from 'utils/apiServices';

const Info = ({ orchestrationDetails }) => {
  const [orchestrationTests, setOrchestrationTests] = useState([]);
  const [executionStats, setExecutionStats] = useState([]);

  const configuration = orchestrationDetails?.configuration;

  const formatLabel = (text) => {
    if (!text) return '';
    return text
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const fetchOrchestrationTests = async () => {
    if (!orchestrationDetails) return;
    const response = await getOrchestrationTests(orchestrationDetails?.orchestration_id);
    if (response.status === 200 && response.data) {
      setOrchestrationTests(response.data);
    } else {
      console.error('Failed to fetch orchestration tests');
      setOrchestrationTests([]);
    }
  };

  const fetchExecutionStats = async () => {
    if (!orchestrationDetails) return;
    const response = await getOrchestrationExecutionStats(orchestrationDetails?.orchestration_id);
    if (response.status === 200 && response.data) {
      console.log(response.data);
      let testStats = response.data ? response.data[configuration.execution_base.toLowerCase()][0] : null;
      let testSummary = [];
      if (testStats) {
        for (let statusCount in testStats) {
          if (statusCount == 'total_count') {
            testSummary.push({ label: 'Total', count: testStats[statusCount], color: 'text-secondary' });
          } else if (statusCount == 'passed_count') {
            testSummary.push({ label: 'Passed', count: testStats[statusCount], color: 'text-success' });
          } else if (statusCount == 'failed_count') {
            testSummary.push({ label: 'Failed', count: testStats[statusCount], color: 'text-warning' });
          } else if (statusCount == 'error_count') {
            testSummary.push({ label: 'Error', count: testStats[statusCount], color: 'text-danger' });
          } else if (statusCount == 'not_executed_count') {
            testSummary.push({ label: 'Not Executed', count: testStats[statusCount], color: 'text-muted' });
          } else if (statusCount == 'in_progress_count') {
            testSummary.push({ label: 'In Progress', count: testStats[statusCount], color: 'text-primary' });
          }
        }
      }
      setExecutionStats(testSummary);
    } else {
      console.error('Failed to fetch orchestration tests');
      setOrchestrationTests([]);
    }
  };

  useEffect(() => {
    fetchOrchestrationTests();
    fetchExecutionStats();
  }, [orchestrationDetails]);

  const StatusSummaryCard = ({ data }) => (
    <Row className="mt-2 mb-2">
      {data.map((item, index) => (
        <Col key={index} md={2} xs={6} className="text-center">
          <h3 className={`mb-2 ${item.color}`}>{item.count}</h3>
          <span>
            <strong>{item.label}</strong>
          </span>
        </Col>
      ))}
    </Row>
  );

  if (!orchestrationDetails)
    return (
      <div className="alert alert-info text-center my-3">
        <p>No orchestration details available.</p>
      </div>
    );

  return (
    <>
      <Row className="pt-2">
        <Col xs={12} md={4} lg={3}>
          <div className="d-flex flex-column gap-3">
            <div>
              <strong>Run Type:</strong> {formatLabel(configuration?.run_order || '')}
            </div>
            <div>
              <strong>Trigger Criteria:</strong> {formatLabel(configuration?.trigger_criteria || '')}
            </div>
            <div>
              <strong>Continue on Failure / Error:</strong> {configuration?.continue_on_error ? 'Continue' : 'Abort'}
            </div>
            <div>
              <strong>Execution Mode:</strong> {formatLabel(configuration?.execution_base || '')}
            </div>
          </div>
        </Col>

        <Col xs={12} md={8} lg={9}>
          <Card>
            <Card.Body>
              <StatusSummaryCard data={executionStats} />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div className="custom-table table-responsive hide-scrollbar mt-4">
        <div className="row fw-semibold bg-light py-2 mb-1">
          <div className="col-md-1 ps-4">SEQ NO</div>
          <div className="col-md-3">TEST SCRIPT</div>
          <div className="col-md-2">TEST CASE NO</div>
          <div className="col-md-3">TEST CASE NAME</div>
          <div className="col-md-1">VERSION</div>
        </div>

        {orchestrationTests?.length === 0 ? (
          <div className="alert alert-info text-center my-3">No test cases available to this Orchestration.</div>
        ) : (
          orchestrationTests?.map((orchestrationTest) => (
            <div className="row border-bottom py-3 align-items-center">
              <div className="col-6 col-md-1 ps-4">
                <strong className="d-md-none">Sequence:</strong> {orchestrationTest.execution_order}
              </div>
              <div className="col-6 col-md-3">
                <strong className="d-md-none">Script:</strong> {orchestrationTest.test_script.name}
              </div>
              <div className="col-6 col-md-2">
                <strong className="d-md-none">Test Case No:</strong>
                <span className="badge border border-info text-dark"> {orchestrationTest.test_case?.test_case_no}</span>
              </div>
              <div className="col-6 col-md-3">
                <strong className="d-md-none">Test Case Name:</strong> {orchestrationTest.test_case?.name}
              </div>
              <div className="col-6 col-md-1">
                <strong className="d-md-none">Version:</strong> {orchestrationTest.test_case?.version}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default Info;
