"use strict";

const htmlParser = require("node-html-parser");
const config = require("../../config.js");
const path = require("path");
const fs = require("fs");
const dayjs = require("dayjs");

const reportSectionFactory = require("../../database/" +
  config.db_type_secondary +
  "/factories/report-section-factory");

const datasetService = require("./dataset-service.js");
const pdfService = require("./pdf-service.js");
const htmlService = require("./html-service.js");
const wordService = require("./word-service.js");

const generateHtml = async (filters, reportTemplate) => {
  console.log("Generating HTML for report template", reportTemplate);
  let designTemplatePath = reportTemplate.design_template.filepath;
  console.log("Design Template Path", designTemplatePath);
  let htmlContent = "";
  if (fs.existsSync(designTemplatePath)) {
    htmlContent = fs.readFileSync(designTemplatePath, "utf8");
  } else {
    throw new Error("Design Template file not found");
  }

  let contentHtml = "";
  if (
    reportTemplate.report_sections &&
    reportTemplate.report_sections.length > 0
  ) {
    let reportSections = await reportSectionFactory.getByIds(
      reportTemplate.report_sections
    );
    //console.log("Report Sections - ", reportSections);
    for (let i = 0; i < reportSections.length; i++) {
      let reportSection = reportSections[i];
      contentHtml += reportSection.details;
    }
  }

  let docName = "";
  let rootHtml = htmlParser.parse(htmlContent);
  let reportSectionHtml = rootHtml.querySelector("#report_content");
  reportSectionHtml.set_content(contentHtml);
  htmlContent = rootHtml.toString();

  htmlContent = htmlContent.replaceAll(
    "{{generated_date}}",
    dayjs().format("MMM DD, YYYY")
  );

  if (filters) {
    if (reportTemplate.report_type == "TEST_SUMMARY") {
      htmlContent = await datasetService.replaceTestSummaryVariables(
        htmlContent,
        filters
      );
    } else if (reportTemplate.report_type == "ORCHESTRATION_TEST_SUMMARY") {
      htmlContent = await datasetService.replaceOrchestrationSummaryVariables(
        htmlContent,
        filters
      );
    } else if (reportTemplate.report_type == "ORCHESTRATION_EXECUTION_LOG") {
      htmlContent = await datasetService.replaceExecutionLogVariables(
        htmlContent,
        filters
      );
    } else if (reportTemplate.report_type == "CONSOLE_LOG") {
      htmlContent = await datasetService.replaceConsoleLogVariables(
        htmlContent,
        filters
      );
    }
  }
  //console.log("HTML Content", htmlContent);

  //Generate Header and Footer Templates
  rootHtml = htmlParser.parse(htmlContent);
  let headerTemplate = htmlService.generateHeaderTemplate(
    docName,
    reportTemplate.report_type
  );
  let footerTemplate = htmlService.generateFooterTemplate();
  let headerHtml = rootHtml.querySelector("#header-template");
  if (headerHtml) {
    headerTemplate = headerHtml.toString();
    headerHtml.remove();
  }
  let footerHtml = rootHtml.querySelector("#footer-template");
  if (footerHtml) {
    footerTemplate = footerHtml.toString();
    footerHtml.remove();
  }
  htmlContent = rootHtml.toString();

  //Replace unhandled variables with empty string
  let reportVariables = htmlService.extractReportVariables(htmlContent);
  if (reportVariables && reportVariables.length > 0) {
    for (let i = 0; i < reportVariables.length; i++) {
      let reportVariable = reportVariables[i];
      let variableValue = "";

      htmlContent = htmlContent.replaceAll(
        "{{" + reportVariable + "}}",
        variableValue
      );
    }
  }

  return {
    headerTemplate: headerTemplate,
    footerTemplate: footerTemplate,
    htmlContent: htmlContent,
  };
};

const generateReport = async (filters, reportTemplate, targetFormat) => {
  targetFormat = targetFormat || "pdf";

  let htmlReport = await generateHtml(filters, reportTemplate);

  let pdfBuffer = await pdfService.generatePdfFromHtml(
    htmlReport.htmlContent,
    htmlReport.headerTemplate,
    htmlReport.footerTemplate
  );

  return pdfBuffer;
};

module.exports = {
  generateHtml,
  generateReport,
};
