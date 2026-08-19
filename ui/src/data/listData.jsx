import React from 'react';
import { Chance } from 'chance';
import { Link } from 'react-router-dom';
import { Badge } from 'react-bootstrap';

const chance = new Chance();
// mock data
// Status mapping
export const statusMap = {
  1: { value: 'INPROGRESS', label: 'In Progress', className: 'bg-primary' },
  2: { value: 'PAUSED', label: 'Paused', className: 'bg-secondary' },
  3: { value: 'PASSED', label: 'Passed', className: 'bg-success' },
  4: { value: 'FAILED', label: 'Failed', className: 'bg-warning' },
  5: { value: 'ERROR', label: 'Error', className: 'bg-danger' },
  6: { value: 'QUEUED', label: 'Queued', className: 'bg-outline-primary' },
  7: { value: 'NEW', label: 'New', className: 'bg-info' }
};

export const sortOptions = [
  { value: '', label: 'All' },
  { value: 'NOT_EXECUTED', label: 'Not Executed' },
  { value: 'PASSED', label: 'Passed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'INPROGRESS', label: 'In Progress' },
  { value: 'ERROR', label: 'Error' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'QUEUED', label: 'Queued' },
  { value: 'NEW', label: 'New' }
];

export const projectTypeOptions = [
  { value: 'WINDOWS', label: 'Windows' },
  { value: 'EMBEDDED', label: 'Embedded' },
  { value: 'WEB', label: 'Web' },
  { value: 'MOBILE', label: 'Mobile' }
];

export const runOrderOptions = [
  { value: 'SEQUENTIAL', label: 'Sequential' },
  { value: 'PARALLEL', label: 'Parallel' },
  { value: 'DISTRIBUTED', label: 'Distributed' }
  // { value: 'DEPENDENCY', label: 'Dependency' }
];

export const triggerCriteriaOptions = [
  { value: 'ON_DEMAND', label: 'On Demand' },
  { value: 'ON_EVENT', label: 'On Event' },
  { value: 'PERIODICALLY', label: 'Periodically' }
];

export const executionBaseOptions = [
  { value: 'TEST_CASE', label: 'Test Cases' },
  { value: 'TEST_SCRIPT', label: 'Test SCripts' }
];

export const getStatusBadge = (status) => {
  switch (status) {
    case 'PASSED':
      return (
        <Badge bg="passed" className="status-badge">
          Passed
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge bg="failed" className="status-badge">
          Failed
        </Badge>
      );
    case 'INPROGRESS':
      return (
        <Badge bg="inprogress" className="status-badge">
          IN PROGRESS
        </Badge>
      );
    case 'ERROR':
      return (
        <Badge bg="error" className="status-badge">
          Error
        </Badge>
      );
    case 'PAUSED':
      return (
        <Badge bg="paused" className="status-badge">
          Paused
        </Badge>
      );
    case 'NEW':
      return (
        <Badge bg="info" className="status-badge">
          New
        </Badge>
      );
    case 'NOT_EXECUTED':
      return (
        <Badge bg="info" className="status-badge">
          NOT EXECUTED
        </Badge>
      );
    default:
      return (
        <Badge bg="secondary" className="status-badge">
          {status}
        </Badge>
      );
  }
};

/**
 * Generate mock project data
 * @param {number} count - number of records to generate
 * @returns {Array} array of project objects
 */
const projectsListData = (count = 10) => {
  return Array.from({ length: count }, (_, i) => {
    const statusKey = chance.integer({ min: 1, max: 5 });
    const statusItem = statusMap[statusKey];

    return {
      id: chance.guid(),
      name: `Project ${i + 1}`,
      type: chance.pickone(['Windows', 'Embedded', 'Web', 'Mobile']),
      email: chance.email({ domain: 'example.com' }),
      date: chance.date({ year: 2024 }).toISOString().split('T')[0],
      statusVal: statusItem.value, // for filtering
      status: <span className={`badge ${statusItem.className} inline-block`}>{statusItem.label}</span>,
      action: (
        <>
          <Link to="#" className="text-primary mx-1" title="Edit" onClick={() => console.log('Edit clicked')}>
            <i className="feather icon-edit" />
          </Link>
          <Link to="#" className="text-danger mx-1" title="Delete" onClick={() => console.log('Delete clicked')}>
            <i className="feather icon-trash-2" />
          </Link>
          <Link to="#" className="text-secondary mx-1" title="Settings" onClick={() => console.log('Settings clicked')}>
            <i className="fas fa-cog" />
          </Link>
        </>
      )
    };
  });
};

export default projectsListData;
