export const testAgentSortOptions = [
  { value: 'All', label: 'All' },
  { value: 'REGISTERED', label: 'Registered' },
  { value: 'READY', label: 'Ready' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'REPORTING', label: 'Reporting' },
  { value: 'DEAD', label: 'Dead' },
  { value: 'RESTARTING', label: 'Restarting' },
  { value: 'PARSING', label: 'Parsing' },
  { value: 'EXITED', label: 'Exited' },
  { value: 'SUSPENDED', label: 'Suspended' }
];

export const testAgentStatusColorMap = {
  REGISTERED: 'primary',
  READY: 'info',
  RUNNING: 'success',
  PAUSED: 'warning',
  REPORTING: 'info',
  DEAD: 'danger',
  RESTARTING: 'secondary',
  PARSING: 'secondary',
  EXITED: 'danger',
  SUSPENDED: 'dark'
};
