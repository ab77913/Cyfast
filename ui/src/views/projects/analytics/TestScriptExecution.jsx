import React from 'react';
import { Row, Col, ProgressBar } from 'react-bootstrap';
import Chart from 'react-apexcharts';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const TestScriptExecution = ({ title = '', dailyTrend = {}, defectDensity = {}, executed = {}, planned = {} }) => {
  const percentage = Math.round((executed / planned) * 100);
  return (
    <div className="container-fluid zero-margins test-script-main">
      <Row className="gx-3 zero-margins">
        <Col md={2} className="bg-test-case d-flex flex-column justify-content-between col-border">
          <h6 className="fw-bold mb-1">{title}</h6>

          <div className="text-start">
            <div className="fw-bold fs-3">{planned}</div>
            <div className="medium">Planned for Execution</div>
          </div>
        </Col>

        <Col md={3} className="d-flex flex-column col-divider col-border">
          <div>
            <h6 className="fw-bold mb-1">Executed Test Cases</h6>
          </div>
          <div className="mt-auto pt-2">
            <div className="progress-wrapper mb-3 test-case-pgbar-width">
              <ProgressBar now={percentage} label={`${percentage}%`} className="custom-progress-bar" />
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <div className="medium">
                No. of test cases <br /> executed so far
              </div>
              <div className="fw-bold fs-4">{executed}</div>
            </div>
          </div>
        </Col>

        <Col md={2} className="col-divider col-border">
          <h6 className="fw-bold text-center">Daily Execution Trend</h6>
          <div className="d-flex justify-content-center">
            <Chart {...dailyTrend} height={110} width={140} />
          </div>
        </Col>

        <Col md={5} className="rem-padding">
          <h6 className="fw-bold mb-1">Defect Density</h6>
          <div className="d-flex align-items-center">
            <div className="chart-flex-grow">
              <Chart {...defectDensity} height={120} />
            </div>

            <div>
              <div className="d-flex gap-2">
                <LegendDot color="#499B54" label="Defect per test case" />
              </div>
              <div className="d-flex gap-2">
                <LegendDot color="#F44236" label="Trend line" />
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

const LegendDot = ({ color, label }) => (
  <div className="d-flex align-items-center gap-2">
    <span className="legend-style" style={{ backgroundColor: color }}></span>
    <span>{label}</span>
  </div>
);

export default TestScriptExecution;
