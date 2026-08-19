"use strict";

const helpers = require("../../../helpers");
const { ProjectDocument } = require("../models");
const { Op } = require("sequelize");

const getByFilter = async (
  filters,
  sort = [],
  page = null,
  size = null,
  include = null
) => {
  try {
    sort = sort.length > 0 ? sort : [["created_date", "DESC"]];
    const { limit, offset, page: pageNum, size: pageSizeNum } =
      helpers.normalizePaging(page, size);

    const data = await ProjectDocument.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: sort,
      include: include,
    });

    const totalItems = await getCountByFilter(filters);
    const pagination = helpers.buildPaginationMeta(
      totalItems,
      pageNum,
      pageSizeNum,
    );

    return {
      data: data,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    return { data: [], pagination: {} };
  }
};

const getCountByFilter = async (filters) => {
  try {
    return await ProjectDocument.count({ where: filters });
  } catch (error) {
    console.log(error);
    return 0;
  }
};

const getById = async (projectDocumentId) => {
  try {
    return await ProjectDocument.findOne({
      where: { project_document_id: projectDocumentId },
    });
  } catch (error) {
    console.log(error);
    return null;
  }
};

const add = async (data) => {
  try {
    return await ProjectDocument.create(data);
  } catch (error) {
    console.log(error);
    return null;
  }
};

const update = async (projectDocumentId, data) => {
  try {
    const doc = await getById(projectDocumentId);
    if (!doc) throw new Error("Project document not found");
    await doc.update(data);
    return doc;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const remove = async (projectDocumentId) => {
  try {
    return await ProjectDocument.destroy({
      where: { project_document_id: projectDocumentId },
    });
  } catch (error) {
    console.log(error);
    return null;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    return await ProjectDocument.destroy({
      where: { project_id: projectId },
    });
  } catch (error) {
    console.log(error);
    return null;
  }
};

const countByDocTypeForProject = async (projectId) => {
  try {
    const sequelize = ProjectDocument.sequelize;
    const rows = await ProjectDocument.findAll({
      attributes: [
        "doc_type",
        [sequelize.fn("COUNT", sequelize.col("project_document_id")), "count"],
      ],
      where: { project_id: projectId, deleted_date: { [Op.is]: null } },
      group: ["doc_type"],
      raw: true,
    });
    return rows;
  } catch (error) {
    console.log(error);
    return [];
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  add,
  update,
  remove,
  removeByProjectId,
  countByDocTypeForProject,
};
