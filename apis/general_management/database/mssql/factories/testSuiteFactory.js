"use strict";

const helpers = require("../../../helpers");
const { TestSuite } = require("../models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");

const getByFilter = async (filters, sort = [], page = null, size = null, include = null) => {
  sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
  let { limit, offset } = helpers.getPagination(page, size);
  console.log(filters);
  const testSuites = await TestSuite.findAll({
    limit: limit,
    offset: offset,
    where: filters,
    order: [sort],
    include: include,
  });

  let pagination = {};
  const totalItems = await getCountByFilter(filters);
  if (testSuites && testSuites.length > 0) {
    pagination = {
      totalItems: totalItems,
      totalPages: Math.ceil(totalItems / size),
      currentPage: page,
    };
  }

  return {
    data: testSuites,
    pagination: pagination,
  };
};

const getCountByFilter = async (filters) => {
  const testSuitesCount = await TestSuite.count({
    where: filters,
  });

  return testSuitesCount;
};

const getById = async (testSuiteId) => {
  const testSuite = await TestSuite.findOne({
    where: {
      TestSuiteId: testSuiteId,
    },
  });

  return testSuite;
};

const add = async (testSuiteData) => {
  const testSuite = await TestSuite.create(testSuiteData);

  return testSuite;
};

const update = async (testSuiteId, testSuiteData) => {
  const testSuite = await getById(testSuiteId);
  if (!testSuite) throw new Error("TestSuite not found");

  await testSuite.update(testSuiteData);

  return testSuite;
};

const remove = async (testSuiteId) => {
  const testSuite = await TestSuite.destroy({
    where: {
      TestSuiteId: testSuiteId,
    },
  });

  return testSuite;
};

const removeByProjectId = async (projectId) => {
  try {
    const deletedTestSuites = await TestSuite.destroy({
      where: {
        ProjectId: projectId,
      },
    });

    return deletedTestSuites;
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
