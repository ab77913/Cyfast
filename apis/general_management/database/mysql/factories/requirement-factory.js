// Fixed default sorting to ensure proper format ([["created_date", "DESC"]]).

"use strict";

const helpers = require("../../../helpers");
const { Requirement } = require("../models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");

const getByFilter = async (
  filters,
  sort = [],
  page = null,
  size = null,
  include = null
) => {
  sort = sort.length > 0 ? sort : ["created_date", "Desc"];
  const { limit, offset, page: pageNum, size: pageSizeNum } =
    helpers.normalizePaging(page, size);

  const requirements = await Requirement.findAll({
    limit: limit,
    offset: offset,
    where: filters,
    order: [sort],
    include: include,
  });

  const totalItems = await getCountByFilter(filters);
  const pagination = helpers.buildPaginationMeta(
    totalItems,
    pageNum,
    pageSizeNum,
  );

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
      requirement_id: requirementId,
    },
  });

  return requirement;
};

const add = async (requirementData, options = {}) => {
  const requirement = await Requirement.create(requirementData, options);

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
      requirement_id: requirementId,
    },
  });

  return requirement;
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await Requirement.destroy({
      where: {
        project_id: projectId,
      },
    });

    return rowsDeleted;
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
