// Error Propagation: Ensure that errors are properly thrown to be handled by calling functions or middleware.
// Instance Methods: For updating and deleting records, it's recommended to first fetch the record and use instance methods for operations.
// Field Names: Ensure the field names like test_case_id match your MySQL schema

"use strict";

const { Op } = require("sequelize");
const helpers = require("../../../helpers");
const { TestCase } = require("../models");
const testCaseData = require("../data/test-cases");

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

    const testCases = await TestCase.findAll({
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
      data: testCases,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getCountByFilter = async (filters) => {
  try {
    const testCasesCount = await TestCase.count({
      where: filters,
    });

    return testCasesCount;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getById = async (testCaseId) => {
  try {
    const testCase = await TestCase.findOne({
      where: {
        test_case_id: testCaseId,
      },
    });

    return testCase;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getByTestCaseNo = async (
  testCaseNo,
  projectId,
  organizationId = null
) => {
  try {
    let testCase = await TestCase.findOne({
      where: {
        test_case_no: testCaseNo,
        project_id: projectId,
      },
    });

    return testCase;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getByTestCaseNoOrTestCaseDesc = async (
  testCaseNo,
  testDesc,
  projectId,
  organizationId = null
) => {
  try {
    let testCase = await TestCase.findOne({
      where: {
        project_id: projectId,
        [Op.or]: [{ test_case_no: testCaseNo }, { description: testDesc }],
      },
    });

    return testCase;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getWithTestScriptsByIds = async (testCaseIds) => {
  try {
    let testCases = await testCaseData.getWithTestScriptsByIds(testCaseIds);

    return testCases;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getByProjectIdAndTestCaseNo = async (projectId, testCaseNo) => {
  try {
    let testCase = await testCaseData.getByProjectIdAndTestCaseNo(
      projectId,
      testCaseNo
    );

    return testCase;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getByProjectIdAndTestCaseName = async (projectId, testCaseName) => {
  try {
    let testCase = await testCaseData.getByProjectIdAndTestCaseName(
      projectId,
      testCaseName
    );

    return testCase;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const add = async (testCaseData) => {
  try {
    const testCase = await TestCase.create(testCaseData);

    return testCase;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const addOrFetch = async (testCaseData) => {
  try {
    let testCase = await TestCase.findOne({
      where: {
        project_id: testCaseData.project_id,
        test_suite_id: testCaseData.test_suite_id,
        test_script_id: testCaseData.test_script_id,
        name: testCaseData.name,
        test_case_no: testCaseData.test_case_no,
      },
    });

    if (testCase == null) {
      testCase = await TestCase.create(testCaseData);
    }

    return testCase;
  } catch (err) {
    console.log("Error while adding test case - ", err);

    return null;
  }
};

const update = async (testCaseId, testCaseData) => {
  try {
    const testCase = await getById(testCaseId);
    if (!testCase) throw new Error("TestCase not found");

    await testCase.update(testCaseData);

    return testCase;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const remove = async (testCaseId) => {
  try {
    const testCase = await getById(testCaseId);
    if (!testCase) throw new Error("TestCase not found");

    await TestCase.destroy({
      where: {
        test_case_id: testCaseId,
      },
    });

    return testCase;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await TestCase.destroy({
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
  getByTestCaseNo,
  getByTestCaseNoOrTestCaseDesc,
  getWithTestScriptsByIds,
  getByProjectIdAndTestCaseNo,
  getByProjectIdAndTestCaseName,
  add,
  addOrFetch,
  update,
  remove,
  removeByProjectId,
};
