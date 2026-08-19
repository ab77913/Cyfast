const orchestrationList = [
  {
    type: 'FUNCTIONAL TEST',
    date: '01 June 2025',
    status: 'Completed',
    progress: 100,
    startDate: '01 May 2025',
    endDate: '30 May 2025',
    lastRun: '01 June 2025',
    executionTime: '45 sec',
    tests: 'Tests(100 Passed / 100 Total)',
    scheduledAt: '05 June 2025'
  },
  {
    type: 'UI TEST',
    date: '04 June 2025',
    status: 'Failed',
    progress: 100,
    startDate: '01 May 2025',
    endDate: '31 May 2025',
    lastRun: '04 June 2025',
    executionTime: '40 sec',
    tests: 'Tests(0 Passed / 60 Total)',
    scheduledAt: '08 June 2025'
  },
  {
    type: 'FUNCTIONAL TEST',
    date: '02 June 2025',
    status: 'In Progress',
    progress: 50,
    startDate: '01 May 2025',
    endDate: '30 May 2025',
    lastRun: '02 June 2025',
    executionTime: '60 sec',
    tests: 'Tests(50 Passed / 100 Total)',
    scheduledAt: '06 June 2025'
  },
  {
    type: 'UI TEST',
    date: '03 June 2025',
    status: 'In Progress',
    progress: 20,
    startDate: '01 May 2025',
    endDate: '31 May 2025',
    lastRun: '03 June 2025',
    executionTime: '30 sec',
    tests: 'Tests(10 Passed / 50 Total)',
    scheduledAt: '07 June 2025'
  }
];

export default orchestrationList;
