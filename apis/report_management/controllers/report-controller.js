"use strict";

var PizZip = require("pizzip");
var Docxtemplater = require("docxtemplater");

const config = require("../config.js");
const fs = require("fs");
const htmlParser = require("node-html-parser");

const reportTemplateFactory = require(
  "../database/" +
    config.db_type_secondary +
    "/factories/report-template-factory",
);
const reportService = require("../services/reports/report-service.js");

const reportController = {
  downloadReport: async (req, res) => {},

  generateReport: async (req, res) => {
    try {
      const targetFormat = req.query.target_format;
      let reportTemplateId = req.query.report_template_id;
      const reportType = req.query.report_type;
      const filters = req.query.filters;
      let reportTemplate = null;

      //Get report template based on reportTemplateId or reportType's default template
      if (
        (reportTemplateId == undefined ||
          reportTemplateId == null ||
          reportTemplateId == "") &&
        (reportType == undefined || reportType == null || reportType == "")
      ) {
        res
          .status(400)
          .send(
            "Bad Request... Please provide report template id or report type",
          ); //Send Bad Request if reportTemplateId or reportType is not provided
        return;
      } else if (
        (reportTemplateId == undefined ||
          reportTemplateId == null ||
          reportTemplateId == "") &&
        reportType
      ) {
        reportTemplate =
          await reportTemplateFactory.getDefaultTemplate(reportType); //Get default template if reportTemplateId is not provided
        if (reportTemplate) {
          reportTemplateId = reportTemplate.id;
        } else {
          res
            .status(400)
            .send("Bad Request... Please provide valid report type"); //Send Bad Request if reportType is not valid or no default report found from type
          return;
        }
      } else if (reportTemplateId) {
        reportTemplate = await reportTemplateFactory.getById(reportTemplateId);
        if (!reportTemplate) {
          res
            .status(400)
            .send("Bad Request... Please provide valid report template id");
          return;
        }
      }

      const report = await reportService.generateReport(
        filters,
        reportTemplate,
        targetFormat,
      );
      res.contentType("application/pdf");
      res.send(report);
    } catch (error) {
      console.log(error);

      res.status(500).send("Internal Server Error - " + error);
    }
  },

  previewReport: async (req, res) => {
    try {
      let reportTemplate = null;

      const reportTemplateId = req.body.report_template_id;
      const designTemplate = req.body.design_template;
      const reportSections = req.body.report_sections;
      if (!reportTemplateId) {
        res
          .status(400)
          .send("Bad Request... Please provide report_template_id");
        return;
      }

      reportTemplate = await reportTemplateFactory.getById(reportTemplateId);
      if (!reportTemplate) {
        res
          .status(400)
          .send("Bad Request... Please provide valid report_template_id");
        return;
      }

      reportTemplate.design_template = designTemplate;
      reportTemplate.report_sections = reportSections;

      const report = await reportService.generateHtml(null, reportTemplate);

      res.send(report.htmlContent);
    } catch (error) {
      return {};
    }
  },

  wordToWord: async (req, res) => {
    const template = fs.readFileSync(
      config.app_path + "/storage/word-template.docx",
      "binary",
    );

    var zip = new PizZip(template);
    var doc;
    try {
      doc = new Docxtemplater(zip);

      doc.setData({
        username: "akamble",
        email: "amit.campbel@gmail.com",
        phone: "0652455478",
      });

      doc.render();

      var buf = doc.getZip().generate({ type: "nodebuffer" });
      fs.writeFileSync(
        config.app_path + "/storage/design_templates/generated2.docx",
        buf,
      );

      res.status(200).send("Report generated successfully");
    } catch (error) {
      console.log(error);
    }
  },
};

module.exports = reportController;
