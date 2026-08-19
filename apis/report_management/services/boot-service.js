"use strict";

const config = require("../../config.js");
const path = require("path");
const fs = require("fs");
const dayjs = require("dayjs");

const designTemplateFactory = require("../../database/" +
  config.db_type_secondary +
  "/factories/design-template-factory");
const reportSectionFactory = require("../../database/" +
  config.db_type_secondary +
  "/factories/report-section-factory");
const reportTemplateFactory = require("../../database/" +
  config.db_type_secondary +
  "/factories/report-template-factory");

const setupDefault = async () => {
  try {
    const isConsoleLogDefaultSetup = await setupDefaultReportTemplate(
      "CONSOLE_LOG"
    );
    const isExecutionLogDefaultSetup = await setupDefaultReportTemplate(
      "ORCHESTRATION_EXECUTION_LOG"
    );
    const isOrchestrationSummaryDefaultSetup = await setupDefaultReportTemplate(
      "ORCHESTRATION_TEST_SUMMARY"
    );
    const isProjectTestSummaryDefaultSetup = await setupDefaultReportTemplate(
      "TEST_SUMMARY"
    );

    return (
      isConsoleLogDefaultSetup &&
      isExecutionLogDefaultSetup &&
      isOrchestrationSummaryDefaultSetup &&
      isProjectTestSummaryDefaultSetup
    );
  } catch (error) {
    console.error("Error setting up default report templates:", error);
    throw error;
  }
};

const setupDefaultReportTemplate = async (reportType) => {
  try {
    let defaultReportTemplate = await reportTemplateFactory.getDefaultTemplate(
      reportType
    );
    if (!defaultReportTemplate) {
      defaultReportTemplate = await reportTemplateFactory.create({
        name: config.default_templates[reportType].name,
        report_type: reportType,
        is_default: true,
      });

      let defaultTemplate = config.default_templates[reportType];
      let designTemplates = await designTemplateFactory.getByFilter({
        report_type: reportType,
        originalname: defaultTemplate.filename,
      });
      designTemplates = designTemplates.data || [];
      let defaultDesignTemplate = null;
      let defaultSourcePath = path.join(
        defaultTemplate.dirpath,
        defaultTemplate.filename
      );
      if (designTemplates && designTemplates.length > 0) {
        defaultDesignTemplate = designTemplates[0];
      } else {
        if (fs.existsSync(defaultSourcePath)) {
          const destinationDir = path.join(
            defaultTemplate.dirpath,
            "design_templates"
          );
          if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true });
          }
          fs.copyFileSync(
            defaultSourcePath,
            path.join(
              config.app_path,
              "storage",
              "design_templates",
              defaultTemplate.filename
            )
          );
          defaultDesignTemplate = await designTemplateFactory.create({
            name: defaultTemplate.name,
            report_type: reportType,
            filepath: path.join(
              "storage",
              "design_templates",
              defaultTemplate.filename
            ),
            filename: defaultTemplate.filename,
            originalname: defaultTemplate.filename,
            mimetype: "text/html",
            dirpath: defaultTemplate.dirpath,
          });
          const defaultSectionsFilePath = path.join(
            config.app_path,
            "storage",
            "default-report-sections.json"
          );
          const defaultReportSections = JSON.parse(
            fs.readFileSync(defaultSectionsFilePath, "utf8")
          );
          let defaultReportSectionIds = [];
          if (defaultReportSections[reportType]) {
            for (let reportSection of defaultReportSections[reportType]) {
              reportSection.report_template_id = defaultReportTemplate.id;
              reportSection.report_type = reportType;

              let added = await reportSectionFactory.create(reportSection);
              if (added) {
                defaultReportSectionIds.push(added.id);
              } else {
                console.log(
                  "Failed to add default section - " + reportSection.name
                );
              }
            }
          }

          defaultReportTemplate.design_template = {
            id: defaultDesignTemplate.id,
            filepath: defaultDesignTemplate.filepath,
          };
          defaultReportTemplate.report_sections = defaultReportSectionIds;
          defaultReportTemplate = await reportTemplateFactory.update(
            defaultReportTemplate.id,
            defaultReportTemplate
          );
          console.log(
            "Default report template updated with design template and sections: " +
              defaultReportTemplate.name
          );
        } else {
          console.log(
            "Default template file not found: " +
              defaultTemplate.dirpath +
              path.sep +
              defaultTemplate.filename
          );
        }
      }
    } else {
      console.log(
        "Default report template already exists: " + defaultReportTemplate.name
      );
    }

    return true;
  } catch (error) {
    console.error(
      "Error setting up default report template for type " +
        reportType +
        ": " +
        error.message
    );
    return false;
  }
};

module.exports = {
  setupDefault: setupDefault,
};
