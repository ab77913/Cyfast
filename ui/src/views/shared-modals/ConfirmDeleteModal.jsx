import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { FiTrash2 } from 'react-icons/fi';

const ConfirmDeleteModal = ({ show, onHide, onSubmit, message = '', toDelete = '' }) => {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Body className="text-center">
        <div className="confirm-modal-icon" style={{ backgroundColor: '#ff5370' }}>
          <FiTrash2 size={28} color="white" />
        </div>
        <p className="confirm-delete-text">
          {message || `Are you sure you want to delete`}
          {toDelete && (
            <>
              <br />
              {`entire "${toDelete}"?`}
            </>
          )}
        </p>
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={onHide} variant="outline-secondary">
          Cancel
        </Button>

        <Button onClick={onSubmit} type="submit" variant="primary">
          Delete
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmDeleteModal;
