"use strict";

const axios = require("axios");

async function checkRepositoryExistenceBitBucket(BitbucketUrl, BitbucketToken) {
  const url = BitbucketUrl;

  // Extract the workspace and repository name from the URL using regex
  const pattern = /bitbucket\.org[\/:](\w+)\/(\w+)\.git/;
  const matches = url.match(pattern);

  if (matches) {
    const workspace = matches[1];
    const repository = matches[2];
    // Construct the API URL to check repository existence
    const apiURL = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repository}`;
    const headers = {
      Authorization: `Bearer ${BitbucketToken}`,
    };

    try {
      const response = await axios.get(apiURL, { headers });

      if (response.status === 200) {
        return "Repository exists.";
      } else if (response.status === 404) {
        return "Repository does not exist.";
      } else {
        return "An error occurred while checking repository existence.";
      }
    } catch (error) {
      return `An error occurred: ${error.message}`;
    }
  } else {
    return "Invalid URL format.";
  }
}

module.exports = {
  checkRepositoryExistenceBitBucket,
};
