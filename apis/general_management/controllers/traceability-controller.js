"use strict";

const helpers = require("../helpers");
const importService = require("../services/traceability/import-service");
const exportService = require("../services/traceability/export-service");
const traceabilityService = require("../services/traceability-service");
const fs = require("fs");
const dayjs = require("dayjs");

const importTraceability = async (req, res, next) => {
  try {
    if (req.file == undefined) {
      return res.status(400).send({
        message: "Error occured while uploading file, Please upload a file!",
      });
    }

    const projectId = req.body.project_id;
    //For Bosch use case, as common tests for all projects
    const organizationId = req.body.organization_id;
    const traceabilityType = req.body.type;
    const headerMappings = req.body.headers;
    const importType = req.body.import_type ? req.body.import_type : "FULL";

    const fileInfo = importService.getFileInfo(req.file.path, headerMappings);
    //console.log("File Information", fileInfo);
    const traceabilityFormat =
      fileInfo.traceSheet["!merges"] != undefined &&
      fileInfo.traceSheet["!merges"].length > 0
        ? "MERGED_CELLS"
        : "COMMA_SEPARATED";
    //Validate file for every possible scenario and generate report
    let validationReport = await importService.validate(
      fileInfo,
      traceabilityType,
      traceabilityFormat,
      projectId
    );
    console.log(validationReport);

    //Make initial entry of import - create new entry if doesnt exist else update existing one
    let versionInfo = importService.getVersionInfo(fileInfo);
    let importData = {
      organization_id: organizationId,
      project_id: projectId,
      type: traceabilityType,
      format: traceabilityFormat,
      import_type: importType,
      status: "INPROGRESS",
      file_name: req.file.originalname,
      file_type: req.body.filetype,
      temp_path: req.file.path,
      document_no:
        versionInfo.document_no != undefined ? versionInfo.document_no : null,
      document_name:
        versionInfo.document_name != undefined
          ? versionInfo.document_name
          : null,
      author: versionInfo.author != undefined ? versionInfo.author : null,
      purpose: versionInfo.purpose != undefined ? versionInfo.purpose : null,
      version:
        versionInfo.version != undefined
          ? versionInfo.version
          : req.body.version,
    };
    let importEntry = await traceabilityService.makeImportEntry(importData);
    //console.log("Import Entry Created:", importEntry);

    if (validationReport.errors.length > 0) {
      importEntry.set({
        status: "FAILED",
        records_imported: 0,
      });
      importEntry.save();
      //if errors found in validation, discard import and send report through response
      fs.unlinkSync(req.file.path);
      res.status(500).send({
        message:
          "Found errors while importing traceability file " +
          req.file.originalname +
          ", discarding import...",
        report: validationReport,
      });
    } else if (validationReport.warnings.length > 0) {
      //if warnings found in validation, send report and callback url through response and ask for confirmation to continue
      res.status(428).send({
        message:
          "Found few inconsistencies while importing traceability file " +
          req.file.originalname +
          ", would you like to continue?",
        callback_url_resume:
          helpers.getUrl(req) +
          "/resume?import_id=" +
          importEntry.traceability_import_id +
          "&" +
          helpers.convertArrayToQueryString(headerMappings, "headers"),
        callback_url_discard:
          helpers.getUrl(req) +
          "/discard?import_id=" +
          importEntry.traceability_import_id,
        report: validationReport,
      });
    } else {
      //continue import
      //console.log("No errors or warnings, continuing import...");
      let importReport = await importService.runImport(fileInfo, importEntry);
      importReport.notices = importReport.notices.concat(
        validationReport.notices
      );

      //mark import entry as successful
      importEntry.set({
        status: "SUCCESS",
        records_imported: importReport.records,
      });
      importEntry.save();

      //delete uploaded file and send report through response
      fs.unlinkSync(req.file.path);
      res.status(200).send({
        message:
          "Imported successful: " +
          req.file.originalname +
          ", records imported - " +
          importReport.records,
        report: importReport,
      });
    }
  } catch (err) {
    //Delete file in case of any error.
    fs.unlinkSync(req.file.path);
    res.status(500).send({
      message:
        "Could not import file: " + req.file.originalname + ", Error - " + err,
    });
  }
};

const resumeImport = async (req, res, next) => {
  try {
    const importId = req.query.import_id;
    const headerMappings = req.query.headers;
    const recordsToDelete = req.body.records_to_delete;
    const importEntry = await traceabilityService.getImportByFilter({
      traceability_import_id: importId,
    });
    if (importEntry == null) {
      res.status(404).send("No import found with id " + importId);
    } else if (
      headerMappings == undefined ||
      headerMappings == null ||
      headerMappings.length == 0
    ) {
      res.status(400).send("Headers not provided");
    } else {
      const fileInfo = importService.getFileInfo(
        importEntry.temp_path,
        headerMappings
      );

      //validate headers
      let validationReport = await importService.validateHeaders(
        fileInfo,
        importEntry.type
      );

      if (validationReport.errors.length > 0) {
        //if errors found in validation, discard import and send report through response
        fs.unlinkSync(importEntry.temp_path);
        res.status(500).send({
          message:
            "Found errors while importing traceability file " +
            importEntry.Filename +
            ", discarding import...",
          report: validationReport,
        });
      } else {
        //continue import
        if (
          recordsToDelete != undefined &&
          recordsToDelete != null &&
          recordsToDelete.length > 0
        ) {
          //delete records
          await traceabilityService.deleteRecords(
            recordsToDelete,
            importEntry.type,
            importEntry.project_id
          );
        }

        let importReport = await importService.runImport(fileInfo, importEntry);
        //mark import entry as successful
        importEntry.set({
          status: "SUCCESS",
          records_imported: importReport.records,
        });
        importEntry.save();

        //delete uploaded file and send report through response
        fs.unlinkSync(importEntry.temp_path);
        res.status(200).send({
          message:
            "Imported successful: " +
            importEntry.file_name +
            ", records imported - " +
            importReport.records,
          report: importReport,
        });
      }
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const discardImport = async (req, res, next) => {
  try {
    const importId = req.query.import_id;
    const importEntry = await traceabilityService.getImportByFilter({
      traceability_import_id: importId,
    });
    if (importEntry == null) {
      res.status(404).send("No import found with id " + importId);
    } else {
      importEntry.set({
        status: "DISCARDED",
        records_imported: 0,
      });
      importEntry.save();
      //delete uploaded file and send report through response
      fs.unlinkSync(importEntry.temp_path);
      res.status(200).send({
        message: "Import discarded: " + importEntry.Filename,
      });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getTraceability = async (req, res, next) => {
  //TODO: Add pagination & sorting, refactor code to break into smaller functions
  try {
    const projectId = req.query.project_id;
    const direction = req.query.direction;
    const searchQuery =
      req.query.searchQuery != "undefined" &&
      req.query.searchQuery != "null" &&
      req.query.searchQuery
        ? req.query.searchQuery
        : "";
    //For Bosch use case, as common tests for all projects
    const organizationId =
      req.query.organization_id != undefined ? req.query.organization_id : null;

    let traceabilityData = await traceabilityService.getTraceability(
      direction,
      searchQuery,
      projectId,
      organizationId
    );

    if (traceabilityData == null) {
      res.status(404).send("No traceability found for project " + projectId);
    } else {
      let traceabilityInfo = [];
      if (direction == "FORWARD") {
        traceabilityData = helpers.rekey(traceabilityData, "requirement_id");
        console.log(traceabilityData);
        for (let key in traceabilityData) {
          let requirementInfo = {};
          let testInfo = [];
          let testStatusInfo = [];
          let riskInfo = [];
          for (let record of traceabilityData[key]) {
            if (requirementInfo.requirement_id == undefined) {
              requirementInfo.project_id = record.project_id;
              requirementInfo.requirement_id = record.requirement_id;
              requirementInfo.requirement_no = record.requirement_no;
              requirementInfo.requirement_name = record.requirement_name;
            }
          }
          let testData = helpers.rekey(traceabilityData[key], "test_case_id");
          for (let key in testData) {
            testInfo.push({
              test_case_id: testData[key][0].test_case_id,
              test_case_no: testData[key][0].test_case_no,
              test_case_name: testData[key][0].test_case_name,
            });
            testStatusInfo.push({
              orchestration_id: testData[key][0].orchestration_id,
              orchestration_name: testData[key][0].orchestration_name,
              start_time: testData[key][0].start_time
                ? dayjs(testData[key][0].start_time).format(
                    "YYYY-MM-DD HH:mm:ss"
                  )
                : "",
              end_time: testData[key][0].end_time
                ? dayjs(testData[key][0].end_time).format("YYYY-MM-DD HH:mm:ss")
                : "",
              status: testData[key][0].test_status,
            });
          }

          let riskData = helpers.rekey(traceabilityData[key], "risk_id");
          for (let key in riskData) {
            riskInfo.push({
              risk_id: riskData[key][0].risk_id,
              risk_no: riskData[key][0].risk_no,
              risk_name: riskData[key][0].risk_name,
              rpn_number: riskData[key][0].rpn_number,
            });
          }
          traceabilityInfo.push({
            Requirement: requirementInfo,
            Test: testInfo,
            TestStatus: testStatusInfo,
            Risk: riskInfo,
          });
        }
      } else {
        traceabilityData = helpers.rekey(traceabilityData, "test_case_id");
        for (let key in traceabilityData) {
          let testInfo = {};
          let requirementInfo = [];
          let testStatusInfo = [];
          let riskInfo = [];
          for (let record of traceabilityData[key]) {
            if (testInfo.test_case_id == undefined) {
              testInfo.project_id = record.project_id;
              testInfo.test_case_id = record.test_case_id;
              testInfo.test_case_no = record.test_case_no;
              testInfo.test_case_desc = record.test_case_name;
            }
            if (testStatusInfo.length == 0) {
              testStatusInfo.push({
                orchestration_id: record.orchestration_id,
                orchestration_name: record.orchestration_name,
                start_time: record.start_time
                  ? dayjs(record.start_time).format("YYYY-MM-DD HH:mm:ss")
                  : "",
                end_time: record.end_time
                  ? dayjs(record.end_time).format("YYYY-MM-DD HH:mm:ss")
                  : "",
                status: record.status,
              });
            }
          }

          let requirementData = helpers.rekey(
            traceabilityData[key],
            "requirement_id"
          );
          for (let key in requirementData) {
            requirementInfo.push({
              requirement_id: requirementData[key][0].requirement_id,
              requirement_no: requirementData[key][0].requirement_no,
              requirement_desc: requirementData[key][0].requirement_desc,
            });
          }

          let riskData = helpers.rekey(traceabilityData[key], "risk_id");
          for (let key in riskData) {
            riskInfo.push({
              risk_id: riskData[key][0].risk_id,
              risk_no: riskData[key][0].risk_no,
              risk_desc: riskData[key][0].risk_desc,
              rpn_number: riskData[key][0].rpn_number,
            });
          }
          traceabilityInfo.push({
            Test: testInfo,
            Requirement: requirementInfo,
            TestStatus: testStatusInfo,
            Risk: riskInfo,
          });
        }
      }

      res.status(200).send(traceabilityInfo);
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
};

const getEndToEndTraceability = async (req, res, next) => {
  try {
    const projectId = req.query.project_id;
    const organizationId =
      req.query.organization_id != undefined ? req.query.organization_id : null;

    let traceabilityData = await traceabilityService.getEndToEndTraceability(
      projectId,
      organizationId
    );
    if (traceabilityData == null) {
      res.status(404).send("No traceability found for project " + projectId);
    } else {
      res.status(200).send(traceabilityData);
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
};

const getImports = async (req, res, next) => {
  try {
    const projectId = req.query.project_id;
    //For Bosch use case, as common tests for all projects
    const organizationId =
      req.query.organization_id != undefined ? req.query.organization_id : null;
    const traceabilityType = req.query.type;
    const status = req.query.status;

    const imports = await traceabilityService.getImportsByFilter({
      project_id: projectId,
      type: traceabilityType,
      status: status,
    });

    res.send(imports);
  } catch (error) {
    res.status(400).send(error.message);
  }
};

const exportTraceability = async (req, res, next) => {
  try {
    const projectId = req.query.project_id;
    //For Bosch use case, as common tests for all projects
    const organizationId =
      req.query.organization_id != undefined ? req.query.organization_id : null;
    const traceabilityType = req.query.type;
    const exportToFile =
      "Project#" + projectId + "-" + traceabilityType + ".xlsx";

    const generatedFile = await exportService.runExport(
      traceabilityType,
      projectId
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="' + exportToFile + '"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Length", generatedFile.length);
    // Expose Content-Disposition header for CORS
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.download(generatedFile, exportToFile, function (err) {
      if (err) {
        console.log(err); // Check error if you want
      }
      fs.unlinkSync(generatedFile);
    });
  } catch (error) {
    res.status(400).send(error.message);
  }
};

const insights = async (req, res, next) => {
  try {
    const projectId = req.query.project_id;
    const organizationId =
      req.query.organization_id != undefined ? req.query.organization_id : null;

    const insights = await traceabilityService.getInsights(
      projectId,
      organizationId
    );
    res.send(insights);
  } catch (error) {
    res.status(400).send(error.message);
  }
};

const statistics = async (req, res, next) => {
  try {
    const projectId = req.query.project_id;
    const organizationId =
      req.query.organization_id != undefined ? req.query.organization_id : null;

    const statistics = await traceabilityService.getStatistics(
      projectId,
      organizationId
    );
    res.send(statistics);
  } catch (error) {
    res.status(400).send(error.message);
  }
};

const testTraceability = async (req, res, next) => {
  try {
    res.send("Test");
  } catch (error) {
    res.status(400).send(error.message);
  }
};

module.exports = {
  importTraceability,
  exportTraceability,
  resumeImport,
  discardImport,
  getTraceability,
  getEndToEndTraceability,
  getImports,
  testTraceability,
  insights,
  statistics,
};
