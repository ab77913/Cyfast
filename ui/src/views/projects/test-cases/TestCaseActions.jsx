import React from 'react';
import { Link } from 'react-router-dom';

const TestCaseActions = ({ status, testCaseId, onPlay, onStop, onEdit, onDelete }) => {
  return (
    <div className="text-end">
      {status === 'INPROGRESS' && (
        <>
          <Link to="#" title="Stop" onClick={() => onStop(testCaseId)} className="me-3">
            <i className="feather icon-stop-circle icon-md text-danger" />
          </Link>
        </>
      )}

      {status !== 'INPROGRESS' && (
        <>
          <Link to="#" title="Play" onClick={() => onPlay(testCaseId)} className="me-3">
            <i className="feather icon-play-circle icon-md text-primary" />
          </Link>
          <Link to="#" title="Edit" onClick={() => onEdit(testCaseId)} className="me-2">
            <i className="feather icon-action edit icon-edit" />
          </Link>
          <Link to="#" title="Delete" onClick={() => onDelete(testCaseId)} className="me-2">
            <i className="feather icon-action delete icon-trash-2" />
          </Link>
        </>
      )}
      {/* <span className="more-options-icon" title="More options">
        <FiMoreVertical size={18} color="#6c757d" />
      </span> */}
    </div>
  );
};

export default TestCaseActions;
