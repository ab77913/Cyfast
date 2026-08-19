// Sequelize Configuration for MySQL:

// Make sure your Sequelize instance is configured to use MySQL. This configuration is typically set up in a separate file (e.g., config/database.js) and not within the business logic itself. For MySQL, you need to ensure the dialect is set to 'mysql'.
// const { Sequelize } = require('sequelize');

// const sequelize = new Sequelize('mysql://username:password@localhost:3306/your_database', {
//   dialect: 'mysql',
//   logging: false, // Adjust logging as needed
// });

// module.exports = sequelize;

"use strict";

const helpers = require("../../../helpers");
const { TestSuite } = require("../models");
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
      test_suite_id: testSuiteId,
    },
  });

  return testSuite;
};

const add = async (testSuiteData) => {
  const testSuite = await TestSuite.create(testSuiteData);

  return testSuite;
};

const addOrFetch = async (testSuiteData) => {
  try {
    let testSuite = await TestSuite.findOne({
      where: {
        project_id: testSuiteData.project_id,
        name: testSuiteData.name,
        directory_path: testSuiteData.directory_path,
      },
    });

    if (testSuite == null) {
      testSuite = await TestSuite.create(testSuiteData);
    }

    return testSuite;
  } catch (err) {
    console.log("Error while adding test suite - ", err);

    return null;
  }
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
      test_suite_id: testSuiteId,
    },
  });

  return testSuite;
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await TestSuite.destroy({
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
  addOrFetch,
  update,
  remove,
  removeByProjectId,
};
