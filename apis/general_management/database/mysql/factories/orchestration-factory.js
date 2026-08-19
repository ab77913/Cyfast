// Sorting Format: Corrected the default sorting format to [['created_date', 'DESC']].
// Pagination Filters: Updated getCountByFilter to use the same filters used in getByFilter.
// include: Modified to handle include parameter correctly.

"use strict";

const { Op } = require("sequelize");
const helpers = require("../../../helpers");
const {
  Project,
  Orchestration,
  OrchestrationConfiguration,
  OrchestrationCustomConfiguration,
  OrchestrationTestCase,
} = require("../models");
const orchestrationTestCaseFactory = require("./orchestration-test-case-factory");

const getByFilter = async (
  filters,
  sort = [],
  page = null,
  size = null,
  include = null
) => {
  try {
    sort = sort.length > 0 ? sort : [["created_date", "DESC"]];
    let { limit, offset } = helpers.getPagination(page, size);

    const orchestrations = await Orchestration.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: sort,
      include: include ? include.split(",") : undefined,
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (orchestrations && orchestrations.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: orchestrations,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getCountByFilter = async (filters) => {
  try {
    return await Orchestration.count({ where: filters });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getById = async (orchestrationId) => {
  try {
    return await Orchestration.findOne({
      where: { orchestration_id: orchestrationId },
      include: [
        {
          model: Project,
          as: "project",
        },
        {
          model: OrchestrationTestCase,
          as: "tests",
        },
        {
          model: OrchestrationConfiguration,
          as: "configuration",
        },
        {
          model: OrchestrationCustomConfiguration,
          as: "custom_configurations",
        },
      ],
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getByProjectId = async (projectId, sort = []) => {
  try {
    sort = sort.length > 0 ? sort : [["created_date", "DESC"]];
    return await Orchestration.findAll({
      where: { project_id: projectId },
      order: sort,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const add = async (orchestrationData) => {
  try {
    return await Orchestration.create(orchestrationData);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const update = async (orchestrationId, orchestrationData) => {
  try {
    const orchestration = await getById(orchestrationId);
    if (!orchestration) throw new Error("Orchestration not found");

    return await orchestration.update(orchestrationData);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const remove = async (orchestrationId) => {
  try {
    const rowsDeleted = await Orchestration.destroy({
      where: { orchestration_id: orchestrationId },
    });

    return rowsDeleted;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await Orchestration.destroy({
      where: { project_id: projectId },
    });

    return rowsDeleted;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Test Cases

const getTestCases = async (orchestrationId, filters = {}, include = []) => {
  try {
    const orchestration = await getById(orchestrationId);
    if (!orchestration) throw new Error("Orchestration not found");

    return await OrchestrationTestCase.findAll({
      where: { orchestration_id: orchestrationId, ...filters },
      include: include ? include.split(",") : null,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const updateTestCases = async (orchestrationId, testCasesData) => {
  try {
    const orchestration = await getById(orchestrationId);
    if (!orchestration) throw new Error("Orchestration not found");

    let deletedCount = 0;
    let addedCount = 0;

    if (testCasesData.length > 0) {
      const existingTestCases = await getTestCases(orchestrationId);
      const keyedNewTestCases = helpers.rekey(testCasesData, "test_case_id");

      for (const existingTestCase of existingTestCases) {
        if (keyedNewTestCases[existingTestCase.test_case_id]) {
          const newTestCaseEnvIds = keyedNewTestCases[
            existingTestCase.test_case_id
          ].map((item) => item.TestEnvironmentId);
          if (!newTestCaseEnvIds.includes(existingTestCase.TestEnvironmentId)) {
            await orchestrationTestCaseFactory.remove(
              existingTestCase.orchestration_test_case_id
            );
            deletedCount++;
          }
        } else {
          await orchestrationTestCaseFactory.remove(
            existingTestCase.orchestration_test_case_id
          );
          deletedCount++;
        }
      }

      for (const newTestCase of testCasesData) {
        newTestCase.project_id = orchestration.project_id;
        newTestCase.orchestration_id = orchestration.orchestration_id;
        await orchestrationTestCaseFactory.addOrUpdate(newTestCase);
        addedCount++;
      }
    }

    return { deleted: deletedCount, added: addedCount };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  getByProjectId,
  add,
  update,
  remove,
  removeByProjectId,
  getTestCases,
  updateTestCases,
};
