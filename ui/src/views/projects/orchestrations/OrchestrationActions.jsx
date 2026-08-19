import React from 'react';
import { Link } from 'react-router-dom';

const OrchestrationActions = ({ status, orchestrationId, onPlay, onPause, onStop, onEdit, onDelete }) => {
  return (
    <div className="text-end">
      {status === 'INPROGRESS' && (
        <>
          <Link to="#" title="Pause" onClick={() => onPause(orchestrationId)} className="me-3">
            <i className="feather icon-pause-circle icon-md text-warning" />
          </Link>
          <Link to="#" title="Stop" onClick={() => onStop(orchestrationId)} className="me-3">
            <i className="feather icon-stop-circle icon-md text-danger" />
          </Link>
        </>
      )}

      {status === 'PAUSED' && (
        <>
          <Link to="#" title="Play" onClick={() => onPlay(orchestrationId)} className="me-3">
            <i className="feather icon-play-circle icon-md text-primary" />
          </Link>
          <Link to="#" title="Stop" onClick={() => onStop(orchestrationId)} className="me-3">
            <i className="feather icon-stop-circle icon-md text-danger" />
          </Link>
        </>
      )}

      {['NOT_EXECUTED', 'ABORTED', 'PASSED', 'FAILED', 'ERROR'].includes(status) && (
        <>
          <Link to="#" title="Play" onClick={() => onPlay(orchestrationId)} className="me-3">
            <i className="feather icon-play-circle icon-md text-primary" />
          </Link>
          <Link to="#" title="Edit" onClick={() => onEdit(orchestrationId)} className="me-2">
            <i className="feather icon-action edit icon-edit" />
          </Link>
          <Link to="#" title="Delete" onClick={() => onDelete(orchestrationId)} className="me-2">
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

export default OrchestrationActions;
