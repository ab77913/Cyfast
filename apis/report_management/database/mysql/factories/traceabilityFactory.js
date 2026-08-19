"use strict";

const helpers = require("../../../helpers");
const traceabilityData = require("../data/traceability");

// Get requirement coverage statistics by project ID
const getRequirementCoverageStatisticsByProjectId = async (projectId) => {
  let requirementCoverageDetails =
    await traceabilityData.getRequirementCoverageByProjectId(projectId);

  // Initialize the statistics object
  let requirementCoverageStatistics = {
    total: requirementCoverageDetails.length,
    passed: 0,
    failed: 0,
    not_executed: 0,
    mapped: 0,
    error: 0,
    percentage: 0,
  };

  // Iterate over coverage details to update the statistics
  for (let i = 0; i < requirementCoverageDetails.length; i++) {
    let requirementCoverageDetail = requirementCoverageDetails[i];

    // Update statistics based on the counts
    if (requirementCoverageDetail.failed_count > 0) {
      requirementCoverageStatistics.failed++;
    } else if (requirementCoverageDetail.error_count > 0) {
      requirementCoverageStatistics.error++;
    } else if (requirementCoverageDetail.passed_count > 0) {
      requirementCoverageStatistics.passed++;
    } else {
      requirementCoverageStatistics.not_executed++;
    }

    // Update mapped count
    requirementCoverageStatistics.mapped +=
      requirementCoverageDetail.mapped == 0 ? 0 : 1;
  }

  // Calculate percentage
  requirementCoverageStatistics.percentage = requirementCoverageStatistics.total
    ? Math.round(
        (requirementCoverageStatistics.mapped /
          requirementCoverageStatistics.total) *
          100
      )
    : 0;

  return requirementCoverageStatistics;
};

// Get risk requirement coverage statistics by project ID
const getRiskRequirementCoverageStatisticsByProjectId = async (projectId) => {
  let riskRequirementCoverageDetails =
    await traceabilityData.getRiskRequirementCoverageByProjectId(projectId);

  // Initialize the statistics object
  let riskRequirementCoverageStatistics = {
    total: riskRequirementCoverageDetails.length,
    passed: 0,
    failed: 0,
    not_executed: 0,
    mapped: 0,
    error: 0,
    percentage: 0,
  };

  // Iterate over risk coverage details to update the statistics
  for (let i = 0; i < riskRequirementCoverageDetails.length; i++) {
    let riskRequirementCoverageDetail = riskRequirementCoverageDetails[i];

    // Update statistics based on the counts
    if (riskRequirementCoverageDetail.failed_count > 0) {
      riskRequirementCoverageStatistics.failed++;
    } else if (riskRequirementCoverageDetail.error_count > 0) {
      riskRequirementCoverageStatistics.error++;
    } else if (riskRequirementCoverageDetail.passed_count > 0) {
      riskRequirementCoverageStatistics.passed++;
    } else {
      riskRequirementCoverageStatistics.not_executed++;
    }

    // Update mapped count
    riskRequirementCoverageStatistics.mapped +=
      riskRequirementCoverageDetail.mapped == 0 ? 0 : 1;
  }

  // Calculate percentage
  riskRequirementCoverageStatistics.percentage =
    riskRequirementCoverageStatistics.total
      ? Math.round(
          (riskRequirementCoverageStatistics.mapped /
            riskRequirementCoverageStatistics.total) *
            100
        )
      : 0;

  return riskRequirementCoverageStatistics;
};

module.exports = {
  getRequirementCoverageStatisticsByProjectId,
  getRiskRequirementCoverageStatisticsByProjectId,
};
