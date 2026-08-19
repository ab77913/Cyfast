import React, { useState, useEffect } from 'react';
import { Table, Badge, Row, Col, Form, Button } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
import Select from 'react-select';
import { Link } from 'react-router-dom';
import { getUsers, createUser, updateUser, deleteUser } from 'utils/apiServices';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import SuccessModal from 'views/shared-modals/SuccessModal';
import AddUserModal from './modals/AddUserModal';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    organization_id: 1,
    role_ids: [],
    is_active: true
  });

  const userStatusOptions = [
    { label: 'Active', value: true },
    { label: 'In active', value: false }
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await getUsers();
      // Backend returns { data, pagination }; we need the array
      const list = res?.data?.data || res?.data || [];
      setUsers(list);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleDeleteUserAction = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleEditUserAction = (user) => {
    setNewUser({
      user_id: user.user_id,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      password: '',
      is_active: user.is_active,
      organization_id: user.organization_id || 1,
      role_ids: user.roles?.map((role) => role.role_id) || []
    });
    setIsEditing(true); // toggle modal mode to "Edit"
    setShowAddUserModal(true);
  };

  const handleDelete = async () => {
    try {
      const res = await deleteUser(selectedUser.user_id);
      if (res.status === 200) {
        setSuccessMsg(`User "${selectedUser.first_name} ${selectedUser.last_name}" deleted`);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
    setShowDeleteModal(false);
  };

  const handleAddUserClick = () => {
    setNewUser({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      organization_id: 1,
      role_ids: [],
      is_active: true
    });
    setIsEditing(false);
    setShowAddUserModal(true);
  };

  const handleAddUserSubmit = async () => {
    try {
      // API call to create new user
      const res = await createUser(newUser); // pass payload
      if (res.status === 200) {
        setShowAddUserModal(false);
        setSuccessMsg(`User ${newUser.first_name} ${newUser.last_name} added successfully`);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to add user:', err);
    }
  };

  const handleUpdateUserSubmit = async () => {
    try {
      const res = await updateUser(newUser.user_id, newUser);
      if (res.status === 200) {
        setShowAddUserModal(false);
        setSuccessMsg(`User ${newUser.first_name} ${newUser.last_name} updated successfully`);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to update user:', err);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesStatus = statusFilter === null || user.is_active === statusFilter.value;
    const matchesSearch =
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="container-fluid p-1 container-root">
      <div className="sticky-Header">
        <h4 className="mb-0 page-title">
          <span className="text-primary">Admin</span>
          <span className="text-muted">
            {' '}
            / <FormattedMessage id="users" defaultMessage="Users" />
          </span>
        </h4>
      </div>

      <h2 className="fs-4 my-3">Users</h2>

      <div className="bg-white p-4 rounded mb-4">
        <Row className="align-items-center mb-3">
          <Col md="auto" className="d-flex align-items-center">
            <label className="form-label fw-semibold mb-0 me-2">Status</label>
            <div className="select-wrapper">
              <Select
                classNamePrefix="select"
                name="userStatus"
                options={userStatusOptions}
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
                placeholder="Search Users"
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
                handleAddUserClick();
              }}
            >
              <FormattedMessage id="add_user" defaultMessage="Add User" />
            </Button>
          </Col>
        </Row>

        <Table hover responsive className="align-middle">
          <thead className="thead-light">
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th className="text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.user_id}>
                <td>
                  {user.first_name} {user.last_name}
                </td>
                <td>{user.email}</td>
                <td>{user.username === 'admin@cyient.com' ? 'Admin' : 'User'}</td>
                <td>{user.roles?.map((r) => r.name).join(', ') || '—'}</td>
                <td>
                  <Badge className="status-badge" bg={user.is_active ? 'success' : 'secondary'}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="text-center">
                  <Link
                    to="#"
                    className="text-primary mx-1"
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditUserAction(user);
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
                      handleDeleteUserAction(user);
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
        toDelete={`${selectedUser?.first_name} ${selectedUser?.last_name}`}
      />

      <SuccessModal show={showSuccess} onHide={() => setShowSuccess(false)} message={successMsg} iconColor="#FF5C5C" />
      <AddUserModal
        show={showAddUserModal}
        onHide={() => setShowAddUserModal(false)}
        onSubmit={isEditing ? handleUpdateUserSubmit : handleAddUserSubmit}
        userData={newUser}
        setUserData={setNewUser}
        isEditing={isEditing}
      />
    </div>
  );
};

export default Users;
