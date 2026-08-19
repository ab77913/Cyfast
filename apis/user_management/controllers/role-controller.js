"use strict";

const config = require("../config.js");
const roleFactory = require("../database/" +
  config.db_type_primary +
  "/factories/role-factory");

const getRoles = async (request, reply) => {
  try {
    const { page, size, filters, sort, include } = request.query;

    const roles = await roleFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );

    return reply.code(200).send(roles);
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const getRole = async (request, reply) => {
  try {
    const roleId = request.params.roleId;

    const role = await roleFactory.getById(roleId);

    return reply.code(200).send(role);
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const addRole = async (request, reply) => {
  try {
    const roleData = request.body;

    const role = await roleFactory.add(roleData);

    return reply.code(200).send(role);
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const updateRole = async (request, reply) => {
  try {
    const roleId = request.params.roleId;
    const roleData = request.body;

    const role = await roleFactory.update(roleId, roleData);

    return reply.code(200).send(role);
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const deleteRole = async (request, reply) => {
  try {
    const roleId = request.params.roleId;

    const role = await roleFactory.remove(roleId);

    return reply.code(200).send(role);
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const listRoles = async (request, reply) => {
  try {
    const roles = await roleFactory.getByFilter(null, null, null, null, null);
    const formatted = roles.map(r => ({ id: r.id, name: r.name }));
    return reply.send(formatted);
  } catch (err) {
    console.error("Failed to fetch roles:", err);
    return reply.code(500).send({ error: "Failed to fetch roles" });
  }
};

module.exports = {
  getRoles,
  getRole,
  addRole,
  updateRole,
  deleteRole,
  listRoles,
};
