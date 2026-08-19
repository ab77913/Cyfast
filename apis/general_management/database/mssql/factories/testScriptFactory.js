"use strict";

const helpers = require("../../../helpers");
const { TestScript } = require("../models");
const testScriptData = require("../data/testScripts");

const getByFilter = async (filters, sort = [], page = null, size = null, include = null) => {
  try {
    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const testScripts = await TestScript.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
      include: include,
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (testScripts && testScripts.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

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
      TestScriptId: testScriptId,
    },
  });

  return testScript;
};

const add = async (testScriptData) => {
  const testScript = await TestScript.create(testScriptData);

  return testScript;
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
      TestScriptId: testScriptId,
    },
  });

  return testScript;
};

const removeByProjectId = async (projectId) => {
  try {
    const deletedTestScripts = await TestScript.destroy({
      where: {
        ProjectId: projectId,
      },
    });

    return deletedTestScripts;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getTestScriptByProjectIdAndTestScriptName = async (projectId, testScriptName) => {
  try {
    let testScript = await testScriptData.getByProjectIdAndTestScriptName(projectId, testScriptName);

    return testScript.length;
  } catch (error) {
    console.log(error);

    throw new Error(error);
  }
};

const getTestScriptByProjectIdAndTestScriptFilePath = async (projectId, testScriptFilePath) => {
  try {
    let testScript = await testScriptData.getByProjectIdAndTestScriptFilePath(projectId, testScriptFilePath);

    return testScript;
  } catch (error) {
    console.log(error);

    throw new Error(error);
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
  getTestScriptByProjectIdAndTestScriptName,
  getTestScriptByProjectIdAndTestScriptFilePath,
};
