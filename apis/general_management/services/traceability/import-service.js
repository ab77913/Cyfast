"use strict";

const xlsx = require("xlsx");
const helpers = require("../../helpers");
const config = require("../../config.js");

const testCaseFactory = require("../../database/" +
  config.db_type_primary +
  "/factories/test-case-factory.js");

const riskService = require("../risk-service");
const requirementService = require("../requirement-service");
const traceabilityService = require("../traceability-service");

const getFileInfo = (filepath, headerMappings) => {
  try {
    let fileInfo = {};

    fileInfo.file = xlsx.readFile(filepath);
    fileInfo.coverSheet = fileInfo.file.Sheets[fileInfo.file.SheetNames[0]];
    fileInfo.traceSheet = fileInfo.file.Sheets[fileInfo.file.SheetNames[1]];
    fileInfo.headerMappings = headerMappings;
    fileInfo.mandatoryIndices = {
      REQUIREMENT_TEST: [
        "requirement_no",
        "requirement_desc",
        "test_case_no",
        "test_case_desc",
      ],
      RISK_REQUIREMENT: [
        "risk_no",
        "risk_desc",
        "rpn_number",
        "requirement_no",
      ],
    };

    fileInfo.traceIndices = getTraceIndices(
      fileInfo.traceSheet,
      fileInfo.headerMappings
    );

    return fileInfo;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getTraceIndices = (traceSheet, headerMappings) => {
  try {
    let traceIndices = [];

    let range1 = xlsx.utils.decode_range(traceSheet["!ref"]);
    for (let colNum = range1.s.c; colNum <= range1.e.c; colNum++) {
      let cellVal = traceSheet[xlsx.utils.encode_cell({ r: 0, c: colNum })];
      if (cellVal != undefined && cellVal.v.trim() != "") {
        let key = helpers.getKeyByValue(headerMappings, cellVal.v);
        if (key != undefined) {
          traceIndices[key] = colNum;
        }
      }
    }

    return traceIndices;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getVersionInfo = (fileInfo) => {
  try {
    let range0 = xlsx.utils.decode_range(fileInfo.coverSheet["!ref"]);

    let versionInfo = {};
    for (let rowNum = range0.s.r; rowNum <= range0.e.r; rowNum++) {
      const firstCell =
        fileInfo.coverSheet[xlsx.utils.encode_cell({ r: rowNum, c: 0 })];
      // Example: Get second cell in each row, i.e. Column "B"
      const secondCell =
        fileInfo.coverSheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
      // NOTE: secondCell is undefined if it does not exist (i.e. if its empty)
      if (firstCell.v == "Document Number") {
        versionInfo.document_no = secondCell == undefined ? "" : secondCell.v;
      } else if (firstCell.v == "Document Name") {
        versionInfo.document_name = secondCell == undefined ? "" : secondCell.v;
      } else if (firstCell.v == "Document Version") {
        versionInfo.version = secondCell == undefined ? "" : secondCell.v;
      } else if (firstCell.v == "Author") {
        versionInfo.author = secondCell == undefined ? "" : secondCell.v;
      } else if (firstCell.v == "Purpose") {
        versionInfo.purpose = secondCell == undefined ? "" : secondCell.v;
      }
    }

    return versionInfo;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const readTraceLine = (fileInfo, rowNum) => {
  try {
    let record = {};

    for (let key in fileInfo.traceIndices) {
      let colNum = fileInfo.traceIndices[key];
      let cellVal =
        fileInfo.traceSheet[xlsx.utils.encode_cell({ r: rowNum, c: colNum })];
      record[key] = (cellVal != undefined) != "" ? cellVal.v : "";
    }

    return record;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const validateHeaders = (fileInfo, traceabilityType) => {
  try {
    let validationReport = { errors: [], warnings: [], notices: [] };

    for (let mandatoryIndex of fileInfo.mandatoryIndices[traceabilityType]) {
      if (fileInfo.traceIndices[mandatoryIndex] == undefined) {
        validationReport.errors.push(
          "Mandatory header '" + mandatoryIndex + "' not mapped"
        );
      }
    }

    return validationReport;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const validateVersion = async (
  fileInfo,
  traceabilityType,
  projectId,
  organizationId = null
) => {
  try {
    let validationReport = { errors: [], warnings: [], notices: [] };

    let versionInfo = getVersionInfo(fileInfo);
    if (versionInfo.document_no == undefined || versionInfo.document_no == "")
      validationReport.warnings.push(
        "Document Number information not found in coversheet"
      );
    if (
      versionInfo.document_name == undefined ||
      versionInfo.document_name == ""
    )
      validationReport.warnings.push(
        "Document Name information not found in coversheet"
      );
    if (versionInfo.version == undefined || versionInfo.version == "")
      validationReport.errors.push(
        "Document Version information not found in coversheet"
      );
    if (versionInfo.author == undefined || versionInfo.author == "")
      validationReport.warnings.push(
        "author information not found in coversheet"
      );
    if (versionInfo.purpose == undefined || versionInfo.purpose == "")
      validationReport.warnings.push(
        "purpose information not found in coversheet"
      );

    if (versionInfo.version) {
      let prevImports = await traceabilityService.getImportsByFilter({
        project_id: projectId,
        type: traceabilityType,
        status: "SUCCESS",
      });

      let prevVersions = prevImports
        ? await prevImports.map((a) => a.version)
        : [];
      if (prevVersions.includes(versionInfo.version)) {
        validationReport.errors.push("Version already exists in database");
      }
    }

    return validationReport;
  } catch (error) {
    console.log(error);

    return null;
  }
};

//Validate entire file line by line and return validation report
const validateFile = async (
  fileInfo,
  traceabilityType,
  traceabilityFormat,
  projectId,
  organizationId = null
) => {
  try {
    //TODO-refactor to break into smaller functions
    let validationReport = { errors: [], warnings: [], notices: [] };

    let range = xlsx.utils.decode_range(fileInfo.traceSheet["!ref"]);
    let newNos = [];
    if (traceabilityFormat == "MERGED_CELLS") {
      if (traceabilityType == "RISK_REQUIREMENT") {
        //TODO - change logic of validation according to identify merged cells and not just last row
        let lastRiskNo = null;
        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
          let record = readTraceLine(fileInfo, rowNum);

          //Check if Risk No is present
          if (!record.risk_no && lastRiskNo == null)
            validationReport.errors.push(
              "No Risk ID found at row #" + (rowNum + 1)
            );
          else if (!record.risk_no && record.risk_desc)
            validationReport.errors.push(
              "No Risk ID found at row #" + (rowNum + 1)
            );
          else newNos.push(record.risk_no);

          //Check for remaining info
          if (!record.risk_desc && lastRiskNo == null)
            validationReport.notices.push(
              "No Risk Description found at row #" + (rowNum + 1)
            );
          if (!record.rpn_number && lastRiskNo == null)
            validationReport.notices.push(
              "No Rpn Number found at row #" + (rowNum + 1)
            );
          if (!record.requirement_no)
            validationReport.notices.push(
              "No Requirement IDs found at row #" + (rowNum + 1)
            );

          //Check if traced requirement is present in database
          if (record.requirement_no) {
            let reqs = await requirementService.getByFilter({
              requirement_no: record.requirement_no,
              project_id: projectId,
            });
            if (!reqs) {
              validationReport.errors.push(
                "Traced Requirement No. " +
                  record.requirement_no +
                  " doesn't exist in database. Row #" +
                  (rowNum + 1)
              );
            }
          }

          if (lastRiskNo != record.risk_no && record.risk_no)
            lastRiskNo = record.risk_no;
        }
      } else if (traceabilityType == "REQUIREMENT_TEST") {
        //TODO - change logic of validation according to identify merged cells and not just last row
        let lastReqNo = null;
        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
          let record = readTraceLine(fileInfo, rowNum);

          //Check if Requirement No is present
          if (!record.requirement_no && lastReqNo == null)
            validationReport.errors.push(
              "No Requirement ID found at row #" + (rowNum + 1)
            );
          else if (!record.requirement_no && record.requirement_desc)
            validationReport.errors.push(
              "No Requirement ID found at row #" + (rowNum + 1)
            );
          else newNos.push(record.requirement_no);

          //Check for remaining info
          if (!record.requirement_desc && lastReqNo == null)
            validationReport.notices.push(
              "No Requirement Description found at row #" + (rowNum + 1)
            );
          if (!record.test_case_no || !record.test_case_desc)
            validationReport.notices.push(
              "No Test ID or Test Description found at row #" + (rowNum + 1)
            );

          //Check if traced test is present in database
          //Important - for FAP checking test no or desciption as test nos are not available from repo service
          if (
            (lastReqNo || record.requirement_no) &&
            (record.test_case_no || record.test_case_desc)
          ) {
            let test = await testCaseFactory.getByTestCaseNoOrTestCaseDesc(
              record.test_case_no,
              record.test_case_desc,
              projectId
            );
            if (test == null) {
              validationReport.errors.push(
                "Traced Test No. " +
                  record.test_case_no +
                  " doesn't exist in database. Row #" +
                  (rowNum + 1)
              );
            }
          }

          if (lastReqNo != record.requirement_no && record.requirement_no)
            lastReqNo = record.requirement_no;
        }
      }
    } else {
      if (traceabilityType == "RISK_REQUIREMENT") {
        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
          let record = readTraceLine(fileInfo, rowNum);
          record.requirement_no = record.requirement_no.replace(" ", "");

          //Check if Risk No is present
          if (!record.risk_no)
            validationReport.errors.push(
              "No Risk ID found at row #" + (rowNum + 1)
            );
          else newNos.push(record.risk_no);

          //Check for remaining info
          if (!record.risk_desc)
            validationReport.notices.push(
              "No Risk Description found at row #" + (rowNum + 1)
            );
          if (!record.rpn_number)
            validationReport.notices.push(
              "No Rpn Number found at row #" + (rowNum + 1)
            );
          if (!record.requirement_no)
            validationReport.notices.push(
              "No Requirement ID found at row #" + (rowNum + 1)
            );

          //Check if traced requirements are present in database
          if (record.requirement_no) {
            let requirementNos = record.requirement_no.split(",");
            if (requirementNos.length > 0) {
              let existingReqs = await requirementService.getByFilter({
                requirement_no: requirementNos,
                project_id: projectId,
              });
              let existingReqNos = existingReqs
                ? existingReqs.map((a) => a.requirement_no)
                : [];
              let notExistingReqNos = requirementNos.filter(
                (x) => !existingReqNos.includes(x)
              );
              if (notExistingReqNos.length > 0)
                validationReport.errors.push(
                  "Traced Requirement Nos " +
                    notExistingReqNos.join() +
                    " doesn't exist in database. Row #" +
                    (rowNum + 1)
                );
            }
          }
        }
      } else if (traceabilityType == "REQUIREMENT_TEST") {
        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
          let record = readTraceLine(fileInfo, rowNum);
          record.test_case_no = record.test_case_no.replace(" ", "");

          //Check if Requirement No is present
          if (!record.requirement_no)
            validationReport.errors.push(
              "No requirement_no ID found at row #" + (rowNum + 1)
            );
          else newNos.push(record.requirement_no);

          //Check for remaining info
          if (!record.requirement_desc)
            validationReport.notices.push(
              "No Requirement Description found at row #" + (rowNum + 1)
            );
          if (!record.test_case_no || !record.test_case_desc)
            validationReport.notices.push(
              "No Test ID or Test Description found at row #" + (rowNum + 1)
            );

          //Check if traced tests are present in database
          if (record.test_case_no) {
            let testNos = record.test_case_no.split(",");
            if (testNos.length > 0) {
              let existingTests = await testCaseFactory.getByFilter({
                test_case_no: testNos,
                project_id: projectId,
              });
              let existingTestCaseNos =
                existingTests.data.length > 0
                  ? existingTests.data.map((a) => a.test_case_no)
                  : [];
              let notExistingTestCaseNos = testNos.filter(
                (x) => !existingTestCaseNos.includes(x)
              );
              if (notExistingTestCaseNos.length > 0) {
                validationReport.errors.push(
                  "Traced Test Nos " +
                    notExistingTestCaseNos.join() +
                    " doesn't exist in database. Row #" +
                    (rowNum + 1)
                );
              }
            }
          }
        }
      }
    }

    if (newNos.length > 0) {
      let deletedEntries = [];
      let deletedNos = [];
      if (traceabilityType == "RISK_REQUIREMENT") {
        deletedEntries = await riskService.getNonExistingRisks(
          newNos,
          projectId,
          (organizationId = null)
        );
        if (deletedEntries.length > 0) {
          deletedNos = deletedEntries.map((a) => a.risk_no);
        }
      } else if (traceabilityType == "REQUIREMENT_TEST") {
        deletedEntries = await requirementService.getNonExistingRequirements(
          newNos,
          projectId,
          (organizationId = null)
        );
        if (deletedEntries.length > 0) {
          deletedNos = deletedEntries.map((a) => a.requirement_no);
        }
      }

      if (deletedNos.length > 0) {
        validationReport.missing_entries = deletedNos;
        validationReport.warnings.push(
          "Following entries " +
            deletedNos.join() +
            " from earlier version are missing in the file."
        );
      }
    }

    return validationReport;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const validate = async (
  fileInfo,
  traceabilityType,
  traceabilityFormat,
  projectId,
  organizationId = null
) => {
  try {
    //validate versions
    let versionValidationReport = await validateVersion(
      fileInfo,
      traceabilityType,
      projectId,
      (organizationId = null)
    );
    //console.log(versionValidationReport);

    //validate Headers
    let headersValidationReport = validateHeaders(fileInfo, traceabilityType);
    //console.log(headersValidationReport);

    //validate file line by line
    let fileValidationReport = await validateFile(
      fileInfo,
      traceabilityType,
      traceabilityFormat,
      projectId,
      (organizationId = null)
    );
    //console.log(fileValidationReport);

    let validationReport = {
      errors: versionValidationReport.errors.concat(
        headersValidationReport.errors,
        fileValidationReport.errors
      ),
      warnings: versionValidationReport.warnings.concat(
        headersValidationReport.warnings,
        fileValidationReport.warnings
      ),
      notices: versionValidationReport.notices.concat(
        headersValidationReport.notices,
        fileValidationReport.notices
      ),
      missing_entries: fileValidationReport.missing_entries,
    };

    return validationReport;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const formEntry = () => {};

//Starts import process for a file line by line and returns import report
const runImport = async (fileInfo, importEntry) => {
  try {
    //TODO-refactor to break into smaller functions
    let range = xlsx.utils.decode_range(fileInfo.traceSheet["!ref"]);
    let importReport = { records: 0, errors: [], warnings: [], notices: [] };

    if (importEntry.format == "MERGED_CELLS") {
      if (importEntry.type == "RISK_REQUIREMENT") {
        let lastRisk = null;
        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
          let record = readTraceLine(fileInfo, rowNum);
          record.organization_id = importEntry.organization_id;
          record.project_id = importEntry.project_id;
          record.risk_version = importEntry.version;

          let risk = null;
          /*
        In case of merged cells, if current merged cell doesnt have risk no and risk desc
        get it from last record inserted
        */
          if (!record.risk_no && !record.risk_desc && record.requirement_no) {
            risk = lastRisk;
            record.risk_no = risk.risk_no;
            record.risk_desc = risk.risk_desc;
          }

          if (!record.risk_no && !record.risk_desc) {
            importReport.notices.push(
              "No Risk ID & Risk Description found at row #" + (rowNum + 1)
            );
            //TODO - this should be pushed to errors list
          } else {
            risk = await traceabilityService.addRiskRequirementTrace(record);
            lastRisk = req;
            importReport.records++;
          }
        }
      } else if (importEntry.type == "REQUIREMENT_TEST") {
        let lastReq = null;
        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
          let record = readTraceLine(fileInfo, rowNum);
          record.organization_id = importEntry.organization_id;
          record.project_id = importEntry.project_id;
          record.requirement_version = importEntry.version;

          let req = null;
          /*
          In case of merged cells, if current merged cell doesnt have requirement no and requirement desc
          get it from last record inserted
          */
          if (
            !record.requirement_no &&
            !record.requirement_desc &&
            record.test_case_no &&
            lastReq != null
          ) {
            req = lastReq;
            record.requirement_no = req.requirement_no;
            record.requirement_desc = req.requirement_desc;
          }

          if (!record.requirement_no && !record.requirement_desc) {
            //TODO - this should be pushed to errors list
            importReport.notices.push(
              "No Requirement ID & Requirement Description found at row #" +
                (rowNum + 1)
            );
          } else {
            req = await traceabilityService.addRequirementTestTrace(record);
            console.log(req);
            lastReq = req;
            importReport.records++;
          }
        }
      }
    } else {
      if (importEntry.type == "RISK_REQUIREMENT") {
        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
          let record = readTraceLine(fileInfo, rowNum);
          record.organization_id = importEntry.organization_id;
          record.project_id = importEntry.project_id;
          record.risk_version = importEntry.version;

          record.requirement_no = record.requirement_no.replace(" ", "");
          if (record.requirement_no) {
            let requirementNos = record.requirement_no.split(",");
            if (requirementNos.length > 0) {
              for (let requirementNo of requirementNos) {
                record.requirement_no = requirementNo;
                let risk = await traceabilityService.addRiskRequirementTrace(
                  record
                );
                importReport.records++;
              }
            }
          } else {
            importReport.notices.push(
              "No Requirement No. found at row #" + (rowNum + 1)
            );
            let risk = await traceabilityService.addRiskRequirementTrace(
              record
            );
            importReport.records++;
          }
          //console.log("Record processed:", record);
        }
      } else if (importEntry.type == "REQUIREMENT_TEST") {
        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
          let record = readTraceLine(fileInfo, rowNum);
          record.organization_id = importEntry.organization_id;
          record.project_id = importEntry.project_id;
          record.requirement_version = importEntry.version;

          record.test_case_no = record.test_case_no.replace(" ", "");
          if (record.test_case_no) {
            let testNos = record.test_case_no.split(",");
            if (testNos.length > 0) {
              for (let testNo of testNos) {
                record.test_case_no = testNo;
                let req = await traceabilityService.addRequirementTestTrace(
                  record
                );
                importReport.records++;
              }
            }
          } else {
            importReport.notices.push(
              "No Test No. found at row #" + (rowNum + 1)
            );
            let req = await traceabilityService.addRequirementTestTrace(record);
            importReport.records++;
          }
        }
      }
    }

    return importReport;
  } catch (error) {
    console.log(error);

    return null;
  }
};

module.exports = {
  getFileInfo: getFileInfo,
  getVersionInfo: getVersionInfo,
  validateHeaders: validateHeaders,
  validate: validate,
  runImport: runImport,
};
