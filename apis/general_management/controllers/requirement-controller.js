"use strict";

const config = require("../config.js");
const helpers = require("../helpers");
const requirementFactory = require("../database/" +
  config.db_type_primary +
  "/factories/requirement-factory");

/**
 * @description Get all requirements
 * @param {Object} req
 * @param {Object} res
 * @returns {Object} requirements
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
 * GET /api/v1/requirements
 *
 * */

const getRequirements = async (req, res, next) => {
  try {
    const { filters, sort, include, page, size } =
      helpers.parseListFetchQuery(req.query);

    const requirements = await requirementFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );

    return res.status(200).json(requirements);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getRequirement = async (req, res, next) => {
  try {
    const requirementId = req.params.requirementId;

    const requirement = await requirementFactory.getById(requirementId);

    return res.status(200).json(requirement);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const addRequirement = async (req, res, next) => {
  try {
    //Write a code to Validate requirement data
    const requirementData = req.body;
    requirementData.status = "NEW";

    const requirement = await requirementFactory.add(requirementData);

    return res.status(200).json(requirement);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateRequirement = async (req, res, next) => {
  try {
    const requirementId = req.params.requirementId;
    const requirementData = req.body;

    const requirement = await requirementFactory.update(
      requirementId,
      requirementData
    );

    return res.status(200).json(requirement);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteRequirement = async (req, res, next) => {
  try {
    const requirementId = req.params.requirementId;

    const requirement = await requirementFactory.remove(requirementId);

    return res.status(200).json(requirement);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getRequirements,
  getRequirement,
  addRequirement,
  updateRequirement,
  deleteRequirement,
};
