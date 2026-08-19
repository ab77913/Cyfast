"use strict";

const helpers = require("../../../helpers");
const ConsoleLog = require("../models/consoleLog");

const getByFilter = async (filters, sort = null, page = null, size = null) => {
  let sortCondition = { created_date: -1 };
  
  if (sort && typeof sort === 'object' && !Array.isArray(sort)) {
    // Handle sort as object: sort[created_date]=desc
    const sortKey = Object.keys(sort)[0];
    const sortValue = sort[sortKey];
    sortCondition = { [sortKey]: sortValue === "asc" ? 1 : -1 };
  } else if (sort && typeof sort === 'string') {
    // Handle sort as string: sort=created_date:desc
    sortCondition = {
      [sort.split(":")[0]]: sort.split(":")[1] === "asc" ? 1 : -1,
    };
  }
  
  const { limit, offset } = helpers.getPagination(page, size);
  const conditions = filters ? filters : {};

  const logsData = ConsoleLog.find(conditions)
    .limit(limit)
    .skip(offset)
    .sort(sortCondition)
    .then((data) => {
      return data;
    });

  const totalItems = ConsoleLog.countDocuments(conditions).then((count) => {
    return count;
  });

  const consoleLogs = Promise.all([logsData, totalItems]).then((results) => {
    const logsData = results[0];
    const totalItems = results[1];

    const currentPage = page !== null && page !== undefined ? +page : 0;
    const totalPages = Math.ceil(totalItems / limit);

    const response = {
      data: logsData,
      pagination: {
        totalItems: totalItems,
        totalPages: totalPages,
        currentPage: currentPage,
      },
    };

    return response;
  });

  return consoleLogs;
};

const getCountByFilter = async (filters) => {
  const totalItems = ConsoleLog.countDocuments(filters).then((count) => {
    return count;
  });

  return totalItems;
};

const getLogById = async (id) => {
  const consoleLog = ConsoleLog.findById(id).then((data) => {
    return data;
  });

  return consoleLog;
};

const getLogByExecutionIdByAgentId = async (executionId, agentId) => {
  try {
    const consoleLog = await ConsoleLog.findOne({
      orchestration_execution_id: executionId,
      "agent.id": agentId,
    });

    return consoleLog || {};
  } catch (error) {
    console.log(error);
    return {};
  }
};

const createLog = async (data) => {
  const consoleLog = new ConsoleLog(data);

  const response = consoleLog.save(consoleLog).then((data) => {
    return data;
  });

  return response;
};

const updateLog = async (consoleLogId, data) => {
  try {
    const updatedLog = await ConsoleLog.findByIdAndUpdate(
      consoleLogId,
      data,
      { new: true, runValidators: true }
    );

    return updatedLog || {};
  } catch (error) {
    console.log(error);
    return {};
  }
};

module.exports = {
  getByFilter: getByFilter,
  getCountByFilter: getCountByFilter,
  getLogById: getLogById,
  getLogByExecutionIdByAgentId: getLogByExecutionIdByAgentId,
  createLog: createLog,
  updateLog: updateLog,
};
