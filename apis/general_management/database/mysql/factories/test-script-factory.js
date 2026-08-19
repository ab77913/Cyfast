// Ensure Sequelize is configured for MySQL in your configuration file (e.g., config/database.js).
// Ensure helpers.getPagination provides the correct pagination values for MySQL. Pagination logic generally doesn’t change between MSSQL and MySQL.

"use strict";

const helpers = require("../../../helpers");
const { TestScript } = require("../models");
const testScriptData = require("../data/test-scripts");

const getByFilter = async (
  filters,
  sort = [],
  page = null,
  size = null,
  include = null
) => {
  try {
    sort = sort.length > 0 ? sort : ["created_date", "Desc"];
    const { limit, offset, page: pageNum, size: pageSizeNum } =
      helpers.normalizePaging(page, size);

    const testScripts = await TestScript.findAll({
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
      data: testScripts,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getCountByFilter = async (filters) => {
  const testScriptsCount = await TestScript.count({
    where: filters,
  });

  return testScriptsCount;
};

const getById = async (testScriptId) => {
  const testScript = await TestScript.findOne({
    where: {
      test_script_id: testScriptId,
    },
  });

  return testScript;
};

const getByIds = async (testScriptIds) => {
  const testScripts = await TestScript.findAll({
    where: {
      test_script_id: testScriptIds,
    },
  });
  return testScripts;
};

const getTestScriptByProjectIdAndTestScriptName = async (
  projectId,
  testScriptName
) => {
  try {
    let testScript = await testScriptData.getByProjectIdAndTestScriptName(
      projectId,
      testScriptName
    );

    return testScript.length;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

const getTestScriptByProjectIdAndTestScriptFilePath = async (
  projectId,
  testScriptFilePath
) => {
  try {
    let testScript = await testScriptData.getByProjectIdAndTestScriptFilePath(
      projectId,
      testScriptFilePath
    );

    return testScript;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

const add = async (testScriptData) => {
  const testScript = await TestScript.create(testScriptData);

  return testScript;
};

const addOrFetch = async (testScriptData) => {
  try {
    let testScript = await TestScript.findOne({
      where: {
        project_id: testScriptData.project_id,
        test_suite_id: testScriptData.test_suite_id,
        name: testScriptData.name,
      },
    });

    if (testScript == null) {
      testScript = await TestScript.create(testScriptData);
    }

    return testScript;
  } catch (err) {
    console.log("Error while adding test script - ", err);

    return null;
  }
};

const update = async (testScriptId, testScriptData) => {
  const testScript = await getById(testScriptId);
  if (!testScript) throw new Error("TestScript not found");

  await testScript.update(testScriptData);

  return testScript;
};

const remove = async (testScriptId) => {
  const testScript = await TestScript.destroy({
    where: {
      test_script_id: testScriptId,
    },
  });

  return testScript;
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await TestScript.destroy({
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
  getByIds,
  getTestScriptByProjectIdAndTestScriptName,
  getTestScriptByProjectIdAndTestScriptFilePath,
  addOrFetch,
  add,
  update,
  remove,
  removeByProjectId,
};
