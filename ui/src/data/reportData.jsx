// src/data/reportData.jsx
import { Chance } from 'chance';
import { Link } from 'react-router-dom';

const chance = new Chance();

// Reusable helper for date formatting
const formatDate = (date) => {
  return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// Mock Report Types
const reportTypes = ['TEST_SUMMARY', 'ORCHESTRATION_EXECUTION_LOG', 'CONSOLE_LOG', 'ORCHESTRATION_TEST_SUMMARY'];

// Generate one report record
const newReport = (i) => {
  const created = chance.date({ year: 2025 });
  const modified = new Date(created.getTime() + chance.integer({ min: 1, max: 10 }) * 86400000);

  return {
    id: i + 1,
    name: `Report ${i + 1}`,
    type: chance.pickone(reportTypes),
    createdDate: formatDate(created),
    modifiedDate: formatDate(modified),
    isDefault: i === 0, // First report is default
    action: (
      <>
        <Link to="#" className="text-primary mx-1" title="Edit">
          <i className="feather icon-edit" />
        </Link>
        <Link to="#" className="text-danger mx-1" title="Delete">
          <i className="feather icon-trash-2" />
        </Link>
        <Link to="#" className="text-info mx-1" title="Download">
          <i className="feather icon-download" />
        </Link>
      </>
    )
  };
};

// Export mock report data
export default function makeReportData(count = 8) {
  return Array.from({ length: count }, (_, i) => newReport(i));
}
