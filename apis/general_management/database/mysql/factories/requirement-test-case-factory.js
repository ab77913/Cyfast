// Fixed default sorting to ensure proper format ([["created_date", "DESC"]]).

"use strict";

const helpers = require("../../../helpers");
const { RequirementTestCase } = require("../models");
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
  let { limit, offset } = helpers.getPagination(page, size);

  const requirementTestCases = await RequirementTestCase.findAll({
    limit: limit,
    offset: offset,
    where: filters,
    order: [sort],
    include: include,
  });

  let pagination = {};
  const totalItems = await getCountByFilter(filters);
  if (requirementTestCases && requirementTestCases.length > 0) {
    pagination = {
      totalItems: totalItems,
      totalPages: Math.ceil(totalItems / size),
      currentPage: page,
    };
  }

  return {
    data: requirementTestCases,
    pagination: pagination,
  };
};

const getCountByFilter = async (filters) => {
  const requirementTestCasesCount = await RequirementTestCase.count({
    where: filters,
  });

  return requirementTestCasesCount;
};

const getById = async (requirementTestCaseId) => {
  const requirementTestCase = await RequirementTestCase.findOne({
    where: {
      requirement_test_case_id: requirementTestCaseId,
    },
  });

  return requirementTestCase;
};

const add = async (requirementData) => {
  const requirementTestCase = await RequirementTestCase.create(requirementData);

  return requirementTestCase;
};

const update = async (requirementTestCaseId, requirementData) => {
  const requirementTestCase = await getById(requirementTestCaseId);
  if (!requirementTestCase) throw new Error("Requirement Test Case not found");

  await requirementTestCase.update(requirementData);

  return requirementTestCase;
};

const remove = async (requirementTestCaseId) => {
  const requirementTestCase = await RequirementTestCase.destroy({
    where: {
      requirement_test_case_id: requirementTestCaseId,
    },
  });

  return requirementTestCase;
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await RequirementTestCase.destroy({
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
