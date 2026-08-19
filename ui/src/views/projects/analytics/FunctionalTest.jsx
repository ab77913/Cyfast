import React from 'react';
import { Row, Col, ProgressBar } from 'react-bootstrap';
import Chart from 'react-apexcharts';

const FunctionalTest = ({ title = {}, coverage = 0, effectiveness = {} }) => {
  return (
    <div className="section-card mb-1">
      <div className="test-script-main test-content">
        <Row className="gx-3 zero-margins fix-height">
          <Col md={4} className="bg-test-case d-flex flex-column justify-content-between col-border">
            <h6 className="fw-bold mb-1">{title}</h6>

            <div className="text-start">
              <div className="fw-bold fs-4">{coverage}%</div>
              <div className="medium">Requirement Coverage</div>
              <div className="progress-wrapper mb-1 ui-pgbar-width">
                <ProgressBar now={80} className="custom-progress-bar" />
              </div>
            </div>
          </Col>
          <Col md={6} className="d-flex flex-column rem-padding chart-flex-grow">
            <div>
              <h6 className="fw-bold mb-1">Test Case Effectiveness</h6>
            </div>
            <div className="d-flex flex-column align-items-center justify-content-center chart-flex-grow">
              <Chart {...effectiveness} height={85} width={380} />
              <div className="d-flex justify-content-center gap-4 mt-2">
                <LegendDot color="#4099ff" label="Storage" />
                <LegendDot color="#00acc1" label="Bandwidth" />
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
};

const LegendDot = ({ color, label }) => (
  <div className="d-flex align-items-center gap-2">
    <span className="legend-style" style={{ backgroundColor: color }}></span>
    <span>{label}</span>
  </div>
);

export default FunctionalTest;
