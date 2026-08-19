import React from 'react';
import { Chance } from 'chance';
import { Link } from 'react-router-dom';
import axios from 'axios';

const chance = new Chance();
// mock data
// Status mapping
export const statusMap = [
  { value: 'INPROGRESS', label: 'In Progress', className: 'bg-primary' },
  { value: 'PAUSED', label: 'Paused', className: 'bg-secondary' },
  { value: 'PASSED', label: 'Passed', className: 'bg-success' },
  { value: 'FAILED', label: 'Failed', className: 'bg-warning' },
  { value: 'ERROR', label: 'Error', className: 'bg-danger' },
  { value: 'QUEUED', label: 'Queued', className: 'bg-outline-primary' },
  { value: 'NEW', label: 'New', className: 'bg-info' }
];

export const projectTypeOptions = [
  { value: 'WINDOWS', label: 'Windows' },
  { value: 'EMBEDDED', label: 'Embedded' },
  { value: 'WEB', label: 'Web' },
  { value: 'MOBILE', label: 'Mobile' }
];

export const extractStatusInfo = (statusVal) => {
  const statusItem = statusMap.find((item) => item.value === statusVal);
  return statusItem ? statusItem : { label: 'Unknown', value: '', className: 'bg-secondary' };
};

export const getProjectsList = async () => {
  const accessToken = localStorage.getItem('accessToken') || 'abcdefghigasdjkjhkas';
  const userName = localStorage.getItem('userName') || 'admin@cyient.com';
  if (!accessToken || !userLogin) {
    console.error('Access token or user login not found in Local Storage');
    return [];
  }

  try {
    const response = await axios.get(process.env.REACT_APP_NODE_API_GENERAL_URL + '/projects?filters[CreatedBy]=' + userName, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken
      }
    });
    console.log('Projects response - ', response);
    return response.data && response.data.data ? response.data.data : [];
  } catch (error) {
    console.error('Error fetching projects list:', error);
    throw error;
  }
};

export const getProjectDetails = async (id) => {
  try {
    const response = await axios.get(process.env.REACT_APP_NODE_API_GENERAL_URL + '/projects/' + id, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken
      }
    });
    console.log('Project details response - ', response);
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};

export const deleteProject = async (id) => {
  try {
    const response = await axios.delete(process.env.REACT_APP_NODE_API_GENERAL_URL + '/projects/' + id, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken
      }
    });
    console.log('Project deleted response - ', response);
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};

export const getProjectConfigByProjectId = async (id) => {
  try {
    const response = await axios.get(process.env.REACT_APP_NODE_API_GENERAL_URL + '/projects/' + id + '/configurations', {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken
      }
    });
    console.log('Project config response - ', response);
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};

/**
 * Call Projects List API and return the data
 * @param {number} count - number of records to generate
 *
 * @returns {Array} array of project objects
 */

export const projectsListData = async (count = 10) => {
  try {
    const response = await getProjectsList();
    if (!response || response.length === 0) {
      return [];
    }

    return response.slice(0, count).map((item) => {
      // Extract status information using the utility function
      const statusItem = extractStatusInfo(item.Status);
      return {
        id: item.ProjectId,
        name: item.ProjectName,
        type: item.ProjectType,
        email: item.CreatedBy,
        // Format date to YYYY-MM-DD
        date: new Date(item.CreatedAt).toISOString().split('T')[0],
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
  } catch (error) {
    console.error('Error fetching projects list:', error);
    return [];
  }
};

// /**
//  * Generate mock project data
//  * @param {number} count - number of records to generate
//  * @returns {Array} array of project objects
//  */
// const projectsListData = (count = 10) => {
//   return Array.from({ length: count }, (_, i) => {
//     const statusKey = chance.integer({ min: 1, max: 5 });
//     const statusItem = statusMap[statusKey];

//     return {
//       id: chance.guid(),
//       name: `Project ${i + 1}`,
//       type: chance.pickone(['Windows', 'Embedded', 'Web', 'Mobile']),
//       email: chance.email({ domain: 'example.com' }),
//       date: chance.date({ year: 2024 }).toISOString().split('T')[0],
//       statusVal: statusItem.value, // for filtering
//       status: <span className={`badge ${statusItem.className} inline-block`}>{statusItem.label}</span>,
//       action: (
//         <>
//           <Link to="#" className="text-primary mx-1" title="Edit" onClick={() => console.log('Edit clicked')}>
//             <i className="feather icon-edit" />
//           </Link>
//           <Link to="#" className="text-danger mx-1" title="Delete" onClick={() => console.log('Delete clicked')}>
//             <i className="feather icon-trash-2" />
//           </Link>
//           <Link to="#" className="text-secondary mx-1" title="Settings" onClick={() => console.log('Settings clicked')}>
//             <i className="fas fa-cog" />
//           </Link>
//         </>
//       )
//     };
//   });
// };

export default projectsListData;
