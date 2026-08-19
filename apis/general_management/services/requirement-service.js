"use strict";

const sequelize = require("sequelize");
const { Op } = require("sequelize");

const config = require("../config.js");
const { Requirement } = require("../database/" +
  config.db_type_primary +
  "/models");

const getByFilter = async (filters, sort = []) => {
  try {
    sort = sort.length > 0 ? sort : ["created_date", "Desc"];

    const requirements = await Requirement.findAll({
      where: filters,
      order: [sort],
    });

    return requirements;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getCountByFilter = async (filters) => {
  try {
    const requirementsCount = await Requirement.count({
      where: filters,
    });

    return requirementsCount;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getRequirementByRequirementNo = async (
  requirementNo,
  projectId,
  organizationId = null
) => {
  try {
    let requirement = await Requirement.findOne({
      where: {
        requirement_no: requirementNo,
        project_id: projectId,
      },
    });

    return requirement;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getRequirementByRequirementNoOrRequirementDesc = async (
  requirementNo,
  requirementDesc,
  projectId,
  organizationId = null
) => {
  try {
    let requirement = await Requirement.findOne({
      where: {
        project_id: projectId,
        [Op.or]: [
          { requirement_no: requirementNo },
          { description: requirementDesc },
        ],
      },
    });

    return requirement;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getNonExistingRequirements = async (
  requirementNos,
  projectId,
  organizationId = null
) => {
  try {
    let nonExistingRequirements = await Requirement.findAll({
      where: {
        project_id: projectId,
        requirement_no: {
          [Op.notIn]: requirementNos,
        },
      },
    });

    return nonExistingRequirements;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const deleteRequirements = async (
  requirementNos,
  projectId,
  organizationId = null
) => {
  try {
    let deletedRequirements = await Requirement.destroy({
      where: {
        project_id: projectId,
        requirement_no: {
          [Op.in]: requirementNos,
        },
      },
    });

    return deletedRequirements;
  } catch (error) {
    console.log(error);

    return null;
  }
};

module.exports = {
  getByFilter: getByFilter,
  getCountByFilter: getCountByFilter,
  getRequirementByRequirementNo: getRequirementByRequirementNo,
  getRequirementByRequirementNoOrRequirementDesc:
    getRequirementByRequirementNoOrRequirementDesc,
  getNonExistingRequirements: getNonExistingRequirements,
  deleteRequirements: deleteRequirements,
};
