// Sorting:Ensure that the sort array is in the correct format. Sequelize expects sorting to be in the form of [['column', 'ASC/DESC']]
// getCountByFilter: Updated to use filters from getByFilter.
// addOrUpdate: Ensured correct usage of orchestration_test_case_id and fixed destructuring of getByFilter result.
// remove: Returns the number of deleted rows.

"use strict";

const helpers = require("../../../helpers");
const { OrchestrationTestCase } = require("../models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");

const getByFilter = async (filters, sort = [], page = null, size = null) => {
  try {
    page = page || 1;
    size = size || 10;

    // Ensure sorting format is correct
    sort = sort.length > 0 ? sort : [["created_date", "DESC"]];
    let { limit, offset } = helpers.getPagination(page, size);

    const orchestrationTestCases = await OrchestrationTestCase.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: sort,
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (orchestrationTestCases && orchestrationTestCases.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: orchestrationTestCases,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getCountByFilter = async (filters) => {
  try {
    const orchestrationTestCasesCount = await OrchestrationTestCase.count({
      where: filters,
    });

    return orchestrationTestCasesCount;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getById = async (orchestrationTestCaseId) => {
  try {
    const orchestrationTestCase = await OrchestrationTestCase.findOne({
      where: {
        orchestration_test_case_id: orchestrationTestCaseId,
      },
    });

    return orchestrationTestCase;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getByOrchestrationId = async (orchestrationId) => {
  try {
    const orchestrationTestCases = await OrchestrationTestCase.findAll({
      where: {
        orchestration_id: orchestrationId,
      },
    });

    return orchestrationTestCases;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const add = async (orchestrationTestCaseData) => {
  try {
    const orchestrationTestCase = await OrchestrationTestCase.create(
      orchestrationTestCaseData
    );

    return orchestrationTestCase;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const update = async (orchestrationTestCaseId, orchestrationTestCaseData) => {
  try {
    const orchestrationTestCase = await getById(orchestrationTestCaseId);
    if (!orchestrationTestCase)
      throw new Error("OrchestrationTestCase not found");

    await orchestrationTestCase.update(orchestrationTestCaseData);

    return orchestrationTestCase;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const addOrUpdate = async (orchestrationTestCaseData) => {
  try {
    let { data: orchestrationTestCases } = await getByFilter({
      orchestration_id: orchestrationTestCaseData.orchestration_id,
      test_case_id: orchestrationTestCaseData.test_case_id,
    });

    if (orchestrationTestCases.length > 0) {
      return await update(
        orchestrationTestCases[0].orchestration_test_case_id,
        orchestrationTestCaseData
      );
    } else {
      return await add(orchestrationTestCaseData);
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const remove = async (orchestrationTestCaseId) => {
  try {
    const rowsDeleted = await OrchestrationTestCase.destroy({
      where: {
        orchestration_test_case_id: orchestrationTestCaseId,
      },
    });

    return rowsDeleted; // Return the number of deleted rows
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const removeByOrchestrationId = async (orchestrationId) => {
  try {
    const rowsDeleted = await OrchestrationTestCase.destroy({
      where: {
        orchestration_id: orchestrationId,
      },
    });

    return rowsDeleted; // Return the number of deleted rows
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await OrchestrationTestCase.destroy({
      where: {
        project_id: projectId,
      },
    });

    return rowsDeleted; // Return the number of deleted rows
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const removeByFilter = async (filters) => {
  try {
    const rowsDeleted = await OrchestrationTestCase.destroy({
      where: filters,
    });
    return rowsDeleted; // Return the number of deleted rows
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  getByOrchestrationId,
  add,
  update,
  addOrUpdate,
  remove,
  removeByOrchestrationId,
  removeByProjectId,
  removeByFilter,
};
