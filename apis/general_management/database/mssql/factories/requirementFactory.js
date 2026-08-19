"use strict";

const helpers = require("../../../helpers");
const { Requirement } = require("../models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");

const getByFilter = async (filters, sort = [], page = null, size = null, include = null) => {
  sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
  let { limit, offset } = helpers.getPagination(page, size);

  const requirements = await Requirement.findAll({
    limit: limit,
    offset: offset,
    where: filters,
    order: [sort],
    include: include,
  });

  let pagination = {};
  const totalItems = await getCountByFilter(filters);
  if (requirements && requirements.length > 0) {
    pagination = {
      totalItems: totalItems,
      totalPages: Math.ceil(totalItems / size),
      currentPage: page,
    };
  }

  return {
    data: requirements,
    pagination: pagination,
  };
};

const getCountByFilter = async (filters) => {
  const requirementsCount = await Requirement.count({
    where: filters,
  });

  return requirementsCount;
};

const getById = async (requirementId) => {
  const requirement = await Requirement.findOne({
    where: {
      RequirementId: requirementId,
    },
  });

  return requirement;
};

const add = async (requirementData) => {
  const requirement = await Requirement.create(requirementData);

  return requirement;
};

const update = async (requirementId, requirementData) => {
  const requirement = await getById(requirementId);
  if (!requirement) throw new Error("Requirement not found");

  await requirement.update(requirementData);

  return requirement;
};

const remove = async (requirementId) => {
  const requirement = await Requirement.destroy({
    where: {
      RequirementId: requirementId,
    },
  });

  return requirement;
};

const removeByProjectId = async (projectId) => {
  try {
    const deletedReqs = await Requirement.destroy({
      where: {
        ProjectId: projectId,
      },
    });

    return deletedReqs;
  } catch (error) {
    console.log(error);

    return null;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  add,
  update,
  remove,
  removeByProjectId,
};
