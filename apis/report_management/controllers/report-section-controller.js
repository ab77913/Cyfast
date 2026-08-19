"use strict";

const fs = require("fs");
const path = require("path");
const config = require("../config.js");
const reportSectionFactory = require(
  "../database/" +
    config.db_type_secondary +
    "/factories/report-section-factory",
);

const reportSectionController = {
  getReportSections: async (req, res) => {
    const { page, size, filters, sort } = req.query;

    const reportSections = await reportSectionFactory.getByFilter(
      filters,
      sort,
      page,
      size,
    );

    res.send(reportSections);
  },

  getReportSection: async (req, res) => {
    const reportSectionId = req.params.reportSectionId;

    const reportSection = await reportSectionFactory.getById(reportSectionId);

    res.send(reportSection);
  },

  addReportSection: async (req, res) => {
    const reportSection = req.body;

    const result = await reportSectionFactory.create(reportSection);

    res.send(result);
  },

  addDefaultReportSections: async (req, res) => {
    const reportType = req.body.report_type;
    const reportTemplateId = req.body.report_template_id;

    try {
      let count = 0;
      const defaultFilePath = path.join(
        __dirname,
        "../storage/",
        "default-report-sections.json",
      );
      const defaultReportSections = JSON.parse(
        fs.readFileSync(path.join(defaultFilePath), "utf8"),
      );
      if (defaultReportSections[reportType]) {
        for (let reportSection of defaultReportSections[reportType]) {
          reportSection.report_template_id = reportTemplateId;
          reportSection.report_type = reportType;

          let added = await reportSectionFactory.create(reportSection);
          if (added)
            console.log("Added default section - " + reportSection.name);

          count++;
        }
      }

      res.send({ count: count });
    } catch (error) {
      console.log(error);

      res.status(500).send("Internal Server Error - " + error);
    }
  },

  updateReportSection: async (req, res) => {
    try {
      const reportSectionId = req.params.reportSectionId;
      const reportSection = req.body;

      const result = await reportSectionFactory.update(
        reportSectionId,
        reportSection,
      );

      res.send(result);
    } catch (error) {
      console.log(error);
      res.status(500).send("Internal Server Error - " + error);
    }
  },

  deleteReportSection: async (req, res) => {
    try {
      const reportSectionId = req.params.reportSectionId;

      const result = await reportSectionFactory.remove(reportSectionId);

      res.send(result);
    } catch (error) {
      console.log(error);
      res.status(500).send("Internal Server Error - " + error);
    }
  },
};

module.exports = reportSectionController;
