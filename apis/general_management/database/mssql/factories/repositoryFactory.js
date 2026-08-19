"use strict";

const helpers = require("../../../helpers");
const { Repository } = require("../models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");

const getByFilter = async (filters, sort = [], page = null, size = null) => {
  page = page || 1;
  size = size || 10;

  sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
  let { limit, offset } = helpers.getPagination(page, size);

  const repositories = await Repository.findAll({
    limit: limit,
    offset: offset,
    where: filters,
    order: [sort],
  });

  let pagination = {};
  const totalItems = await getCountByFilter({});
  if (repositories && repositories.length > 0) {
    pagination = {
      totalItems: totalItems,
      totalPages: Math.ceil(totalItems / size),
      currentPage: page,
    };
  }

  return {
    data: repositories,
    pagination: pagination,
  };
};

const getCountByFilter = async (filters) => {
  const repositoriesCount = await Repository.count({
    where: filters,
  });

  return repositoriesCount;
};

const getById = async (repositoryId) => {
  const repository = await Repository.findOne({
    where: {
      RepositoryId: repositoryId,
    },
  });

  return repository;
};

const addRepository = async (repositoryData) => {
  const repository = await Repository.create(repositoryData);

  return repository;
};

const updateRepository = async (repositoryId, repositoryData) => {
  const repository = await getById(repositoryId);
  if (!repository) throw new Error("Repository not found");

  await repository.update(repositoryData);

  return repository;
};

const deleteRepository = async (repositoryId) => {
  const repository = await Repository.destroy({
    where: {
      RepositoryId: repositoryId,
    },
  });

  return repository;
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  addRepository,
  updateRepository,
  deleteRepository,
};
