import React, { useState, useEffect } from 'react';
import { Table, Badge, Row, Col, Form, Button } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
import Select from 'react-select';
import { Link } from 'react-router-dom';
import { getRoles, createRole, updateRole, deleteRole } from 'utils/apiServices';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import SuccessModal from 'views/shared-modals/SuccessModal';
import AddRoleModal from './modals/AddRoleModal';

const Roles = () => {
  const [roles, setRoles] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRole, setselectedRole] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);

  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    is_active: true,
    organization_id: 1,
    parent_role_id: null
  });

  const roleStatusOptions = [
    { label: 'Active', value: true },
    { label: 'In active', value: false }
  ];

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await getRoles();
      if (res?.data?.data) {
        setRoles(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleDeleteRoleAction = (role) => {
    setselectedRole(role);
    setShowDeleteModal(true);
  };

  const handleEditRoleAction = (role) => {
    setNewRole({
      role_id: role.role_id,
      name: role.name || '',
      description: role.description || '',
      is_active: role.is_active,
      organization_id: role.organization_id || 1,
      parent_role_id: role.parent_role_id
    });
    setIsEditing(true);
    setShowAddRoleModal(true);
  };

  const handleDelete = async () => {
    // deleteRole api call
    // const res = await deleteRole(selectedRole.role_id);
    // if (res.status === 200) {
    if (!selectedRole) return;
    try {
      const res = await deleteRole(selectedRole.role_id);
      if (res.status === 200) {
        setSuccessMsg(`Role "${selectedRole.name}" deleted`);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        fetchRoles();
      }
    } catch (err) {
      console.error(' Failed to delete role: ', err);
    }
    // }
    setShowDeleteModal(false);
  };

  const handleAddRoleClick = () => {
    setNewRole({
      name: '',
      description: '',
      is_active: true,
      organization_id: 1,
      parent_role_id: null
    });
    setIsEditing(false);
    setShowAddRoleModal(true);
  };

  const handleAddRoleSubmit = async () => {
    try {
      const res = await createRole(newRole);
      if (res.status === 200) {
        setShowAddRoleModal(false);
        setSuccessMsg(`Role "${newRole.name}" added successfully`);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        fetchRoles();
      }
    } catch (err) {
      console.error('Failed to add role:', err);
    }
  };

  const handleUpdateRoleSubmit = async () => {
    try {
      const res = await updateRole(newRole.role_id, newRole);
      if (res.status === 200) {
        setShowAddRoleModal(false);
        setSuccessMsg(`Role "${newRole.name}" updated successfully`);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        fetchRoles();
      }
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const filteredRoles = roles.filter((role) => {
    const matchesStatus = statusFilter === null || role.is_active === statusFilter.value;
    const matchesSearch =
      role.name?.toLowerCase().includes(searchTerm.toLowerCase()) || role.description?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="container-fluid p-1 container-root">
      <div className="sticky-Header">
        <h4 className="mb-0 page-title">
          <span className="text-primary">Admin</span>
          <span className="text-muted">
            {' '}
            / <FormattedMessage id="roles" defaultMessage="Roles" />
          </span>
        </h4>
      </div>

      <h2 className="fs-4 my-3">Roles</h2>

      <div className="bg-white p-4 rounded mb-4">
        <Row className="align-items-center mb-3">
          <Col md="auto" className="d-flex align-items-center">
            <label className="form-label fw-semibold mb-0 me-2">Status</label>
            <div className="select-wrapper">
              <Select
                classNamePrefix="select"
                name="roleStatus"
                options={roleStatusOptions}
                value={statusFilter}
                onChange={(selectedOption) => setStatusFilter(selectedOption)}
                placeholder="All"
                isClearable
                menuPortalTarget={document.body}
                styles={{
                  menuPortal: (base) => ({ ...base, zIndex: 9999 })
                }}
              />
            </div>
          </Col>

          <Col md={4} className="d-flex align-items-center ms-4">
            <div className="input-group">
              <Form.Control
                type="search"
                placeholder="Search Roles"
                value={searchTerm}
                className="search-input"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="input-group-text bg-white">
                <i className="feather icon-search light-icon" />
              </span>
            </div>
          </Col>
          <Col className="text-end d-flex justify-content-end align-items-center">
            <Button
              variant="primary"
              onClick={(e) => {
                e.stopPropagation();
                handleAddRoleClick();
              }}
            >
              <FormattedMessage id="add_new_role" defaultMessage="Add New Role" />
            </Button>
          </Col>
        </Row>

        <Table hover responsive className="align-middle">
          <thead className="thead-light">
            <tr>
              <th>Role Name</th>
              <th>Description</th>
              <th>Status</th>
              <th className="text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoles.map((role) => (
              <tr key={role.role_id}>
                <td>{role.name}</td>
                <td>{role.description || '-'}</td>
                <td>
                  <Badge className="status-badge" bg={role.is_active ? 'success' : 'secondary'}>
                    {role.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="text-center">
                  <Link
                    to="#"
                    className="text-primary mx-1"
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditRoleAction(role);
                    }}
                  >
                    <i className="feather icon-action edit icon-edit" />
                  </Link>
                  <Link
                    to="#"
                    className="text-danger mx-2"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRoleAction(role);
                    }}
                  >
                    <i className="feather icon-action delete icon-trash-2" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <ConfirmDeleteModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onSubmit={handleDelete}
        toDelete={`${selectedRole?.name}`}
      />

      <SuccessModal show={showSuccess} onHide={() => setShowSuccess(false)} message={successMsg} iconColor="#FF5C5C" />
      <AddRoleModal
        show={showAddRoleModal}
        onHide={() => setShowAddRoleModal(false)}
        onSubmit={isEditing ? handleUpdateRoleSubmit : handleAddRoleSubmit}
        roleData={newRole}
        setRoleData={setNewRole}
        isEditing={isEditing}
      />
    </div>
  );
};

export default Roles;
