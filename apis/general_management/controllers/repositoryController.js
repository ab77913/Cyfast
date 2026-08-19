"use strict";

const config = require("../config.js");

const repositoryFactory = require("../database/" + config.db_type_primary + "/factories/repositoryFactory");
const repositoryService = require("../services/repositoryService.js");
const bitbucketService = require("../services/bitbucketService.js");
const azureService = require("../services/azureService.js");
const githubService = require("../services/githubService.js");

/**
 * @description Get all repositories
 * @param {Object} req
 * @param {Object} res
 * @param {Object} next
 * @returns {Object} repositories
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
 * @todo Add swagger
 * @todo Add authentication
 * @todo Add authorization
 * @todo Add caching
 * @todo Add monitoring
 * @example
 * GET /api/v1/repositories
 *
 * */
const getRepositories = async (req, res, next) => {
  try {
    const { page, size, filters, sort } = req.query;

    const repositories = await repositoryFactory.getByFilter(filters, sort, page, size);

    return res.status(200).json(repositories);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getRepository = async (req, res, next) => {
  try {
    const repositoryId = req.params.repositoryId;
    console.log(repositoryId);
    const repository = await repositoryFactory.getById(repositoryId);

    return res.status(200).json(repository);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const addRepository = async (req, res, next) => {
  try {
    const repository = req.body;

    const newRepository = await repositoryFactory.addRepository(repository);

    return res.status(201).json(newRepository);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateRepository = async (req, res, next) => {
  try {
    const repositoryId = req.params.repositoryId;
    const repositoryData = req.body;

    const repository = await repositoryFactory.updateRepository(repositoryId, repositoryData);

    return res.status(200).json(repository);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteRepository = async (req, res, next) => {
  try {
    const repositoryId = req.params.repositoryId;

    await repositoryFactory.deleteRepository(repositoryId);

    return res.status(200).json({ message: "Repository deleted" });
  } catch (error) {
    return res.status(500).json(error);
  }
};

const testConnection = async (req, res, next) => {
  try {
    //---------------------->github start
    // const { Url, token } = req.body;
    // const result = githubService.extractOwnerAndRepo(Url);
    // var resultFromCheckRepo = "";
    // if (result) {
    //   const { owner, repo } = result;
    //   const returnResult = await githubService.checkGitHubRepositoryExists(owner, repo, token);
    //   resultFromCheckRepo = returnResult;
    // } else {
    //   resultFromCheckRepo = "Invalid GitHub repository link.";
    // }
    // const responseObject = {
    //   logs: resultFromCheckRepo,
    // };
    // //const testResult = await repositoryService.testConnection(repositoryData);
    // return res.status(200).json(responseObject);
    //-------------------->github end
    //-------------------->Azure start
    // const { AzureUrl, AzureToken } = req.body;
    // var resultFromCheckRepoAzure = "";
    // const httpsResultAzure = azureService.parseAzureDevOpsRepositoryLink(AzureUrl);
    // if (httpsResultAzure) {
    //   const { organization, repository, project } = httpsResultAzure;
    //   const returnResultAzure = await azureService.checkRepositoryExistenceAzure(organization, repository, project, AzureToken);
    //   resultFromCheckRepoAzure = returnResultAzure;
    // } else {
    //   resultFromCheckRepoAzure = "Invalid Azure repository link.";
    // }
    // const responseObjectAzure = {
    //   logs: resultFromCheckRepoAzure,
    // };
    // return res.status(200).json(responseObjectAzure);
    //---------------------->Azure end
    //---------------------->Bitbucket start
    // const { BitbucketUrl, BitbucketToken } = req.body;
    // const returnResultBitbucket = await bitbucketService.checkRepositoryExistenceBitBucket(BitbucketUrl, BitbucketToken);
    // console.log("logged", returnResultBitbucket);
    // return res.status(200).json(returnResultBitbucket);
    //---------------------->Bitbucket end
    return res.status(200).json({});
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getRepositories,
  getRepository,
  addRepository,
  updateRepository,
  deleteRepository,
  testConnection,
};
