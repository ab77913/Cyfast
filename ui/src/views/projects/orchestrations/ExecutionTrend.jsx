import React, { useState, useEffect } from 'react';

// third party
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import colorMappings from 'utils/colorMappings';
import { getOrchestrationExecutionTrends } from 'utils/apiServices';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ==============================|| BAR STACKED CHART ||============================== //

const ExecutionTrend = ({ orchestrationDetails }) => {
  const [trendData, setTrendData] = useState({ datasets: [] });
  const [maxCount, setMaxCount] = useState(10);

  const fetchData = async (fromDay, orchId) => {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - fromDay);
    const formattedFromDate = fromDate.toISOString().split('T')[0];
    const response = await getOrchestrationExecutionTrends(orchId, formattedFromDate);
    if (response.status === 200) {
      const dataSet1 = [];
      const dataSet2 = [];
      const dataSet3 = [];
      const dataSet4 = [];
      const dataSet5 = [];

      response.data.forEach((resVal) => {
        dataSet1.push(resVal.date);
        dataSet2.push(resVal.passed_count);
        dataSet3.push(resVal.failed_count);
        dataSet4.push(resVal.error_count);
        dataSet5.push(resVal.not_executed_count);
        if (resVal.total_count > maxCount) {
          setMaxCount(resVal.total_count);
        }
      });

      setTrendData({
        labels: dataSet1,
        datasets: [
          {
            label: 'Passed',
            data: dataSet2,
            backgroundColor: colorMappings['text-success']
          },
          {
            label: 'Failed',
            data: dataSet3,
            backgroundColor: colorMappings['text-warning']
          },
          {
            label: 'Error',
            data: dataSet4,
            backgroundColor: colorMappings['text-danger']
          },
          {
            label: 'Not Executed',
            data: dataSet5,
            backgroundColor: colorMappings['text-muted']
          }
        ]
      });
    } else {
      console.error('Failed to fetch orchestration execution trends:', response);
    }
  };

  useEffect(() => {
    if (!orchestrationDetails || !orchestrationDetails.orchestration_id) return;
    fetchData(30, orchestrationDetails.orchestration_id);
  }, [orchestrationDetails]);

  const options = {
    maintainAspectRatio: false,
    responsive: true,
    barValueSpacing: 20,
    plugins: {
      legend: {
        labels: {
          color: 'initial'
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: 'initial'
        }
      },
      y: {
        stacked: true,
        suggestedMax: maxCount, // Set your desired maximum value here
        beginAtZero: true,
        ticks: {
          color: 'initial'
        }
      }
    }
  };

  // const labels = [0, 1, 2, 3];

  // const data = {
  //   labels,
  //   datasets: [
  //     {
  //       label: 'Data 1',
  //       data: [25, 45, 74, 85],
  //       backgroundColor: 'rgba(64, 153, 255, 1)'
  //     },
  //     {
  //       label: 'Data 2',
  //       data: [30, 52, 65, 65],
  //       backgroundColor: 'rgba(255, 182, 77, 1)'
  //     }
  //   ]
  // };

  return (
    <div style={{ height: '360px' }}>
      <Bar data={trendData} options={options} height={300} />
    </div>
  );
};

export default ExecutionTrend;
