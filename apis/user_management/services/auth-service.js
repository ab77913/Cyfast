/**
 * @file auth-service.js
 * @description Provides functions for generating and verifying JWT tokens.
 * @requires jsonwebtoken
 * @requires config - Configuration settings for token secrets.
 *
 */

"use strict";

const jwt = require("jsonwebtoken");
const config = require("../config.js");

const generateApiToken = (api) => {
  try {
    return jwt.sign(
      { apiId: api.apiId, apiKey: api.apiKey },
      config.apiTokenSecret,
      { expiresIn: "1h" }
    );
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const verifyApiToken = (apiToken) => {
  try {
    return jwt.verify(apiToken, config.apiTokenSecret);
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const generateAccessToken = (user) => {
  try {
    return jwt.sign(
      { username: user.username, userId: user.userId },
      config.accessTokenSecret,
      { expiresIn: "15m" }
    );
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const generateRefreshToken = (user) => {
  try {
    return jwt.sign(
      { username: user.username, userId: user.userId },
      config.refreshTokenSecret
    );
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const verifyAccessToken = (accessToken) => {
  try {
    return jwt.verify(accessToken, config.accessTokenSecret);
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const verifyRefreshToken = (refreshToken) => {
  try {
    return jwt.verify(refreshToken, config.refreshTokenSecret);
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.log(error);

    throw error;
  }
};

module.exports = {
  generateApiToken,
  verifyApiToken,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};
