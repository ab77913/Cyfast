/**
 * @file user-service.js
 * @description Provides functions for user management, including changing passwords.
 * @requires bcryptjs - For hashing passwords.
 * @requires config - Configuration settings for database type.
 * @requires userFactory - Factory for user database operations.
 *
 */
"use strict";

const bcrypt = require("bcryptjs");
const config = require("../config.js");
const userFactory = require("../database/" +
  config.db_type_primary +
  "/factories/user-factory");

const changePassword = async (userId, userData) => {
  try {
    const user = await userFactory.getById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const isPasswordValid = await bcrypt.compare(
      userData.password,
      user.password_hash
    );
    if (!isPasswordValid) {
      throw new Error("Old password is incorrect");
    }
    const hashedNewPassword = await bcrypt.hash(userData.new_password, 10);
    user.password = hashedNewPassword;
    const updatedUser = await userFactory.update(user.userId, user);
    if (!updatedUser) {
      throw new Error("Failed to update password");
    }
    delete updatedUser.password_hash; // Remove password hash from the response

    return updatedUser;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

module.exports = {
  changePassword,
};
