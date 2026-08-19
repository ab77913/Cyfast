"use strict";
const axios = require("axios");

function parseAzureDevOpsRepositoryLink(link) {
  const [, organization, project, repository] =
    link.match(/[^@]+@[^:]+:[^/]+\/([^/]+)\/([^/]+)\/([^/]+)/) ||
    link.match(/(?:https:\/\/[^/]+\/|git@[^:]+:)([^/]+)\/([^/]+)\/_git\/([^/]+)/);
  return {
    organization,
    project,
    repository,
  };
}

async function checkRepositoryExistenceAzure(organization, repository, project, AzureToken) {
  try {
    const baseUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}`;
    console.log("base url", baseUrl);
    const headers = {
      Authorization: `Bearer ${AzureToken}`,
    };
    const response = await axios.get(baseUrl, { headers });
    var responseLoggedAzure = "";
    if (response.status === 200) {
      responseLoggedAzure = `Repository '${repository}' exists.`;
      return responseLoggedAzure;
    } else {
      responseLoggedAzure = `Repository '${repository}' does not exist. ${response.status}`;
      return responseLoggedAzure;
    }
  } catch (error) {
    responseLoggedAzure = `Error checking repository existence: ${error.message}`;
    return responseLoggedAzure;
  }
}

module.exports = {
  parseAzureDevOpsRepositoryLink,
  checkRepositoryExistenceAzure,
};
