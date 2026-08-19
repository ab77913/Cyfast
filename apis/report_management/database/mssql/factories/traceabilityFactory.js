"use strict";

const helpers = require("../../../helpers");
const traceabilityData = require("../data/traceability");

const getRequirementCoverageStatisticsByProjectId = async (projectId) => {
  let requirementCoverageDetails = await traceabilityData.getRequirementCoverageByProjectId(projectId);
  let requirementCoverageStatistics = {
    total: requirementCoverageDetails.length,
    passed: 0,
    failed: 0,
    not_executed: 0,
    mapped: 0,
    error: 0,
    percentage: 0,
  };

  for (let i = 0; i < requirementCoverageDetails.length; i++) {
    let requirementCoverageDetail = requirementCoverageDetails[i];
    if (requirementCoverageDetail.FailedCount > 0) {
      requirementCoverageStatistics.failed++;
    } else if (requirementCoverageDetail.ErrorCount > 0) {
      requirementCoverageStatistics.error++;
    } else if (requirementCoverageDetail.PassedCount > 0) {
      requirementCoverageStatistics.passed++;
    } else {
      requirementCoverageStatistics.not_executed++;
    }

    requirementCoverageStatistics.mapped += requirementCoverageDetail.mapped == 0 ? 0 : 1;
  }

  requirementCoverageStatistics.percentage = requirementCoverageStatistics.total
    ? Math.round((requirementCoverageStatistics.mapped / requirementCoverageStatistics.total) * 100)
    : 0;

  return requirementCoverageStatistics;
};

const getRiskRequirementCoverageStatisticsByProjectId = async (projectId) => {
  let riskRequirementCoverageDetails = await traceabilityData.getRiskRequirementCoverageByProjectId(projectId);
  let riskRequirementCoverageStatistics = {
    total: riskRequirementCoverageDetails.length,
    passed: 0,
    failed: 0,
    not_executed: 0,
    mapped: 0,
    error: 0,
    percentage: 0,
  };

  for (let i = 0; i < riskRequirementCoverageDetails.length; i++) {
    let riskRequirementCoverageDetail = riskRequirementCoverageDetails[i];
    if (riskRequirementCoverageDetail.FailedCount > 0) {
      riskRequirementCoverageStatistics.failed++;
    } else if (riskRequirementCoverageDetail.ErrorCount > 0) {
      riskRequirementCoverageStatistics.error++;
    } else if (riskRequirementCoverageDetail.PassedCount > 0) {
      riskRequirementCoverageStatistics.passed++;
    } else {
      riskRequirementCoverageStatistics.not_executed++;
    }

    riskRequirementCoverageStatistics.mapped += riskRequirementCoverageDetail.mapped == 0 ? 0 : 1;
  }

  riskRequirementCoverageStatistics.percentage = riskRequirementCoverageStatistics.total
    ? Math.round((riskRequirementCoverageStatistics.mapped / riskRequirementCoverageStatistics.total) * 100)
    : 0;

  return riskRequirementCoverageStatistics;
};

module.exports = {
  getRequirementCoverageStatisticsByProjectId,
  getRiskRequirementCoverageStatisticsByProjectId,
};
