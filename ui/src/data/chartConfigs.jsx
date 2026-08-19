//Sample data for execution analytics, chart..
export const FailureOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      enabled: true
    },
    legend: {
      // position: 'top',
      display: false
      // labels: {
      //   color: 'green'
      // }
    }
  },
  layout: {
    padding: {
      bottom: 0,
      top: 10,
      left: 0,
      right: 0
    }
  },
  scales: {
    x: {
      title: {
        display: true,
        text: 'Test Suite',
        font: {
          size: 14,
          weight: 'bold'
        }
      },
      barPercentage: 0.4,
      categoryPercentage: 0.6,
      ticks: {
        padding: 5
      },
      grid: {
        display: false
      }
    },
    y: {
      title: {
        display: true,
        text: 'Failure Percentage (%)',
        font: {
          size: 14,
          weight: 'bold'
        }
      },
      ticks: {
        padding: 5,
        callback: function (value) {
          return value + '%';
        }
      },
      grid: {
        color: '#eee'
      },
      beginAtZero: true
    }
  }
};

export const labels = ['AddNew', 'Request', 'AddNew', 'Request'];
export const FailureData = {
  labels,
  datasets: [
    {
      label: 'Data 1',
      data: [65, 45, 50, 85],
      backgroundColor: 'green',
      barThickness: 28,
      maxBarThickness: 40
    }
  ]
};

export const TestCaseEffectiveness = {
  type: 'area',
  height: 92,
  options: {
    chart: {
      sparkline: {
        enabled: true
      }
    },
    dataLabels: {
      enabled: false
    },
    colors: ['#4099ff', '#00acc1'],
    stroke: {
      curve: 'smooth',
      width: 2
    },
    tooltip: {
      fixed: {
        enabled: false
      },
      x: {
        show: false
      },
      marker: {
        show: false
      }
    }
  },
  series: [
    {
      name: 'Storage',
      data: [100, 40, 28, 51, 42, 109, 100]
    },
    {
      name: 'Bandwidth',
      data: [41, 109, 45, 109, 34, 52, 41]
    }
  ]
};

export const DefectDensity = {
  type: 'line',
  options: {
    chart: {
      zoom: { enabled: false },
      toolbar: { show: false }
    },
    dataLabels: { enabled: false },
    stroke: {
      width: [3, 2],
      curve: 'smooth',
      dashArray: [0, 5]
    },
    xaxis: {
      categories: ['1', '2', '3', '4', '5']
    },
    yaxis: {
      min: 0.04,
      max: 0.12,
      tickAmount: 4,
      labels: {
        formatter: (val) => val.toFixed(2)
      },
      title: { text: '' }
    },
    colors: ['#499B54', '#F44236'],
    legend: { show: false },
    grid: {
      row: {
        colors: ['#f3f6ff', 'transparent'],
        opacity: 0.5
      }
    }
  },
  series: [
    {
      name: 'Defect per test case',
      data: [0.04, 0.06, 0.08, 0.1, 0.12]
    },
    {
      name: 'Trend line',
      data: [0.12, 0.1, 0.08, 0.06, 0.04]
    }
  ]
};

export const DailyExeChartData = {
  type: 'line',
  height: 80,
  options: {
    chart: {
      sparkline: {
        enabled: true
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      width: 3,
      curve: 'smooth'
    },
    tooltip: {
      fixed: {
        enabled: false
      },
      x: {
        show: false
      },
      y: {
        title: {
          formatter: () => ''
        }
      },
      marker: {
        show: false
      }
    }
  },
  series: [
    {
      data: [45, 66, 41, 89, 25, 44, 9, 54]
    }
  ]
};
