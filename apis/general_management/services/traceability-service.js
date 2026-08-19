"use strict";

const sequelize = require("sequelize");

const config = require("../config.js");
const {
  Risk,
  RiskRequirement,
  Requirement,
  RequirementTestCase,
  TraceabilityImport,
} = require("../database/" + config.db_type_primary + "/models");
const traceabilityData = require("../database/" +
  config.db_type_primary +
  "/data/traceability");

const testCaseFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-case-factory.js");
const testService = require("./test-service.js");
const requirementService = require("./requirement-service.js");

const getImportsByFilter = async (filters, sort = []) => {
  try {
    sort = sort.length > 0 ? sort : ["created_date", "Desc"];

    const imports = await TraceabilityImport.findAll({
      where: filters,
      order: [sort],
    });

    return imports;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getImportByFilter = async (filters, sort = []) => {
  try {
    sort = sort.length > 0 ? sort : ["created_date", "Desc"];

    const traceImport = await TraceabilityImport.findOne({
      where: filters,
      order: [sort],
    });

    return traceImport;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const makeImportEntry = async (importData) => {
  try {
    //Find whichever last import was tried
    let importEntry = await TraceabilityImport.findOne({
      where: {
        project_id: importData.project_id,
        type: importData.type,
      },
      order: [["created_date", "DESC"]],
    });
    console.log("Import data", importData);

    if (importEntry == null || importEntry.status == "SUCCESS") {
      importData.total_records = importData.total_records
        ? importData.total_records
        : 0;
      importData.records_imported = importData.records_imported
        ? importData.records_imported
        : 0;
      importEntry = await TraceabilityImport.create(importData);
    } else {
      importEntry.set(importData);
      importEntry = await importEntry.save();
    }

    return importEntry;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const addRiskRequirementTrace = async (traceData) => {
  try {
    //console.log("Trace data", traceData);
    let risk = await Risk.findOne({
      where: {
        risk_no: traceData.risk_no,
        project_id: traceData.project_id,
      },
      include: {
        model: RiskRequirement,
        as: "risk_requirements",
        on: {
          risk_version: traceData.risk_version,
        },
      },
    });

    let riskData = traceData;
    riskData.title = traceData.risk_desc;
    riskData.description = traceData.risk_desc;
    riskData.version = traceData.risk_version;
    riskData.rpn_number = traceData.rpn_number ? traceData.rpn_number : null;
    riskData.severity = traceData.severity ? traceData.severity : null;
    riskData.occurence = traceData.occurence ? traceData.occurence : null;
    riskData.detection = traceData.detection ? traceData.detection : null;

    if (risk == null) {
      risk = await Risk.create(riskData);
    } else {
      risk.set(riskData);
      risk = await risk.save();
    }

    let requirement = null;
    if (traceData.requirement_no != undefined) {
      requirement = await requirementService.getRequirementByRequirementNo(
        traceData.requirement_no,
        traceData.project_id
      );
    } else {
      requirement =
        await requirementService.getRequirementByRequirementNoOrRequirementDesc(
          traceData.requirement_no,
          traceData.requirement_desc,
          traceData.project_id
        );
    }
    let trace = { risk_id: risk.risk_id, risk_version: risk.risk_version };
    if (requirement) {
      trace.requirement_id = requirement.requirement_id;
      trace.requirement_version = requirement.requirement_version;
    }
    await RiskRequirement.create(trace);

    return risk;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const addRequirementTestTrace = async (traceData) => {
  try {
    let req = await Requirement.findOne({
      where: {
        requirement_no: traceData.requirement_no,
        project_id: traceData.project_id,
      },
    });

    let reqData = traceData;
    reqData.description = traceData.requirement_desc;
    reqData.version = traceData.requirement_version;
    if (!req) {
      req = await Requirement.create(traceData);
    } else {
      req.set(reqData);
      req = await req.save();
    }

    let test = await testCaseFactory.getByTestCaseNoOrTestCaseDesc(
      traceData.test_case_no,
      traceData.test_case_desc.trim(),
      traceData.project_id
    );
    let trace = {
      requirement_id: req.requirement_id,
      requirement_version: req.requirement_version,
    };
    if (test) {
      trace.test_case_id = test.test_case_id;
      trace.test_case_version = test.test_case_version;
    }
    console.log(trace);
    await RequirementTestCase.create(trace);

    return req;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getRequirementTestTraceability = async (
  projectId,
  organizationId = null
) => {
  try {
    let traceData = await traceabilityData.getRequirementTestTraceability(
      projectId,
      organizationId
    );

    return traceData;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getRiskRequirementTraceability = async (
  projectId,
  organizationId = null
) => {
  try {
    let traceData = await traceabilityData.getRiskRequirementTraceability(
      projectId,
      organizationId
    );

    return traceData;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getRiskRequirementTestTraceability = async (
  projectId,
  organizationId = null
) => {
  try {
    let traceData = await traceabilityData.getRiskRequirementTestTraceability(
      projectId,
      organizationId
    );

    return traceData;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getEndToEndTraceability = async (projectId, organizationId = null) => {
  try {
    let traceData = await traceabilityData.getEndToEndTraceability(
      projectId,
      organizationId
    );

    return traceData;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getTraceability = async (
  direction,
  searchQuery,
  projectId,
  organizationId = null
) => {
  try {
    let traceData = [];
    if (direction == "FORWARD")
      traceData = await traceabilityData.getForwardTraceability(projectId);
    else
      traceData = await traceabilityData.getBackwardTraceability(
        searchQuery,
        projectId,
        organizationId
      );
    return traceData;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getStatistics = async (projectId, organizationId = null) => {
  try {
    const requirementsCount = await requirementService.getCountByFilter({
      project_id: projectId,
    });
    const testsCount = await testService.getCountByFilter({
      project_id: projectId,
    });
    const risksCount = await Risk.count({ where: { project_id: projectId } });

    return {
      requirementsCount: requirementsCount,
      testsCount: testsCount,
      risksCount: risksCount,
      errorCount: 0,
    };
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getInsights = async (projectId, organizationId = null) => {
  try {
    let insights = {};
    let requirementInsights = await traceabilityData.getRequirementInsights(
      projectId,
      organizationId
    );
    requirementInsights = requirementInsights[0];
    let testInsights = await traceabilityData.getTestInsights(
      projectId,
      organizationId
    );
    let riskInsights = await traceabilityData.getRiskInsights(
      projectId,
      organizationId
    );
    riskInsights = riskInsights[0];
    let requirementExecutionStats =
      await traceabilityData.getRequirementExecutionStats(
        projectId,
        organizationId
      );
    requirementExecutionStats = requirementExecutionStats[0];
    let redundantRequirementsCount =
      await traceabilityData.countRedundantRequirements(
        projectId,
        organizationId
      );
    redundantRequirementsCount = redundantRequirementsCount[0].total_count;

    insights.totalRequirements = requirementInsights.total_count;
    insights.orphanRequirements =
      requirementInsights.total_count - requirementInsights.TracedCount;
    insights.percentRequirementsTraced =
      (requirementInsights.TracedCount / requirementInsights.total_count) * 100;
    insights.redundantRequirements = redundantRequirementsCount;
    insights.requirementsExecuted =
      requirementExecutionStats.total_count -
      requirementExecutionStats.not_executed_count;
    insights.requirementsFailed = requirementExecutionStats.failed_count;
    insights.totalRisks = riskInsights.total_count;
    insights.orphanRisks = riskInsights.total_count - riskInsights.TracedCount;
    insights.percentRisksTraced =
      (riskInsights.TracedCount / riskInsights.total_count) * 100;
    insights.totalTests = await testService.getCountByFilter({
      project_id: projectId,
    });

    return insights;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const deleteRecords = async (recordsToDelete, traceabilityType, projectId) => {
  try {
    let deletedRecords = [];
    if (traceabilityType == "REQUIREMENT_TEST") {
      deletedRecords = await requirementService.deleteRequirements(
        recordsToDelete,
        projectId
      );
    } else if (traceabilityType == "RISK_REQUIREMENT") {
      deletedRecords = await riskService.deleteRisks(
        recordsToDelete,
        projectId
      );
    }

    return deletedRecords;
  } catch (error) {
    console.log(error);

    return null;
  }
};

module.exports = {
  getImportsByFilter,
  getImportByFilter,
  makeImportEntry,
  addRequirementTestTrace,
  addRiskRequirementTrace,
  getInsights,
  getStatistics,
  getTraceability,
  getEndToEndTraceability,
  getRiskRequirementTraceability,
  getRequirementTestTraceability,
  getRiskRequirementTestTraceability,
  deleteRecords,
};
