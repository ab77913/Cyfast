import React from 'react';
import Select from 'react-select';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const FailureDataChart = ({ failureData, failureOptions }) => {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold mb-0">
          Top 10 Failures - Test Suites / Test Cases / <br />
          Requirements
        </h6>
        <div className="bar-select-width">
          <Select
            classNamePrefix="select"
            options={[
              { value: 'script1', label: 'Test Script 1' },
              { value: 'script2', label: 'Test Script 2' },
              { value: 'script3', label: 'Test Script 3' }
            ]}
            placeholder="Test Script"
            onChange={(selected) => console.log('Selected script:', selected)}
            menuPortalTarget={document.body}
          />
        </div>
      </div>

      <div className="bar-chart-style">
        <Bar
          data={failureData}
          options={{
            ...failureOptions,
            maintainAspectRatio: false,
            responsive: true
          }}
        />
      </div>
    </>
  );
};

export default FailureDataChart;
