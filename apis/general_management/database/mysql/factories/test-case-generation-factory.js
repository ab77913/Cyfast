"use strict";

const { QueryTypes } = require("sequelize");
const helpers = require("../../../helpers");
const db = require("../models");
const { JOB_TYPES } = require("../../../constants/job-types");
const { Job, GeneratedTestCase, TestCase } = db;

const testCaseJobWhere = () => ({
  job_type: JOB_TYPES.TEST_CASE_GENERATION,
});

const getJobById = async (jobId) => {
  return Job.findByPk(jobId, {
    include: [
      {
        model: GeneratedTestCase,
        as: "test_case_candidates",
        required: false,
      },
    ],
  });
};

const createJob = async (payload) => {
  return Job.create({
    ...payload,
    job_type: payload.job_type ?? JOB_TYPES.TEST_CASE_GENERATION,
  });
};

const updateJob = async (jobId, fields) => {
  const row = await Job.findByPk(jobId);
  if (!row) return null;
  await row.update(fields);
  return row;
};

const bulkCreateCandidates = async (rows) => {
  return GeneratedTestCase.bulkCreate(rows);
};

const listPendingCandidatesForProject = async (projectId, page, size) => {
  const { limit, offset, page: pageNum, size: pageSizeNum } =
    helpers.normalizePaging(page, size);

  const include = [
    {
      model: Job,
      as: "job",
      required: false,
    },
    {
      model: db.Requirement,
      as: "requirement",
      required: false,
    },
    {
      model: db.TestScenario,
      as: "test_scenario",
      required: false,
    },
  ];
  const where = {
    project_id: Number(projectId),
    approval_status: "PENDING",
    deleted_date: null,
  };

  const count = await GeneratedTestCase.count({ where, include, distinct: true });

  const rows = await GeneratedTestCase.findAll({
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
  const sequelizeInst = GeneratedTestCase.sequelize;
  const rows = await sequelizeInst.query(
    `SELECT DISTINCT g.job_id AS job_id
     FROM generated_test_case AS g
     INNER JOIN job AS j ON g.job_id = j.job_id
     WHERE g.project_id = :pid AND j.job_type = :jt AND g.approval_status = :st`,
    {
      replacements: {
        pid: Number(projectId),
        jt: JOB_TYPES.TEST_CASE_GENERATION,
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
  return GeneratedTestCase.findByPk(id, {
    include: [
      { model: Job, as: "job" },
      { model: db.Requirement, as: "requirement", required: false },
      { model: db.TestScenario, as: "test_scenario", required: false },
    ],
  });
};

const updateCandidate = async (id, fields) => {
  const row = await GeneratedTestCase.findByPk(id);
  if (!row) return null;
  await row.update(fields);
  return row;
};

const countCandidatesForJob = async (jobId, approvalStatus = null) => {
  const where = { job_id: jobId };
  if (approvalStatus) where.approval_status = approvalStatus;
  return GeneratedTestCase.count({ where });
};

const countPendingForProject = async (projectId) => {
  return GeneratedTestCase.count({
    where: {
      project_id: Number(projectId),
      approval_status: "PENDING",
      deleted_date: null,
    },
  });
};

const listPendingForDuplicateCheck = async (projectId) => {
  return GeneratedTestCase.findAll({
    where: {
      project_id: Number(projectId),
      approval_status: "PENDING",
      deleted_date: null,
    },
    attributes: [
      "requirement_id",
      "requirement_no",
      "test_scenario_id",
      "scenario_title",
      "test_case_name",
    ],
  });
};

const countActiveTestCasesForProject = async (projectId) => {
  return TestCase.count({
    where: {
      project_id: Number(projectId),
      deleted_date: null,
    },
  });
};

const countApprovedGeneratedForProject = async (projectId) => {
  return GeneratedTestCase.count({
    where: {
      project_id: Number(projectId),
      approval_status: "APPROVED",
      deleted_date: null,
    },
  });
};

module.exports = {
  getJobById,
  createJob,
  updateJob,
  bulkCreateCandidates,
  listPendingCandidatesForProject,
  listPendingJobIdsForProject,
  getCandidateById,
  updateCandidate,
  countCandidatesForJob,
  countPendingForProject,
  listPendingForDuplicateCheck,
  countActiveTestCasesForProject,
  countApprovedGeneratedForProject,
};
