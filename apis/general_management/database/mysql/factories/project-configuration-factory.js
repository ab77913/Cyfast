// Sorting:Ensure the default sorting is formatted correctly. The current default ["created_date", "Desc"] may need to be [['created_date', 'DESC']] to match Sequelize's expected format.
// Pagination:Verify that helpers.getPagination(page, size) returns the correct limit and offset
// removeByProjectId Function:The removeByProjectId function is using getById to find a ProjectConfiguration by project_id. This might be an oversight; you should use getByProjectId instead.
// Returning Values:For functions like remove and removeByProjectId, you should return the number of rows deleted for clarity.
// Consistency:The update and updateByProjectId functions are similar, but updateByProjectId should ensure it uses getByProjectId to find configurations.

"use strict";

const helpers = require("../../../helpers");
const { ProjectConfiguration } = require("../models");

const getByFilter = async (filters, sort = [], page = null, size = null) => {
  try {
    page = page || 1;
    size = size || 10;

    // Ensure sorting format is correct
    sort = sort.length > 0 ? sort : [["created_date", "DESC"]];
    let { limit, offset } = helpers.getPagination(page, size);

    console.log("getByFilter", filters, sort, page, size);
    const projectConfigurations = await ProjectConfiguration.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: sort,
    });
    console.log("projectConfigurations", projectConfigurations);

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (projectConfigurations && projectConfigurations.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: projectConfigurations,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    return {
      data: [],
      pagination: {},
    };
  }
};

const getCountByFilter = async (filters) => {
  try {
    const projectConfigurationsCount = await ProjectConfiguration.count({
      where: filters,
    });

    return projectConfigurationsCount;
  } catch (error) {
    console.log(error);
    return 0;
  }
};

const getById = async (projectConfigurationId) => {
  try {
    const projectConfiguration = await ProjectConfiguration.findOne({
      where: {
        project_configuration_id: projectConfigurationId,
      },
    });

    return projectConfiguration;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getByProjectId = async (projectId) => {
  try {
    const projectConfiguration = await ProjectConfiguration.findOne({
      where: {
        project_id: projectId,
      },
    });

    return projectConfiguration;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const add = async (projectConfigurationData) => {
  try {
    const projectConfiguration = await ProjectConfiguration.create(
      projectConfigurationData
    );

    return projectConfiguration;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const update = async (projectConfigurationId, projectConfigurationData) => {
  try {
    const projectConfiguration = await getById(projectConfigurationId);
    if (!projectConfiguration)
      throw new Error("Project configuration not found");

    await projectConfiguration.update(projectConfigurationData);

    return projectConfiguration;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const updateByProjectId = async (projectId, projectConfigurationData) => {
  try {
    let projectConfiguration = await getByProjectId(projectId);
    if (!projectConfiguration) {
      projectConfigurationData.project_id = projectId;
      projectConfiguration = await ProjectConfiguration.create(
        projectConfigurationData
      );
    } else {
      await projectConfiguration.update(projectConfigurationData);
    }

    return projectConfiguration;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const remove = async (projectConfigurationId) => {
  try {
    const rowsDeleted = await ProjectConfiguration.destroy({
      where: {
        project_configuration_id: projectConfigurationId,
      },
    });

    return rowsDeleted; // Return the number of deleted rows
  } catch (error) {
    console.log(error);
    return 0; // Return 0 if deletion fails
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await ProjectConfiguration.destroy({
      where: {
        project_id: projectId,
      },
    });

    return rowsDeleted; // Return the number of deleted rows
  } catch (error) {
    console.log(error);
    return 0; // Return 0 if deletion fails
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  getByProjectId,
  add,
  update,
  updateByProjectId,
  remove,
  removeByProjectId,
};
