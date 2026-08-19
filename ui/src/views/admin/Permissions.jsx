import React, { useState, useEffect } from 'react';
import { Table, Badge, Row, Col, Form, Button } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
import Select from 'react-select';
import { Link } from 'react-router-dom';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import SuccessModal from 'views/shared-modals/SuccessModal';

import AddPermissionModal from './modals/AddPermissionModal';
import { getPermissions, createPermission, updatePermission, deletePermission } from 'utils/apiServices';

const Permissions = () => {
  const [permissions, setPermissions] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const permissionStatusOptions = [
    { label: 'Active', value: true },
    { label: 'In active', value: false }
  ];

  const [showForm, setShowForm] = useState(false);
  const [newpermission, setNewpermission] = useState({
    permission_id: null,
    name: '',
    description: '',
    is_active: true,
    organization_id: 1,
    parent_permission_id: null
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await getPermissions({
          is_active: statusFilter?.value,
          q: searchTerm || undefined
        });
        const rows = res?.data?.data || res?.data || res || [];
        setPermissions(Array.isArray(rows) ? rows : []);
      } catch (error) {
        console.error('Error fetching permission:', error);
        setPermissions([]);
      }
    })();
  }, [statusFilter, searchTerm]);

  const handleDeletePermissionAction = (permission) => {
    setSelectedPermission(permission);
    setShowDeleteModal(true);
  };

  const handleEditPermissionAction = (permission) => {
    setNewpermission({
      permission_id: permission.permission_id,
      name: permission.name || '',
      description: permission.description || '',
      is_active: permission.is_active,
      organization_id: permission.organization_id || 1,
      parent_permission_id: permission.parent_permission_id
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = async () => {
    try {
      // deletePermission api call
      // const res = await deletePermission(selectedPermission.permission_id);
      // if (res.status === 200) {
      await deletePermission(selectedPermission.permission_id);
      setSuccessMsg(`Permission "${selectedPermission.name}" deleted`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);

      const res = await getPermissions({
        is_active: statusFilter?.value,
        q: searchTerm || undefined
      });
      const rows = res?.data?.data || res?.data || res || [];
      setPermissions(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error('Error deleting permission:', e);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleAddPermissionClick = () => {
    setIsEditing(false);
    setNewpermission({
      permission_id: null,
      name: '',
      description: '',
      is_active: true,
      organization_id: 1,
      parent_permission_id: null
    });
    setShowForm(true);
  };

  const filteredPermissions = permissions.filter((permissions) => {
    const matchesStatus = statusFilter === null || permission.is_active === statusFilter.value;
    const matchesSearch =
      permissions.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permissions.description?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const onSubmitForm = async () => {
    const payload = {
      name: newpermission.name?.trim(),
      description: newpermission.description?.trim(),
      is_active: !!newpermission.is_active,
      organization_id: newpermission.organization_id,
      parent_permission_id: newpermission.parent_permission_id
    };

    try {
      if (isEditing) {
        const id = newpermission.permission_id ?? newpermission.id;
        await updatePermission(id, payload);
        setSuccessMsg(`Permission "${payload.name}" updated`);
      } else {
        await createPermission(payload);
        setSuccessMsg(`Permission "${payload.name}" created`);
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);

      const res = await getPermissions({
        is_active: statusFilter?.value,
        q: searchTerm || undefined
      });
      const rows = res?.data?.data || res?.data || res || [];
      setPermissions(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error('Error saving permission:', e);
    } finally {
      setShowForm(false);
    }
  };

  return (
    <div className="container-fluid p-1 container-root">
      <div className="sticky-Header">
        <h4 className="mb-0 page-title">
          <span className="text-primary">Admin</span>
          <span className="text-muted">
            {' '}
            / <FormattedMessage id="permissions" defaultMessage="Permissions" />
          </span>
        </h4>
      </div>

      <h2 className="fs-4 my-3">Permissions</h2>

      <div className="bg-white p-4 rounded mb-4">
        <Row className="align-items-center mb-3">
          <Col md="auto" className="d-flex align-items-center">
            <label className="form-label fw-semibold mb-0 me-2">Status</label>
            <div className="select-wrapper">
              <Select
                classNamePrefix="select"
                name="permissionStatus"
                options={permissionStatusOptions}
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
                placeholder="Search Permission"
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
                handleAddPermissionClick();
              }}
            >
              <FormattedMessage id="add_permission" defaultMessage="Add Permission" />
            </Button>
          </Col>
        </Row>

        <Table hover responsive className="align-middle">
          <thead className="thead-light">
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th className="text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredPermissions.map((permission) => (
              <tr key={permission.permission_id}>
                <td>{permission.name}</td>
                <td>{permission.description || '-'}</td>
                <td>
                  <Badge className="status-badge" bg={permission.is_active ? 'success' : 'secondary'}>
                    {permission.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="text-center">
                  <Link
                    to="#"
                    className="text-primary mx-1"
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditPermissionAction(permission);
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
                      handleDeletePermissionAction(permission);
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
        toDelete={selectedPermission?.name || 'this permission'}
      />

      <SuccessModal show={showSuccess} onHide={() => setShowSuccess(false)} message={successMsg} iconColor="#FF5C5C" />

      <AddPermissionModal
        show={showForm}
        onHide={() => {
          setShowForm(false);
          setIsEditing(false);
        }}
        onSubmit={onSubmitForm}
        permissionData={newpermission}
        setPermissionData={setNewpermission}
        isEditing={isEditing}
      />
    </div>
  );
};

export default Permissions;
