"use strict";

const { QueryTypes } = require("sequelize");
const helpers = require("../../../helpers");
const db = require("../models");
const { JOB_TYPES } = require("../../../constants/job-types");
const { Job, GeneratedTestScenario } = db;

const scenarioJobWhere = () => ({
  job_type: JOB_TYPES.TEST_SCENARIO_GENERATION,
});

const getJobById = async (jobId) => {
  return Job.findByPk(jobId, {
    include: [
      {
        model: GeneratedTestScenario,
        as: "scenario_candidates",
        required: false,
      },
    ],
  });
};

const listJobsForProject = async (projectId, { page = 1, size = 20 } = {}) => {
  const limit = Number(size) || 20;
  const offset = ((Number(page) || 1) - 1) * limit;
  const { rows, count } = await Job.findAndCountAll({
    where: {
      project_id: projectId,
      ...scenarioJobWhere(),
    },
    order: [["created_date", "DESC"]],
    limit,
    offset,
    include: [
      {
        model: GeneratedTestScenario,
        as: "scenario_candidates",
        required: false,
      },
    ],
  });
  return {
    data: rows,
    pagination: {
      totalItems: count,
      totalPages: Math.ceil(count / limit) || 1,
      currentPage: Number(page),
    },
  };
};

const createJob = async (payload) => {
  return Job.create({
    ...payload,
    job_type: payload.job_type ?? JOB_TYPES.TEST_SCENARIO_GENERATION,
  });
};

const updateJob = async (jobId, fields) => {
  const row = await Job.findByPk(jobId);
  if (!row) return null;
  await row.update(fields);
  return row;
};

const bulkCreateCandidates = async (rows) => {
  return GeneratedTestScenario.bulkCreate(rows);
};

const deletePendingCandidatesForJob = async (jobId) => {
  return GeneratedTestScenario.destroy({
    where: { job_id: jobId, approval_status: "PENDING" },
  });
};

const listPendingCandidatesForProject = async (projectId, page, size) => {
  const { limit, offset, page: pageNum, size: pageSizeNum } =
    helpers.normalizePaging(page, size);

  const include = [
    {
      model: Job,
      as: "job",
      required: true,
      where: {
        project_id: projectId,
        ...scenarioJobWhere(),
      },
    },
    {
      model: db.Requirement,
      as: "requirement",
      required: false,
    },
  ];
  const where = { approval_status: "PENDING" };

  const count = await GeneratedTestScenario.count({
    where,
    include,
    distinct: true,
    col: "generated_test_scenario_id",
  });

  const rows = await GeneratedTestScenario.findAll({
    where,
    include,
    order: [["created_date", "DESC"]],
    limit,
    offset,
  });

  return {
    data: rows,
    pagination: helpers.buildPaginationMeta(count, pageNum, pageSizeNum),
  };
};

const listPendingJobIdsForProject = async (projectId) => {
  const sequelizeInst = GeneratedTestScenario.sequelize;
  const rows = await sequelizeInst.query(
    `SELECT DISTINCT g.job_id AS job_id
     FROM generated_test_scenario AS g
     INNER JOIN job AS j ON g.job_id = j.job_id
     WHERE j.project_id = :pid AND j.job_type = :jt AND g.approval_status = :st`,
    {
      replacements: {
        pid: Number(projectId),
        jt: JOB_TYPES.TEST_SCENARIO_GENERATION,
        st: "PENDING",
      },
      type: QueryTypes.SELECT,
    },
  );
  const ids = rows
    .map((r) => Number(r.job_id))
    .filter((n) => Number.isFinite(n));
  return [...new Set(ids)].sort((a, b) => b - a);
};

const getCandidateById = async (id) => {
  return GeneratedTestScenario.findByPk(id, {
    include: [
      { model: Job, as: "job" },
      { model: db.Requirement, as: "requirement", required: false },
    ],
  });
};

const updateCandidate = async (id, fields) => {
  const row = await GeneratedTestScenario.findByPk(id);
  if (!row) return null;
  await row.update(fields);
  return row;
};

module.exports = {
  getJobById,
  listJobsForProject,
  createJob,
  updateJob,
  bulkCreateCandidates,
  deletePendingCandidatesForJob,
  listPendingCandidatesForProject,
  listPendingJobIdsForProject,
  getCandidateById,
  updateCandidate,
};
