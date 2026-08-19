/**
 * @module controllers/permission-controller
 * @description Controller for managing permissions in the User Management system.
 * @requires permissionFactory
 */

"use strict";

const config = require("../config.js");
const permissionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/permission-factory");

/**
 * @function getPermissions
 * @description Retrieves all permissions.
 * @param {Object} request - The Fastify request object.
 * @param {Object} reply - The Fastify reply object.
 */
const getPermissions = async (request, reply) => {
  try {
    const { page, size, filters, sort, include } = request.query;

    const permissions = await permissionFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );
    return reply.code(200).send(permissions);
  } catch (error) {
    return reply.code(500).send({ error: "Failed to retrieve permissions" });
  }
};

/**
 * @function getPermission
 * @description Retrieves a specific permission by ID.
 * @param {Object} request - The Fastify request object.
 * @param {Object} reply - The Fastify reply object.
 */
const getPermission = async (request, reply) => {
  try {
    const permissionId = parseInt(request.params.permissionId, 10);
    const permission = await permissionFactory.getById(permissionId);
    if (!permission) {
      return reply.code(404).send({ error: "Permission not found" });
    }
    return reply.code(200).send(permission);
  } catch (error) {
    return reply.code(500).send({ error: "Failed to retrieve permission" });
  }
};

/**
 * @function addPermission
 * @description Adds a new permission.
 * @param {Object} request - The Fastify request object containing permission data.
 * @param {Object} reply - The Fastify reply object.
 */
const addPermission = async (request, reply) => {
  try {
    const permissionData = request.body;
    const newPermission = await permissionFactory.add(permissionData);
    return reply.code(201).send(newPermission);
  } catch (error) {
    return reply.code(500).send({ error: "Failed to add permission" });
  }
};

/**
 * @function updatePermission
 * @description Updates an existing permission by ID.
 * @param {Object} request - The Fastify request object containing updated permission data.
 * @param {Object} reply - The Fastify reply object.
 */
const updatePermission = async (request, reply) => {
  try {
    const permissionId = parseInt(request.params.permissionId, 10);
    const permissionData = request.body;
    const updatedPermission = await permissionFactory.update(
      permissionId,
      permissionData
    );
    if (!updatedPermission) {
      return reply.code(404).send({ error: "Permission not found" });
    }
    return reply.code(200).send(updatedPermission);
  } catch (error) {
    return reply.code(500).send({ error: "Failed to update permission" });
  }
};

/**
 * @function deletePermission
 * @description Deletes a permission by ID.
 * @param {Object} request - The Fastify request object.
 * @param {Object} reply - The Fastify reply object.
 */
const deletePermission = async (request, reply) => {
  try {
    const permissionId = parseInt(request.params.permissionId, 10);
    const deleted = await permissionFactory.remove(permissionId);
    if (!deleted) {
      return reply.code(404).send({ error: "Permission not found" });
    }
    return reply.code(204).send();
  } catch (error) {
    return reply.code(500).send({ error: "Failed to delete permission" });
  }
};

module.exports = {
  getPermissions,
  getPermission,
  addPermission,
  updatePermission,
  deletePermission,
};
