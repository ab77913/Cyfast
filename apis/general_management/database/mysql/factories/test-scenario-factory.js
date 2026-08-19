"use strict";

const helpers = require("../../../helpers");
const { TestScenario, Requirement } = require("../models");

const requirementInclude = () => [
  {
    model: Requirement,
    as: "requirement",
    attributes: ["requirement_id", "requirement_no", "title"],
    required: false,
  },
];

const getByFilter = async (filters, sort = [], page = null, size = null) => {
  sort = sort.length > 0 ? sort : ["created_date", "Desc"];
  const { limit, offset, page: pageNum, size: pageSizeNum } =
    helpers.normalizePaging(page, size);

  const rows = await TestScenario.findAll({
    limit,
    offset,
    where: filters,
    order: [sort],
    include: requirementInclude(),
  });

  const totalItems = await TestScenario.count({
    where: filters,
  });

  const pagination = helpers.buildPaginationMeta(
    totalItems,
    pageNum,
    pageSizeNum,
  );

  return {
    data: rows,
    pagination,
  };
};

const getById = async (testScenarioId) => {
  return TestScenario.findByPk(testScenarioId, {
    include: requirementInclude(),
  });
};

module.exports = {
  getByFilter,
  getById,
};
