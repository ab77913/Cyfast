import React from 'react';
import { useState, useEffect } from 'react';
import { Doughnut } from 'react-chartjs-2';
import colorMappings from 'utils/colorMappings';

const ExecutionResultDoughnut = ({ executionData = {}, type = 'test_case' }) => {
  const [executionLabels, setExecutionLabels] = useState([]);
  const [executionCounts, setExecutionCounts] = useState([]);
  const [mappedColors, setMappedColors] = useState([]);

  const options = {
    maintainAspectRatio: true,
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: 'initial'
        }
      }
    }
  };
  const data = {
    labels: executionLabels,
    datasets: [
      {
        label: '# of Votes',
        data: executionCounts,
        backgroundColor: mappedColors,
        borderColor: ['rgba(255, 255, 255, 1)'],
        borderWidth: 2
      }
    ]
  };

  useEffect(() => {
    console.log('executionData', executionData);
    if (executionData && executionData[type]) {
      const labels = [];
      const counts = [];
      const colors = [];
      executionData[type].forEach((item) => {
        if (item.label !== 'Total') {
          labels.push(item.label);
          counts.push(item.count);
          colors.push(colorMappings[item.color] || 'rgba(0, 123, 255, 0.7)');
        }
      });
      setExecutionLabels(labels);
      setExecutionCounts(counts);
      setMappedColors(colors);
    }
  }, [executionData]);

  return <Doughnut data={data} options={options} />;
};

export default ExecutionResultDoughnut;
