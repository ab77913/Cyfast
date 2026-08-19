"use strict";

const config = require("../config.js");
const helpers = require("../helpers");
const riskFactory = require("../database/" +
  config.db_type_primary +
  "/factories/risk-factory");

/**
 * @description Get all risks
 * @param {Object} req
 * @param {Object} res
 * @returns {Object} risks
 * @todo Add authentication
 * @todo Add authorization
 * @todo Add pagination
 * @todo Add search
 * @todo Add sort
 * @todo Add filter
 * @todo Add validation
 * @todo Add error handling
 * @todo Add logging
 * @todo Add unit tests
 * @todo Add integration tests
 * @todo Add e2e tests
 * @todo Add caching
 * @todo Add monitoring
 * @example
 * GET /api/v1/risks
 *
 * */

const getRisks = async (req, res, next) => {
  try {
    const { filters, sort, include, page, size } =
      helpers.parseListFetchQuery(req.query);

    const risks = await riskFactory.getByFilter(filters, sort, page, size, include);

    return res.status(200).json(risks);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getRisk = async (req, res, next) => {
  try {
    const riskId = req.params.riskId;

    const risk = await riskFactory.getById(riskId);

    return res.status(200).json(risk);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const addRisk = async (req, res, next) => {
  try {
    //Write a code to Validate risk data
    const riskData = req.body;
    riskData.status = "NEW";

    const risk = await riskFactory.add(riskData);

    return res.status(200).json(risk);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateRisk = async (req, res, next) => {
  try {
    const riskId = req.params.riskId;
    const riskData = req.body;

    const risk = await riskFactory.update(riskId, riskData);

    return res.status(200).json(risk);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteRisk = async (req, res, next) => {
  try {
    const riskId = req.params.riskId;

    const risk = await riskFactory.remove(riskId);

    return res.status(200).json(risk);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getRisks,
  getRisk,
  addRisk,
  updateRisk,
  deleteRisk,
};
