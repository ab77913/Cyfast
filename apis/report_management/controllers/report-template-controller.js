"use strict";

const config = require("../config.js");
const reportTemplateFactory = require(
  "../database/" +
    config.db_type_secondary +
    "/factories/report-template-factory",
);

const reportTemplateController = {
  getReportTemplates: async (req, res) => {
    const { page, size, filters, sort } = req.query;

    const reportTemplates = await reportTemplateFactory.getByFilter(
      filters,
      sort,
      page,
      size,
    );

    res.send(reportTemplates);
  },

  getReportTemplate: async (req, res) => {
    const reportTemplateId = req.params.reportTemplateId;

    const reportTemplate =
      await reportTemplateFactory.getById(reportTemplateId);

    res.send(reportTemplate);
  },

  createReportTemplate: async (req, res) => {
    const data = req.body;
    console.log("Data", data);
    let countReportTemplates = await reportTemplateFactory.getCountByFilter({
      report_type: data.report_type,
    });
    console.log("count ", countReportTemplates);
    if (countReportTemplates <= 0) {
      data.is_default = true;
    }
    const reportTemplate = await reportTemplateFactory.create(data);

    res.send(reportTemplate);
  },

  updateReportTemplate: async (req, res) => {
    const reportTemplateId = req.params.reportTemplateId;
    const data = req.body;

    const reportTemplate = await reportTemplateFactory.update(
      reportTemplateId,
      data,
    );

    res.send(reportTemplate);
  },

  deleteReportTemplate: async (req, res) => {
    const reportTemplateId = req.params.reportTemplateId;

    const reportTemplate = await reportTemplateFactory.remove(reportTemplateId);

    res.send(reportTemplate);
  },

  setDefaultReportTemplate: async (req, res) => {
    const reportTemplateId = req.params.reportTemplateId;
    const { page, size, filters, sort } = req.query;

    const reportTemplates = await reportTemplateFactory.getByFilter(
      filters,
      sort,
      page,
      size,
    );
    const setDefaultTemplateValue = await reportTemplateFactory.setDefault(
      reportTemplateId,
      reportTemplates,
    );
    console.log("done", setDefaultTemplateValue);
    res.send({
      message: `Report Template with ID ${reportTemplateId} was Set as Default`,
    });
  },
};

module.exports = reportTemplateController;
