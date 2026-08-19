"use strict";

const dashboardData = require("../data/dashboards");

const getStatDetails = async (organizationId) => {
  try {
    const statDetails = dashboardData.getStatDetails(organizationId);

    return statDetails;
  } catch (error) {
    console.log(error);

    return null;
  }
};

module.exports = {
  getStatDetails,
};
