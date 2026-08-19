"use strict";

const config = require("../config.js");
const helpers = require("../helpers");
const testScenarioFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-scenario-factory");

const getTestScenarios = async (req, res) => {
  try {
    let { filters, sort, page, size } =
      helpers.parseListFetchQuery(req.query);

    filters = filters && typeof filters === "object" ? { ...filters } : {};
    if (!Object.prototype.hasOwnProperty.call(filters, "deleted_date")) {
      filters.deleted_date = null;
    }

    const scenarios = await testScenarioFactory.getByFilter(
      filters,
      sort,
      page,
      size,
    );

    return res.status(200).json(scenarios);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getTestScenario = async (req, res) => {
  try {
    const testScenarioId = req.params.testScenarioId;

    const row = await testScenarioFactory.getById(testScenarioId);

    if (!row) {
      return res.status(404).json({ message: "Not found" });
    }

    return res.status(200).json(row);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getTestScenarios,
  getTestScenario,
};
