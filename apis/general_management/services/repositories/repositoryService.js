"use strict";

const config = require("../config.js");

const { Repository } = require("../database/" +
  config.db_type_primary +
  "/models");

const getByFilter = async (filters, sort = []) => {
  sort = sort.length > 0 ? sort : ["created_date", "Desc"];
  const repositories = await Repository.findAll({
    where: filters,
    order: [sort],
  });

  return repositories;
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
  const repository = await Repository.update(repositoryData, {
    where: {
      RepositoryId: repositoryId,
    },
  });

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

const checkConnection = async (repositoryDetails) => {
  const {
    RepositoryType,
    RepositoryUrl,
    RepositoryUsername,
    RepositoryPassword,
  } = repositoryDetails;

  //return repository;
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  addRepository,
  updateRepository,
  deleteRepository,
};
