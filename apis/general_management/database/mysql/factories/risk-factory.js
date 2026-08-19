// Fixed default sorting to ensure proper format ([["created_date", "DESC"]]).

"use strict";

const helpers = require("../../../helpers");
const { Risk } = require("../models");
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

  const risks = await Risk.findAll({
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
    data: risks,
    pagination: pagination,
  };
};

const getCountByFilter = async (filters) => {
  const risksCount = await Risk.count({
    where: filters,
  });

  return risksCount;
};

const getById = async (riskId) => {
  const risk = await Risk.findOne({
    where: {
      risk_id: riskId,
    },
  });

  return risk;
};

const add = async (riskData) => {
  const risk = await Risk.create(riskData);

  return risk;
};

const update = async (riskId, riskData) => {
  const risk = await getById(riskId);
  if (!risk) throw new Error("Risk not found");

  await risk.update(riskData);

  return risk;
};

const remove = async (riskId) => {
  const risk = await Risk.destroy({
    where: {
      risk_id: riskId,
    },
  });

  return risk;
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await Risk.destroy({
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
