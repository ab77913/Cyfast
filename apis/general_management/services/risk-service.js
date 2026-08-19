"use strict";

const sequelize = require("sequelize");
const { Op } = require("sequelize");

const config = require("../config.js");
const { Risk } = require("../database/" + config.db_type_primary + "/models");

const getByFilter = async (filters, sort = []) => {
  try {
    sort = sort.length > 0 ? sort : ["created_date", "Desc"];

    const risks = await Risk.findAll({
      where: filters,
      order: [sort],
    });

    return risks;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getCountByFilter = async (filters) => {
  try {
    const risksCount = await Risk.count({
      where: filters,
    });

    return risksCount;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getRiskByRiskNo = async (riskNo, projectId, organizationId = null) => {
  try {
    let risk = await Risk.findOne({
      where: {
        risk_no: riskNo,
        projectId: projectId,
      },
      include: {
        model: RiskRequirement,
        as: "riskRequirements",
      },
    });

    return risk;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getNonExistingRisks = async (
  riskNos,
  projectId,
  organizationId = null
) => {
  try {
    let nonExistingRisks = await Risk.findAll({
      where: {
        project_id: projectId,
        risk_no: {
          [Op.notIn]: riskNos,
        },
      },
    });

    return nonExistingRisks;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const deleteRisks = async (riskNos, projectId, organizationId = null) => {
  try {
    let deletedRisks = await Risk.destroy({
      where: {
        project_id: projectId,
        risk_no: {
          [Op.in]: riskNos,
        },
      },
    });

    return deletedRisks;
  } catch (error) {
    console.log(error);

    return null;
  }
};

module.exports = {
  getByFilter: getByFilter,
  getCountByFilter: getCountByFilter,
  getRiskByRiskNo: getRiskByRiskNo,
  getNonExistingRisks: getNonExistingRisks,
  deleteRisks: deleteRisks,
};
