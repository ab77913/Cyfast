/**sample test case test data for chart */
const testCaseChart = {
  height: 200,
  type: 'donut',
  options: {
    chart: {
      toolbar: { show: false },
      animations: { enabled: true }
    },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: '75%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'TOTAL',
              fontSize: '1rem',
              fontWeight: 600,
              color: '#1F73A7',
              formatter: function (w) {
                return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
              },
              style: {
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#1F73A7'
              }
            }
          }
        }
      }
    },
    labels: ['Passed', 'Failed', 'In Progress', 'Error', 'Paused', 'Not Executed'],
    legend: { show: false },
    colors: ['#499B54', '#F44336', '#3B9DFF', '#FEA301', '#5F6366', '#4BAABE']
  },
  series: [16, 5, 17, 7, 3, 2]
};

export default testCaseChart;
