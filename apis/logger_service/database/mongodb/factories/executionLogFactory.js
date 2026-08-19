"use strict";

const helpers = require("../../../helpers");
const ExecutionLog = require("../models/executionLog");

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

  const logsData = ExecutionLog.find(conditions)
    .limit(limit)
    .skip(offset)
    .sort(sortCondition)
    .then((data) => {
      return data;
    });

  const totalItems = ExecutionLog.countDocuments(conditions).then((count) => {
    return count;
  });

  const executionLogs = Promise.all([logsData, totalItems]).then((results) => {
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

  return executionLogs;
};

const getCountByFilter = async (filters) => {
  const totalItems = ExecutionLog.countDocuments(filters).then((count) => {
    return count;
  });

  return totalItems;
};

const getByExecutionId = async (executionId) => {
  try {
    const data = await ExecutionLog.find({
      orchestration_execution_id: executionId,
    });

    return data || [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getLogById = async (id) => {
  const executionLog = ExecutionLog.findById(id).then((data) => {
    return data;
  });

  return executionLog;
};

const createLog = async (data) => {
  const executionLog = new ExecutionLog(data);

  const response = executionLog.save(executionLog).then((data) => {
    return data;
  });

  return response;
};

module.exports = {
  getByFilter: getByFilter,
  getCountByFilter: getCountByFilter,
  getByExecutionId: getByExecutionId,
  getLogById: getLogById,
  createLog: createLog,
};
