import React from 'react';
import { Row, Col } from 'react-bootstrap';
import FunctionalTest from './FunctionalTest';
import UITest from './UITest';
import FailureDataChart from './FailureDataChart';

const TestCaseEffectivenessBlock = ({ functionalTests = [], uiTests = [], failureDataProps }) => {
  return (
    <div className="container-fluid zero-margins ">
      <Row className="gx-3 stretch-margin">
        <Col md={6} className="d-flex flex-column padding-block">
          <div className="render-test-block">
            {/* Render all Functional Tests */}
            {functionalTests.map((test, index) => (
              <FunctionalTest key={`func-${index}`} {...test} />
            ))}

            {/* Render all UI Tests */}
            {uiTests.map((test, index) => (
              <UITest key={`ui-${index}`} {...test} />
            ))}
          </div>
        </Col>

        <Col md={6} className="failure-data-block">
          {/* Render Failure data Chart */}
          <FailureDataChart failureData={failureDataProps.failureData} failureOptions={failureDataProps.failureOptions} />
        </Col>
      </Row>
    </div>
  );
};

export default TestCaseEffectivenessBlock;
