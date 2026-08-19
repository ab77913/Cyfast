"use strict";

const helpers = require("../../../helpers");
const { TestSource } = require("../models");

const getByFilter = async (
  filters,
  sort = [],
  page = null,
  size = null,
  include = null
) => {
  try {
    sort = sort.length > 0 ? sort : ["created_date", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const testSources = await TestSource.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
      include: include,
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (testSources && testSources.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: testSources,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getCountByFilter = async (filters) => {
  try {
    const testSourcesCount = await TestSource.count({
      where: filters,
    });

    return testSourcesCount;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getById = async (testSourceId) => {
  try {
    const testSource = await TestSource.findOne({
      where: {
        test_source_id: testSourceId,
      },
    });

    return testSource;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getByProjectId = async (projectId, isDefault = true) => {
  try {
    const testSources = await TestSource.findAll({
      where: {
        project_id: projectId,
        is_default: isDefault, // Filter by default status if needed
      },
    });

    return testSources;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const add = async (testSourceData) => {
  try {
    const testSource = await TestSource.create(testSourceData);

    return testSource;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const update = async (testSourceId, testSourceData) => {
  try {
    const testSource = await getById(testSourceId);
    if (!testSource) throw new Error("TestSource not found");

    await testSource.update(testSourceData);

    return testSource;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const remove = async (testSourceId) => {
  try {
    const testSource = await getById(testSourceId);
    if (!testSource) throw new Error("TestSource not found");

    await TestSource.destroy({
      where: {
        test_source_id: testSourceId,
      },
    });

    return testSource;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await TestSource.destroy({
      where: {
        project_id: projectId,
      },
    });

    return rowsDeleted;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const setDefault = async (testSourceId) => {
  try {
    const testSource = await getById(testSourceId);
    if (!testSource) throw new Error("TestSource not found");

    // Reset all other test sources to not default
    await TestSource.update(
      { is_default: false },
      {
        where: {
          is_default: true,
          project_id: testSource.project_id, // Assuming testSource has a project_id
        },
      }
    );

    // Set the default test source logic here
    testSource.is_default = true;
    await testSource.save();

    return testSource;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
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
  setDefault,
};
