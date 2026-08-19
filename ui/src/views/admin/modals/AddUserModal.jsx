import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Row, Col } from 'react-bootstrap';
import Select from 'react-select';
import { getRoles } from 'utils/apiServices';

const AddUserModal = ({ show, onHide, onSubmit, userData, setUserData, isEditing }) => {
  const [roleOptions, setRoleOptions] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (show) {
      fetchRoles();
      setErrors({});
    }
  }, [show]);

  const fetchRoles = async () => {
    try {
      const res = await getRoles();
      if (res?.data?.data) {
        const roles = res.data.data
          .filter((role) => role.is_active)
          .map((role) => ({
            label: role.name,
            value: role.role_id
          }));
        setRoleOptions(roles);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRoleChange = (selectedOptions) => {
    setUserData((prev) => ({
      ...prev,
      role_ids: selectedOptions ? selectedOptions.map((option) => option.value) : []
    }));
  };

  // Validate all required fields
  const validate = () => {
    const newErrors = {};
    if (!userData.first_name?.trim()) newErrors.first_name = 'First name is required';
    if (!userData.last_name?.trim()) newErrors.last_name = 'Last name is required';
    if (!userData.email?.trim()) newErrors.email = 'Email is required';
    if (!userData.password?.trim() && !isEditing) newErrors.password = 'Password is required';
    if (!userData.role_ids || userData.role_ids.length === 0) newErrors.role_ids = 'Please select at least one role';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      const submitData = {
        ...userData,
        role_ids: userData.role_ids,
        is_active: userData.is_active
      };
      onSubmit(submitData);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header>
        <Modal.Title> {isEditing ? 'Update User' : 'Add New User'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3" controlId="firstName">
                <Form.Label>
                  First Name <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  name="first_name"
                  value={userData.first_name}
                  onChange={handleChange}
                  placeholder="Enter first name"
                  isInvalid={!!errors.first_name}
                />
                <Form.Control.Feedback type="invalid">{errors.first_name}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3" controlId="lastName">
                <Form.Label>
                  Last Name <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  name="last_name"
                  value={userData.last_name}
                  onChange={handleChange}
                  placeholder="Enter last name"
                  isInvalid={!!errors.last_name}
                />
                <Form.Control.Feedback type="invalid">{errors.last_name}</Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3" controlId="email">
            <Form.Label>
              Email <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="email"
              name="email"
              value={userData.email}
              onChange={handleChange}
              placeholder="Enter email"
              isInvalid={!!errors.email}
            />
            <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
          </Form.Group>

          {!isEditing && (
            <Form.Group className="mb-3" controlId="password">
              <Form.Label>
                Password <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="password"
                name="password"
                value={userData.password}
                onChange={handleChange}
                placeholder="Enter password"
                isInvalid={!!errors.password}
              />
              <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
            </Form.Group>
          )}

          <Form.Group className="mb-3" controlId="roles">
            <Form.Label>
              Roles <span className="text-danger">*</span>
            </Form.Label>
            <Select
              isMulti
              name="role_ids"
              options={roleOptions}
              classNamePrefix="select"
              onChange={handleRoleChange}
              placeholder="Select roles"
              value={roleOptions.filter((opt) => Array.isArray(userData.role_ids) && userData.role_ids.includes(opt.value))}
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: '80px',
                  flexWrap: 'wrap',
                  overflow: 'auto'
                }),
                multiValue: (base) => ({
                  ...base,
                  whiteSpace: 'normal',
                  maxWidth: '100%'
                }),
                multiValueLabel: (base) => ({
                  ...base,
                  whiteSpace: 'normal'
                }),
                menu: (base) => ({
                  ...base,
                  zIndex: 9999
                })
              }}
              className={errors.role_ids ? 'is-invalid' : ''}
            />
            {errors.role_ids && <div className="invalid-feedback d-block">{errors.role_ids}</div>}
          </Form.Group>

          <Form.Group className="custom-checkbox-dark mb-3" controlId="isActiveCheckbox">
            <Form.Check type="checkbox" label="Active" name="is_active" checked={userData.is_active} onChange={handleChange} />
          </Form.Group>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit}>
          {isEditing ? 'Update User' : 'Add User'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddUserModal;
