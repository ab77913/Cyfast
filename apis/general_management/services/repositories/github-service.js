"use strict";
const axios = require("axios");

const extractOwnerAndRepo = (link) => {
  //const linkWithoutGit = link.replace(/\.git$/, "");
  // Extract the owner and repository name using regular expressions /github\.com\/([^/]+)\/([^/]+)/;
  const regex = /github\.com[:/](.+)\/(.+)\.git$/;
  const match = link.match(regex);
  if (match && match.length === 3) {
    const owner = match[1];
    const repo = match[2];
    return { owner, repo };
  }
  return null; // Return null if extraction failed
};

async function checkGitHubRepositoryExists(owner, repo, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  var responseLogged = "";
  try {
    const response = await axios.get(url, { headers });
    if (response.status === 200) {
      responseLogged = `GitHub repository '${owner}/${repo}' exists.`;
      return responseLogged;
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      responseLogged = `GitHub repository '${owner}/${repo}' does not exist.`;
      return responseLogged;
    } else {
      responseLogged = `Error occurred while checking GitHub repository:${error.message}`;
      return responseLogged;
    }
  }
}

module.exports = {
  extractOwnerAndRepo,
  checkGitHubRepositoryExists,
};
