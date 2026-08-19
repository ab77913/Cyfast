"use strict";

const helpers = require("../../../helpers");
const { TestCase } = require("../models");
const testCaseData = require("../data/testCases");

const getByFilter = async (filters, sort = [], page = null, size = null, include = null) => {
  try {
    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const testCases = await TestCase.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
      include: include,
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (testCases && testCases.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: testCases,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getCountByFilter = async (filters) => {
  const testCasesCount = await TestCase.count({
    where: filters,
  });

  return testCasesCount;
};

const getById = async (testCaseId) => {
  const testCase = await TestCase.findOne({
    where: {
      TestCaseId: testCaseId,
    },
  });

  return testCase;
};

const add = async (testCaseData) => {
  const testCase = await TestCase.create(testCaseData);

  return testCase;
};

const update = async (testCaseId, testCaseData) => {
  const testCase = await getById(testCaseId);
  if (!testCase) throw new Error("TestCase not found");

  await testCase.update(testCaseData);

  return testCase;
};

const remove = async (testCaseId) => {
  const testCase = await TestCase.destroy({
    where: {
      TestCaseId: testCaseId,
    },
  });

  return testCase;
};

const getTestCasesWithTestScriptsByIds = async (testCaseIds) => {
  try {
    let testCases = await testCaseData.getWithTestScriptsByIds(testCaseIds);

    return testCases;
  } catch (error) {
    console.log(error);

    throw new Error(error);
  }
};

const getTestCaseWithProjectIdAndTestCaseNo = async (projectId, testCaseNo) => {
  try {
    let testCase = await testCaseData.getWithProjectIdAndTestCaseNo(projectId, testCaseNo);

    return testCase;
  } catch (error) {
    console.log(error);

    throw new Error(error);
  }
};

const getTestCaseWithProjectIdAndTestCaseName = async (projectId, testCaseName) => {
  try {
    let testCase = await testCaseData.getWithProjectIdAndTestCaseName(projectId, testCaseName);

    return testCase;
  } catch (error) {
    console.log(error);

    throw new Error(error);
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const deletedTestCases = await TestCase.destroy({
      where: {
        ProjectId: projectId,
      },
    });

    return deletedTestCases;
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
  getTestCasesWithTestScriptsByIds,
  getTestCaseWithProjectIdAndTestCaseNo,
  getTestCaseWithProjectIdAndTestCaseName,
};
