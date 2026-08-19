import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';

const AddRoleModal = ({ show, onHide, onSubmit, roleData, setRoleData, isEditing }) => {
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (show) setErrors({});
  }, [show]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRoleData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!roleData.name?.trim()) newErrors.name = 'Role name is required';
    if (!roleData.description?.trim()) newErrors.description = 'Description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit();
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="md">
      <Modal.Header>
        <Modal.Title>{isEditing ? 'Edit Role' : 'Add New Role'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group controlId="roleName" className="mb-3">
            <Form.Label>
              Role Name <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              name="name"
              value={roleData.name}
              onChange={handleChange}
              placeholder="Enter role name"
              isInvalid={!!errors.name}
            />
            <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group controlId="description" className="mb-3">
            <Form.Label>
              Description <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="description"
              value={roleData.description}
              onChange={handleChange}
              placeholder="Enter role description"
              isInvalid={!!errors.description}
            />
            <Form.Control.Feedback type="invalid">{errors.description}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group controlId="isActiveCheckbox" className="custom-checkbox-dark mb-3">
            <Form.Check type="checkbox" label="Active" name="is_active" checked={roleData.is_active} onChange={handleChange} />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit}>
          {isEditing ? 'Update Role' : 'Add Role'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddRoleModal;

