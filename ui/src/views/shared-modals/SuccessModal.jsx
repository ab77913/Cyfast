import React from 'react';
import { Modal } from 'react-bootstrap';
import { FiCheck } from 'react-icons/fi';
import PropTypes from 'prop-types';

const SuccessModal = ({ show, onHide, message, iconColor = '#2EDAB6' }) => {
  //const iconColor = '#2EDAB6';
  return (
    <Modal show={show} onHide={onHide} centered size="md" backdrop="static" keyboard={false} dialogClassName="success-modal">
      <Modal.Body className="text-center p-4" style={{ margin: 28 }}>
        <div
          className="confirm-modal-icon mx-auto mb-3"
          style={{
            backgroundColor: iconColor
          }}
        >
          <FiCheck size={28} color="white" />
        </div>
        <h6 className="mb-0">{message}</h6>
      </Modal.Body>
    </Modal>
  );
};

SuccessModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  message: PropTypes.string.isRequired,
  iconColor: PropTypes.string
};

export default SuccessModal;
