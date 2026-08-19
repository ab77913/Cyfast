"use strict";

const { QueryTypes } = require("sequelize");
const helpers = require("../../../helpers");
const db = require("../models");
const { JOB_TYPES } = require("../../../constants/job-types");
const { Job, GeneratedRequirement } = db;

const requirementJobWhere = () => ({
  job_type: JOB_TYPES.REQUIREMENT_GENERATION,
});

const getJobById = async (jobId) => {
  return Job.findByPk(jobId, {
    include: [
      {
        model: GeneratedRequirement,
        as: "candidates",
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
      ...requirementJobWhere(),
    },
    order: [["created_date", "DESC"]],
    limit,
    offset,
    include: [
      {
        model: GeneratedRequirement,
        as: "candidates",
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
    job_type: payload.job_type ?? JOB_TYPES.REQUIREMENT_GENERATION,
  });
};

const updateJob = async (jobId, fields) => {
  const row = await Job.findByPk(jobId);
  if (!row) return null;
  await row.update(fields);
  return row;
};

const bulkCreateCandidates = async (rows) => {
  return GeneratedRequirement.bulkCreate(rows);
};

const deletePendingCandidatesForJob = async (jobId) => {
  return GeneratedRequirement.destroy({
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
        ...requirementJobWhere(),
      },
    },
  ];
  const where = { approval_status: "PENDING" };

  const count = await GeneratedRequirement.count({
    where,
    include,
    distinct: true,
    col: "generated_requirement_id",
  });

  const rows = await GeneratedRequirement.findAll({
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

/** All job_ids that still have pending generated requirements for this project (for batch discard UI). */
const listPendingJobIdsForProject = async (projectId) => {
  const sequelize = GeneratedRequirement.sequelize;
  const rows = await sequelize.query(
    `SELECT DISTINCT g.job_id AS job_id
     FROM generated_requirement AS g
     INNER JOIN job AS j ON g.job_id = j.job_id
     WHERE j.project_id = :pid AND j.job_type = :jt AND g.approval_status = :st`,
    {
      replacements: {
        pid: Number(projectId),
        jt: JOB_TYPES.REQUIREMENT_GENERATION,
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
  return GeneratedRequirement.findByPk(id, {
    include: [{ model: Job, as: "job" }],
  });
};

const updateCandidate = async (id, fields) => {
  const row = await GeneratedRequirement.findByPk(id);
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
