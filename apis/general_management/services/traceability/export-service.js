"use strict";

const xlsx = require("xlsx");
const dayjs = require("dayjs");
const traceabilityService = require("../traceability-service");

const runExport = async (
  traceabilityType,
  projectId,
  organizationId = null
) => {
  try {
    const workSheet = xlsx.utils.aoa_to_sheet([]);
    const workBook = xlsx.utils.book_new();

    let traceData = [];
    let merge = [];
    if (traceabilityType == "REQUIREMENT_TEST") {
      traceData = await traceabilityService.getRequirementTestTraceability(
        projectId,
        organizationId
      );
    } else if (traceabilityType == "RISK_REQUIREMENT") {
      traceData = await traceabilityService.getRiskRequirementTraceability(
        projectId,
        organizationId
      );
    } else if (traceabilityType == "RISK_REQUIREMENT_TEST") {
      traceData = await traceabilityService.getRiskRequirementTestTraceability(
        projectId,
        organizationId
      );
    }

    if (traceData && traceData.length > 0) {
      let keys = Object.keys(traceData[0]);
      let headers = keys.map((key) => {
        return key.replace(/([A-Z])/g, " $1").trim();
      });
      xlsx.utils.sheet_add_aoa(workSheet, [headers], { origin: "A1" });

      let lastChangedTrace = {};
      keys.map((key) => {
        lastChangedTrace[key] = { val: 0, row: 0 };
      });

      let rowNum = 1;
      let totalRecords = traceData.length;
      for (let trace of traceData) {
        let colNum = 0;

        //Go through each column and check if value has changed and if so, merge till the previous row
        for (let key of keys) {
          if (trace[key] != lastChangedTrace[key].val) {
            if (
              lastChangedTrace[key].row != 0 &&
              lastChangedTrace[key].row != rowNum - 1
            ) {
              merge.push({
                s: { r: lastChangedTrace[key].row, c: colNum },
                e: { r: rowNum - 1, c: colNum },
              });
            }
            lastChangedTrace[key].val = trace[key];
            lastChangedTrace[key].row = rowNum;
          }
          colNum++;
        }
        let rowData = Object.values(trace);
        xlsx.utils.sheet_add_aoa(workSheet, [rowData], { origin: -1 });
        rowNum++;

        //merge last row
        if (rowNum > totalRecords) {
          colNum = 0;
          for (let key of keys) {
            if (lastChangedTrace[key].row != rowNum - 1) {
              merge.push({
                s: { r: lastChangedTrace[key].row, c: colNum },
                e: { r: rowNum - 1, c: colNum },
              });
            }
            colNum++;
          }
        }
      }
    }

    workSheet["!merges"] = merge;
    xlsx.utils.book_append_sheet(workBook, workSheet, traceabilityType);

    let generateToFile =
      __dirname +
      "/../../storage/exports/" +
      "Project#" +
      projectId +
      "-" +
      traceabilityType +
      "-" +
      dayjs().format("YYYYMMDDHHmmss") +
      ".xlsx";
    xlsx.writeFile(workBook, generateToFile);

    return generateToFile;
  } catch (error) {
    console.log(error);

    return null;
  }
};

module.exports = {
  runExport: runExport,
};
